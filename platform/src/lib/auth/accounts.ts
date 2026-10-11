import 'server-only';
import {getDatabase} from '@/lib/db';
import type {Prisma} from '@/generated/prisma/client';
import {enqueueAccountEmail, emailConfigurationReady} from '@/lib/email';
import {AccountError} from './errors';
import {authConfigurationReady} from './config';
import {generateSecretToken, hashSecretToken} from './crypto';
import {hashPassword, verifyPassword} from './password';
import type {z} from 'zod';
import type {registrationSchema, forgotPasswordSchema, resetPasswordSchema, profileSchema, changePasswordSchema} from './schemas';

const verificationLifetime = 24 * 60 * 60 * 1000;
const resetLifetime = 30 * 60 * 1000;

export function requireAccountConfiguration(needsEmail = false): void {
  if (!authConfigurationReady() || (needsEmail && !emailConfigurationReady())) throw new AccountError('SERVICE_UNAVAILABLE', 503);
}

async function lockUser(transaction: Prisma.TransactionClient, userId: string): Promise<void> {
  await transaction.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
}

async function queueVerification(transaction: Prisma.TransactionClient, user: {id:string;email:string;name:string|null}, locale:'ar'|'en'): Promise<void> {
  const now = new Date();
  await transaction.emailVerificationToken.updateMany({where:{userId:user.id, consumedAt:null}, data:{consumedAt:now}});
  const token = generateSecretToken();
  await transaction.emailVerificationToken.create({data:{userId:user.id, email:user.email, tokenHash:hashSecretToken(token), expiresAt:new Date(now.getTime() + verificationLifetime)}});
  await enqueueAccountEmail(transaction, {kind:'VERIFY_EMAIL', to:user.email, name:user.name, locale, token, userId:user.id});
}

/** An existing address deliberately receives the same public response. */
export async function registerAccount(input: z.infer<typeof registrationSchema>): Promise<void> {
  requireAccountConfiguration(true);
  const passwordHash = await hashPassword(input.password);
  try {
    await getDatabase().$transaction(async transaction => {
      if (await transaction.user.findUnique({where:{email:input.email}, select:{id:true}})) return;
      const role = await transaction.role.upsert({where:{slug:'learner'}, update:{}, create:{slug:'learner', name:'Learner', permissions:['learning.read']}});
      const user = await transaction.user.create({data:{name:input.name, email:input.email, passwordHash, preferredLocale:input.locale, image:'/avatars/sky.svg', roles:{create:{roleId:role.id}}}});
      await queueVerification(transaction, user, input.locale);
    });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return;
    throw error;
  }
}

export async function requestPasswordReset(input: z.infer<typeof forgotPasswordSchema>): Promise<void> {
  requireAccountConfiguration(true);
  await getDatabase().$transaction(async transaction => {
    const found = await transaction.user.findUnique({where:{email:input.email}, select:{id:true}});
    if (!found) return;
    await lockUser(transaction, found.id);
    const user = await transaction.user.findUnique({where:{id:found.id}});
    if (!user || user.status !== 'ACTIVE') return;
    const now = new Date();
    await transaction.passwordResetToken.updateMany({where:{userId:user.id, consumedAt:null}, data:{consumedAt:now}});
    const token = generateSecretToken();
    await transaction.passwordResetToken.create({data:{userId:user.id, tokenHash:hashSecretToken(token), expiresAt:new Date(now.getTime()+resetLifetime)}});
    await enqueueAccountEmail(transaction, {kind:'RESET_PASSWORD', to:user.email, name:user.name, locale:input.locale, token, userId:user.id});
  });
}

