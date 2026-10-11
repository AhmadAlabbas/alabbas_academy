import 'server-only';
import type {JWT} from 'next-auth/jwt';
import {getDatabase} from '@/lib/db';
import {emailSchema} from './schemas';
import {recentPasswordAgeSeconds, resolveSessionToken} from './session-records';

export function recentPasswordOwnership(token:JWT|null, user:{id:string;email:string;emailVerified:Date|null}, providerEmail:string, now=Date.now()):boolean {
  return Boolean(token && token.sub === user.id && user.emailVerified && user.email === providerEmail && token.authenticationMethod === 'credentials' && typeof token.authenticatedAt === 'number' && token.authenticatedAt <= now && token.authenticatedAt > now-recentPasswordAgeSeconds*1000);
}

/** Identity records are persisted manually because Credentials uses JWT sessions. */
export async function resolveGoogleIdentity(profile:{email?:unknown;email_verified?:unknown;name?:unknown}, providerAccountId:string, priorToken:JWT|null):Promise<{id:string;name:string|null;email:string;image:string|null}|null> {
  const email = emailSchema.safeParse(profile.email);
  if (!email.success || profile.email_verified !== true || !providerAccountId) return null;
  const database = getDatabase();
  const prior = await resolveSessionToken(priorToken);
  return database.$transaction(async transaction => {
    const linked = await transaction.account.findUnique({where:{provider_providerAccountId:{provider:'google',providerAccountId}}, include:{user:true}});
    if (linked) return linked.user.status === 'ACTIVE' ? linked.user : null;
    const existing = await transaction.user.findUnique({where:{email:email.data}});
    let user = existing;
    if (existing) {
      if (!prior || existing.status !== 'ACTIVE' || !recentPasswordOwnership(priorToken, existing, email.data)) return null;
      // Serialize linking with password resets and other account changes.
      await transaction.$queryRaw`SELECT id FROM users WHERE id = ${existing.id} FOR UPDATE`;
      const current = await transaction.user.findUnique({where:{id:existing.id}});
      const session = await transaction.session.findUnique({where:{id:prior.id}});
      if (!current || current.status !== 'ACTIVE' || current.sessionVersion !== priorToken?.sessionVersion || !current.emailVerified || !session || session.revokedAt || session.expires.getTime() <= Date.now()) return null;
      user = current;
    } else {
      // Account linking from an unrelated signed-in identity never creates a second identity silently.
      if (prior) return null;
      const role = await transaction.role.upsert({where:{slug:'learner'}, update:{}, create:{slug:'learner', name:'Learner', permissions:['learning.read']}});
      user = await transaction.user.create({data:{email:email.data,name:typeof profile.name === 'string' ? profile.name.trim().slice(0,80) : null,emailVerified:new Date(),image:'/avatars/sky.svg',roles:{create:{roleId:role.id}}}});
    }
    if (!user) return null;
    await transaction.account.create({data:{userId:user.id,type:'oidc',provider:'google',providerAccountId}});
    return user;
  });
}
