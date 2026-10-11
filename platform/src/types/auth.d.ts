import type {DefaultSession} from 'next-auth';

declare module 'next-auth' {
  interface User {
    credentialSessionVersion?:number;
  }
  interface Session {
    user: Omit<NonNullable<DefaultSession['user']>, 'emailVerified'> & {
      id:string;
      email:string;
      emailVerified:Date|null;
      preferredLocale:'ar'|'en';
      roles:string[];
      sessionId:string;
      sessionVersion:number;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sessionSecret?:string;
    sessionId?:string;
    sessionVersion?:number;
    authenticationMethod?:'credentials'|'google';
    authenticatedAt?:number;
    emailVerified?:string|null;
    preferredLocale?:'ar'|'en';
    roles?:string[];
  }
}
