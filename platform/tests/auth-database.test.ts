import {afterAll,afterEach,beforeAll,describe,expect,it,vi} from 'vitest';
import {createHmac,randomUUID} from 'node:crypto';
vi.mock('server-only',()=>({}));
import {getDatabase} from '@/lib/db';
import {registerAccount,verifyAccountEmail,requestPasswordReset,resetAccountPassword,changeAccountPassword,updateAccountProfile} from '@/lib/auth/accounts';
import {generateSecretToken,hashSecretToken} from '@/lib/auth/crypto';
import {hashPassword,verifyPassword} from '@/lib/auth/password';
import {createSessionAnchor,resolveSessionToken} from '@/lib/auth/session-records';
import {resolveGoogleIdentity} from '@/lib/auth/google';
import {consumeRateLimit} from '@/lib/security/rate-limit';
import {openEmailPayload} from '@/lib/email/payload';

const configured=process.env.AUTH_TEST_DATABASE_URL;
const enabled=Boolean(configured && ['localhost','127.0.0.1','[::1]'].includes(new URL(configured).hostname));
const userIds:string[]=[];
const rateKeys:string[]=[];
const secret='integration-only-auth-secret'.repeat(3);
const password='Test-academy-password-123';
const nextPassword='Next-academy-password-456';

