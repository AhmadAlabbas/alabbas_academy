import NextAuth, {type NextAuthConfig} from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import {getToken} from 'next-auth/jwt';
import {getDatabase} from '@/lib/db';
import {authConfigurationReady, googleConfigurationReady, secureAuthCookies} from '@/lib/auth/config';
import {loginSchema} from '@/lib/auth/schemas';
import {verifyPassword} from '@/lib/auth/password';
import {limitAccountRequest} from '@/lib/security/rate-limit';
import {createSessionAnchor, maximumSessionAgeSeconds, resolveSessionToken, revokeSessionToken} from '@/lib/auth/session-records';
import {resolveGoogleIdentity} from '@/lib/auth/google';

export const {auth, handlers, signIn, signOut} = NextAuth(request => {
  const locale = request?.cookies.get('ALABBAS_LOCALE')?.value === 'en' ? 'en' : 'ar';
  const providers:NextAuthConfig['providers'] = [Credentials({
    credentials:{email:{type:'email'},password:{type:'password'}},
    async authorize(credentials, authenticationRequest) {
      if (!authConfigurationReady()) return null;
      const parsed = loginSchema.safeParse({email:credentials.email,password:credentials.password});
      if (!parsed.success) return null;
      try {
        await limitAccountRequest(authenticationRequest, 'login', parsed.data.email, 10, 900);
        const user = await getDatabase().user.findUnique({where:{email:parsed.data.email}});
        const matched = await verifyPassword(parsed.data.password, user?.passwordHash);
        if (!matched || !user || user.status !== 'ACTIVE') return null;
        return {id:user.id,name:user.name,email:user.email,image:user.image,credentialSessionVersion:user.sessionVersion};
      } catch { return null; }
    },
  })];
  if (googleConfigurationReady()) providers.push(Google({clientId:process.env.GOOGLE_CLIENT_ID!,clientSecret:process.env.GOOGLE_CLIENT_SECRET!,checks:['pkce','state','nonce'],allowDangerousEmailAccountLinking:false}));
  return {
    providers,
    secret:process.env.AUTH_SECRET,
    session:{strategy:'jwt',maxAge:maximumSessionAgeSeconds},
    useSecureCookies:secureAuthCookies(),
    trustHost:true,
    pages:{signIn:`/${locale}/login`,error:`/${locale}/login`},
    logger:{error(){/* Never log OAuth profiles, cookies, passwords, or reset tokens. */},warn(){},debug(){}},
    callbacks:{
      async signIn({user,account,profile}) {
        if (!authConfigurationReady()) return false;
        if (account?.provider !== 'google') return account?.provider === 'credentials';
        if (!profile) return false;
        try {
          const prior = request ? await getToken({req:request,secret:process.env.AUTH_SECRET!,secureCookie:secureAuthCookies()}) : null;
          const identity = await resolveGoogleIdentity(profile, account.providerAccountId, prior);
          if (!identity) return false;
          user.id = identity.id;
          user.name = identity.name;
          user.email = identity.email;
          user.image = identity.image;
          return true;
        } catch { return false; }
      },
      async jwt({token,user,account}) {
        if (!authConfigurationReady()) return null;
        try {
          if (user) {
            const current = await getDatabase().user.findUnique({where:{id:user.id}});
            if (!current || current.status !== 'ACTIVE') return null;
            if (account?.provider === 'credentials' && user.credentialSessionVersion !== current.sessionVersion) return null;
            const {secret,record} = await createSessionAnchor(current.id,current.sessionVersion);
            token.sub = current.id;
            token.sessionSecret = secret;
            token.sessionId = record.id;
            token.sessionVersion = current.sessionVersion;
            token.authenticationMethod = account?.provider === 'google' ? 'google' : 'credentials';
            token.authenticatedAt = Date.now();
            await getDatabase().user.update({where:{id:current.id},data:{lastLoginAt:new Date()}});
          }
          const anchor = await resolveSessionToken(token);
          if (!anchor) return null;
          token.name = anchor.user.name;
          token.email = anchor.user.email;
          token.picture = anchor.user.image;
          token.emailVerified = anchor.user.emailVerified?.toISOString() ?? null;
          token.preferredLocale = anchor.user.preferredLocale === 'en' ? 'en' : 'ar';
          token.roles = anchor.user.roles.map(item => item.role.slug);
          return token;
        } catch { return null; }
      },
      async session({session,token}) {
        session.user = {id:token.sub!,name:token.name,email:token.email!,image:token.picture,emailVerified:token.emailVerified ? new Date(token.emailVerified) : null,preferredLocale:token.preferredLocale ?? 'ar',roles:token.roles ?? [],sessionId:token.sessionId!,sessionVersion:token.sessionVersion!};
        // The raw anchor token only exists in the encrypted HttpOnly JWT cookie.
        return session;
      },
      redirect({url,baseUrl}) {
        try {
          const destination = new URL(url,baseUrl);
          if (destination.origin === new URL(baseUrl).origin && /^\/(ar|en)(\/|$)/.test(destination.pathname)) return destination.href;
        } catch { /* Malformed callbacks use the safe account destination. */ }
        return `${baseUrl}/${locale}/account`;
      },
    },
    events:{async signOut(message) {
      if ('token' in message && authConfigurationReady()) {
        await revokeSessionToken(message.token);
      }
    }},
  } satisfies NextAuthConfig;
});