export async function verifyAccountEmail(token: string): Promise<void> {
  requireAccountConfiguration();
  await getDatabase().$transaction(async transaction => {
    const found = await transaction.emailVerificationToken.findUnique({where:{tokenHash:hashSecretToken(token)}});
    if (!found) throw new AccountError('INVALID_TOKEN', 400);
    await lockUser(transaction, found.userId);
    const user = await transaction.user.findUnique({where:{id:found.userId}});
    const now = new Date();
    if (!user || user.status !== 'ACTIVE' || user.email !== found.email) throw new AccountError('INVALID_TOKEN', 400);
    const consumed = await transaction.emailVerificationToken.updateMany({where:{id:found.id, consumedAt:null, expiresAt:{gt:now}}, data:{consumedAt:now}});
    if (consumed.count !== 1) throw new AccountError('INVALID_TOKEN', 400);
    await transaction.user.update({where:{id:user.id}, data:{emailVerified:user.emailVerified ?? now}});
    await transaction.emailVerificationToken.updateMany({where:{userId:user.id, consumedAt:null}, data:{consumedAt:now}});
  });
}

export async function resendAccountVerification(userId: string, locale:'ar'|'en'): Promise<void> {
  requireAccountConfiguration(true);
  await getDatabase().$transaction(async transaction => {
    await lockUser(transaction, userId);
    const user = await transaction.user.findUnique({where:{id:userId}});
    if (!user || user.status !== 'ACTIVE') throw new AccountError('UNAUTHORIZED', 401);
    if (user.emailVerified) return;
    await queueVerification(transaction, user, locale);
  });
}

export async function resetAccountPassword(input: z.infer<typeof resetPasswordSchema>): Promise<void> {
  requireAccountConfiguration();
  const passwordHash = await hashPassword(input.password);
  await getDatabase().$transaction(async transaction => {
    const found = await transaction.passwordResetToken.findUnique({where:{tokenHash:hashSecretToken(input.token)}});
    if (!found) throw new AccountError('INVALID_TOKEN', 400);
    await lockUser(transaction, found.userId);
    const user = await transaction.user.findUnique({where:{id:found.userId}});
    const now = new Date();
    if (!user || user.status !== 'ACTIVE') throw new AccountError('INVALID_TOKEN', 400);
    const consumed = await transaction.passwordResetToken.updateMany({where:{id:found.id, consumedAt:null, expiresAt:{gt:now}}, data:{consumedAt:now}});
    if (consumed.count !== 1) throw new AccountError('INVALID_TOKEN', 400);
    await transaction.user.update({where:{id:user.id}, data:{passwordHash, passwordChangedAt:now, sessionVersion:{increment:1}}});
    await transaction.session.updateMany({where:{userId:user.id, revokedAt:null}, data:{revokedAt:now}});
    await transaction.passwordResetToken.updateMany({where:{userId:user.id, consumedAt:null}, data:{consumedAt:now}});
  });
}

export async function updateAccountProfile(userId: string, sessionVersion: number, input: z.infer<typeof profileSchema>): Promise<void> {
  requireAccountConfiguration();
  const changed = await getDatabase().user.updateMany({where:{id:userId, status:'ACTIVE', sessionVersion}, data:input});
  if (changed.count !== 1) throw new AccountError('UNAUTHORIZED', 401);
}

export async function changeAccountPassword(userId:string, sessionVersion:number, input:z.infer<typeof changePasswordSchema>): Promise<void> {
  requireAccountConfiguration();
  const passwordHash = await hashPassword(input.newPassword);
  await getDatabase().$transaction(async transaction => {
    await lockUser(transaction, userId);
    const user = await transaction.user.findUnique({where:{id:userId}});
    if (!user || user.status !== 'ACTIVE' || user.sessionVersion !== sessionVersion) throw new AccountError('UNAUTHORIZED', 401);
    if (!await verifyPassword(input.currentPassword, user.passwordHash)) throw new AccountError('INVALID_CREDENTIALS', 400);
    const now = new Date();
    await transaction.user.update({where:{id:user.id}, data:{passwordHash, passwordChangedAt:now, sessionVersion:{increment:1}}});
    await transaction.session.updateMany({where:{userId:user.id, revokedAt:null}, data:{revokedAt:now}});
    await transaction.passwordResetToken.updateMany({where:{userId:user.id, consumedAt:null}, data:{consumedAt:now}});
  });
}