describe.skipIf(!enabled)('account MySQL invariants',()=>{
 beforeAll(()=>{vi.stubEnv('DATABASE_URL',configured!);vi.stubEnv('AUTH_SECRET',secret);vi.stubEnv('AUTH_URL','http://localhost:3001');vi.stubEnv('NEXT_PUBLIC_APP_URL','http://localhost:3001');vi.stubEnv('EMAIL_TRANSPORT','outbox');});
 afterEach(async()=>{
   const db=getDatabase();
   const tokens=await db.emailVerificationToken.findMany({where:{userId:{in:userIds}},select:{tokenHash:true}});
   const reset=await db.passwordResetToken.findMany({where:{userId:{in:userIds}},select:{tokenHash:true}});
   await db.backgroundJob.deleteMany({where:{deduplicationKey:{in:[...tokens.map(t=>`account-email:VERIFY_EMAIL:${t.tokenHash}`),...reset.map(t=>`account-email:RESET_PASSWORD:${t.tokenHash}`)]}}});
   await db.user.deleteMany({where:{id:{in:userIds}}});
   await db.authRateLimit.deleteMany({where:{key:{in:rateKeys}}});
   userIds.length=0;rateKeys.length=0;
 });
 afterAll(async()=>{
   // Clean up this suite's sealed jobs after an interrupted previous test run.
   const database=getDatabase();
   const jobs=await database.backgroundJob.findMany({where:{kind:'ACCOUNT_EMAIL'},select:{id:true,payload:true}});
   const stale:string[]=[];
   for (const job of jobs) {
     try { if (openEmailPayload(job.payload).to.startsWith('auth-test-')) stale.push(job.id); } catch { /* Other suites and application jobs use different encryption keys. */ }
   }
   if (stale.length) await database.backgroundJob.deleteMany({where:{id:{in:stale}}});
   await database.$disconnect();vi.unstubAllEnvs();
 });
 async function learner(verified=true,withPassword=true){
   const user=await getDatabase().user.create({data:{email:`auth-test-${randomUUID()}@example.com`,name:'Integration Learner',emailVerified:verified?new Date():null,passwordHash:withPassword?await hashPassword(password):null}});userIds.push(user.id);return user;
 }
 async function resetToken(userId:string,expiry=Date.now()+60000){const token=generateSecretToken();await getDatabase().passwordResetToken.create({data:{userId,tokenHash:hashSecretToken(token),expiresAt:new Date(expiry)}});return token;}
 async function verificationToken(user:{id:string;email:string},expiry=Date.now()+60000){const token=generateSecretToken();await getDatabase().emailVerificationToken.create({data:{userId:user.id,email:user.email,tokenHash:hashSecretToken(token),expiresAt:new Date(expiry)}});return token;}
 it('registers an unverified account with a hashed password and encrypted delivery job; duplicate signup does not mutate it',async()=>{
   const email=`auth-test-${randomUUID()}@example.com`;await registerAccount({name:'First Learner',email,password,locale:'ar'});
   const user=await getDatabase().user.findUniqueOrThrow({where:{email}});userIds.push(user.id);expect(user.emailVerified).toBeNull();expect(await verifyPassword(password,user.passwordHash)).toBe(true);expect(user.passwordHash).not.toContain(password);
   const tokens=await getDatabase().emailVerificationToken.findMany({where:{userId:user.id}});expect(tokens).toHaveLength(1);const job=await getDatabase().backgroundJob.findUniqueOrThrow({where:{deduplicationKey:`account-email:VERIFY_EMAIL:${tokens[0].tokenHash}`}});expect(JSON.stringify(job.payload)).not.toContain(email);
   await registerAccount({name:'Replacement',email,password:nextPassword,locale:'en'});const unchanged=await getDatabase().user.findUniqueOrThrow({where:{id:user.id}});expect(unchanged.name).toBe('First Learner');expect(await verifyPassword(password,unchanged.passwordHash)).toBe(true);
 });
 it('rejects expired verification and consumes a valid token exactly once under concurrent submissions',async()=>{
   const user=await learner(false);const expired=await verificationToken(user,Date.now()-1000);await expect(verifyAccountEmail(expired)).rejects.toMatchObject({code:'INVALID_TOKEN'});const token=await verificationToken(user);
   const outcomes=await Promise.allSettled([verifyAccountEmail(token),verifyAccountEmail(token)]);expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect(outcomes.filter(x=>x.status==='rejected')).toHaveLength(1);expect((await getDatabase().user.findUniqueOrThrow({where:{id:user.id}})).emailVerified).not.toBeNull();await expect(verifyAccountEmail(token)).rejects.toMatchObject({code:'INVALID_TOKEN'});
 });
 it('resets once, invalidates previous sessions and every outstanding reset token',async()=>{
   const user=await learner();const anchor=await createSessionAnchor(user.id,0);const jwt={sub:user.id,sessionVersion:0,sessionSecret:anchor.secret};expect(await resolveSessionToken(jwt)).not.toBeNull();const expired=await resetToken(user.id,Date.now()-1000);await expect(resetAccountPassword({token:expired,password:nextPassword,locale:'en'})).rejects.toMatchObject({code:'INVALID_TOKEN'});
   const token=await resetToken(user.id);const other=await resetToken(user.id);await resetAccountPassword({token,password:nextPassword,locale:'en'});const changed=await getDatabase().user.findUniqueOrThrow({where:{id:user.id}});expect(changed.sessionVersion).toBe(1);expect(await verifyPassword(nextPassword,changed.passwordHash)).toBe(true);expect(await verifyPassword(password,changed.passwordHash)).toBe(false);expect(await resolveSessionToken(jwt)).toBeNull();await expect(resetAccountPassword({token,password,locale:'ar'})).rejects.toMatchObject({code:'INVALID_TOKEN'});await expect(resetAccountPassword({token:other,password,locale:'ar'})).rejects.toMatchObject({code:'INVALID_TOKEN'});
 });
 it('lets a Google-only active account prove email ownership to establish its first password',async()=>{
   const user=await learner(true,false);await requestPasswordReset({email:user.email,locale:'en'});expect(await getDatabase().passwordResetToken.count({where:{userId:user.id,consumedAt:null}})).toBe(1);const token=await resetToken(user.id);await resetAccountPassword({token,password,locale:'en'});expect(await verifyPassword(password,(await getDatabase().user.findUniqueOrThrow({where:{id:user.id}})).passwordHash)).toBe(true);
 });
 it('rejects stale or nonexistent profile access and incorrect current passwords without changing data',async()=>{
   const user=await learner();const profile={name:'New Name',preferredLocale:'en' as const,image:'/avatars/gold.svg' as const};await expect(updateAccountProfile(user.id,3,profile)).rejects.toMatchObject({code:'UNAUTHORIZED'});await expect(updateAccountProfile('not-a-user',0,profile)).rejects.toMatchObject({code:'UNAUTHORIZED'});await expect(changeAccountPassword(user.id,0,{currentPassword:'incorrect-password',newPassword:nextPassword})).rejects.toMatchObject({code:'INVALID_CREDENTIALS'});expect((await getDatabase().user.findUniqueOrThrow({where:{id:user.id}})).name).toBe('Integration Learner');
   await updateAccountProfile(user.id,0,profile);await changeAccountPassword(user.id,0,{currentPassword:password,newPassword:nextPassword});await expect(updateAccountProfile(user.id,0,profile)).rejects.toMatchObject({code:'UNAUTHORIZED'});
 });
 it('enforces persisted rate counters atomically across concurrent requests and resets expired windows',async()=>{
   const identity=randomUUID();const scope='auth-integration';const key=createHmac('sha256',secret).update(`${scope}\0${identity}`).digest('hex');rateKeys.push(key);const results=await Promise.allSettled(Array.from({length:15},()=>consumeRateLimit(scope,identity,5,900)));expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(5);expect(results.filter(x=>x.status==='rejected')).toHaveLength(10);expect((await getDatabase().authRateLimit.findUniqueOrThrow({where:{key}})).attempts).toBe(15);await getDatabase().authRateLimit.update({where:{key},data:{expiresAt:new Date(Date.now()-1000)}});await consumeRateLimit(scope,identity,5,900);expect((await getDatabase().authRateLimit.findUniqueOrThrow({where:{key}})).attempts).toBe(1);
 });
 it('never links an existing email without fresh verified password ownership; rejects revoked proof',async()=>{
   const user=await learner();const profile={email:user.email,email_verified:true,name:'Google Learner'};const providerAccountId=randomUUID();expect(await resolveGoogleIdentity(profile,providerAccountId,null)).toBeNull();const anchor=await createSessionAnchor(user.id,0);const proof={sub:user.id,sessionVersion:0,sessionSecret:anchor.secret,authenticationMethod:'credentials' as const,authenticatedAt:Date.now()};await getDatabase().session.update({where:{id:anchor.record.id},data:{revokedAt:new Date()}});expect(await resolveGoogleIdentity(profile,providerAccountId,proof)).toBeNull();const fresh=await createSessionAnchor(user.id,0);expect((await resolveGoogleIdentity(profile,providerAccountId,{...proof,sessionSecret:fresh.secret}))?.id).toBe(user.id);expect(await getDatabase().account.count({where:{userId:user.id,provider:'google'}})).toBe(1);expect(await resolveGoogleIdentity({...profile,email_verified:false},randomUUID(),proof)).toBeNull();
 });
});
