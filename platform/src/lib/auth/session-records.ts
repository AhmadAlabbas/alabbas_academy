import 'server-only';
import type {JWT} from 'next-auth/jwt';
import {getDatabase} from '@/lib/db';
import {generateSecretToken, hashSecretToken} from './crypto';

export const maximumSessionAgeSeconds = 7 * 24 * 60 * 60;
export const recentPasswordAgeSeconds = 10 * 60;

export async function createSessionAnchor(userId:string, sessionVersion:number) {
  const secret = generateSecretToken();
  const record = await getDatabase().session.create({data:{userId, sessionVersion, tokenHash:hashSecretToken(secret), expires:new Date(Date.now() + maximumSessionAgeSeconds*1000)}});
  return {secret, record};
}

export async function resolveSessionToken(token: JWT|null) {
  if (!token || typeof token.sub !== 'string' || typeof token.sessionSecret !== 'string' || typeof token.sessionVersion !== 'number') return null;
  const anchor = await getDatabase().session.findUnique({where:{tokenHash:hashSecretToken(token.sessionSecret)}, include:{user:{include:{roles:{include:{role:true}}}}}});
  if (!anchor || anchor.userId !== token.sub || anchor.revokedAt || anchor.expires.getTime() <= Date.now() || anchor.user.status !== 'ACTIVE' || anchor.sessionVersion !== token.sessionVersion || anchor.user.sessionVersion !== token.sessionVersion) return null;
  return anchor;
}

export async function revokeSessionToken(token: JWT|null): Promise<void> {
  if (typeof token?.sessionSecret !== 'string') return;
  await getDatabase().session.updateMany({where:{tokenHash:hashSecretToken(token.sessionSecret), revokedAt:null}, data:{revokedAt:new Date()}});
}
