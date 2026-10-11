import "server-only";
import {createHash, randomUUID} from "node:crypto";
import type {BackgroundJob, PrismaClient} from "@/generated/prisma/client";
import {getDatabase} from "@/lib/db";
import {AccountEmailError, emailConfigurationReady} from "./config";
import {deliverAccountEmail, removeExpiredOutboxMessages} from "./delivery";
import {openEmailPayload, type AccountEmailPayload} from "./payload";
import {ACCOUNT_EMAIL_JOB} from "./queue";

const LEASE_MILLISECONDS = 120_000;
export type AccountEmailWorkerResult = {sent: number; retried: number; discarded: number};

export function emailRetryDelay(attempts: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, attempts - 1), 15 * 60_000);
}

async function discardExpiredOrExhaustedJobs(database:PrismaClient,now:Date):Promise<number>{
 const stale=new Date(now.getTime()-LEASE_MILLISECONDS);
 const jobs=await database.backgroundJob.findMany({where:{kind:ACCOUNT_EMAIL_JOB,OR:[{status:{in:['PENDING','FAILED']}},{status:'RUNNING',lockedAt:{lt:stale}}]},take:50});let discarded=0;
 for(const job of jobs){let expired=false,code='EMAIL_EXPIRED_OR_EXHAUSTED';try{expired=Date.parse(openEmailPayload(job.payload).expiresAt)<=now.getTime()}catch{expired=true;code='EMAIL_PAYLOAD_UNREADABLE';}
 if(expired||job.attempts>=job.maximumAttempts){discarded+=(await database.backgroundJob.updateMany({where:{id:job.id,status:job.status,attempts:job.attempts,lockedBy:job.lockedBy,...(job.status==='RUNNING'?{lockedAt:{lt:stale}}:{})},data:{status:'DEAD_LETTER',payload:{type:'ACCOUNT_EMAIL_RECEIPT',outcome:'DISCARDED'},completedAt:now,lockedBy:null,lockedAt:null,lastError:code}})).count;}}
 return discarded;
}
async function claimEmailJob(database:PrismaClient,workerId:string,now:Date):Promise<BackgroundJob|null>{
 // One atomic conditional UPDATE claims ownership. A prior read inside MariaDB's
 // repeatable-read transaction can cause error 1020 under concurrent claimers.
 const stale=new Date(now.getTime()-LEASE_MILLISECONDS);
 const found=await database.backgroundJob.findFirst({where:{kind:ACCOUNT_EMAIL_JOB,availableAt:{lte:now},OR:[{status:{in:['PENDING','FAILED']}},{status:'RUNNING',lockedAt:{lt:stale}}]},orderBy:[{availableAt:'asc'},{createdAt:'asc'}]});
 if(!found)return null;
 const claimed=await database.backgroundJob.updateMany({where:{id:found.id,attempts:found.attempts,status:found.status,...(found.status==='RUNNING'?{lockedAt:{lt:stale}}:{})},data:{status:'RUNNING',attempts:{increment:1},lockedAt:now,lockedBy:workerId}});
 return claimed.count?database.backgroundJob.findUnique({where:{id:found.id}}):null;
}

async function tokenStillUsable(database: PrismaClient, payload: AccountEmailPayload, now: Date): Promise<boolean> {
  if (Date.parse(payload.expiresAt) <= now.getTime()) return false;
  if (!payload.userId) return true;
  const tokenHash = createHash("sha256").update(payload.token).digest("hex");
  const token = payload.kind === "VERIFY_EMAIL"
    ? await database.emailVerificationToken.findUnique({where: {tokenHash}, select: {userId: true, email: true, expiresAt: true, consumedAt: true, user: {select: {status: true, email: true}}}})
    : await database.passwordResetToken.findUnique({where: {tokenHash}, select: {userId: true, expiresAt: true, consumedAt: true, user: {select: {status: true, email: true}}}});
  return Boolean(token && token.userId === payload.userId && token.user.status === "ACTIVE" && token.user.email === payload.to && (!("email" in token) || token.email === payload.to) && !token.consumedAt && token.expiresAt > now);
}

/** Deliver a bounded batch during requests. Atomic claims prevent simultaneous delivery. */
export async function deliverPendingAccountEmails({limit = 10}: {limit?: number} = {}): Promise<AccountEmailWorkerResult> {
  if (!emailConfigurationReady()) throw new AccountEmailError("EMAIL_CONFIGURATION_UNAVAILABLE");
  const database = getDatabase();
  const workerId = randomUUID();
  const result: AccountEmailWorkerResult = {sent: 0, retried: 0, discarded: 0};
  await removeExpiredOutboxMessages();
  result.discarded += await discardExpiredOrExhaustedJobs(database, new Date());
  const batch = Math.min(50, Math.max(1, Math.floor(Number.isFinite(limit) ? limit : 10)));
  for (let index = 0; index < batch; index++) {
    const job = await claimEmailJob(database, workerId, new Date());
    if (!job) break;
    const claim = {id: job.id, status: "RUNNING" as const, lockedBy: workerId};
    try {
      const payload = openEmailPayload(job.payload);
      if (!await tokenStillUsable(database, payload, new Date())) {
        await database.backgroundJob.updateMany({where: claim, data: {
          status: "DEAD_LETTER", payload: {type: "ACCOUNT_EMAIL_RECEIPT", outcome: "EXPIRED_OR_CONSUMED"},
          completedAt: new Date(), lockedAt: null, lockedBy: null, lastError: "EMAIL_TOKEN_UNAVAILABLE",
        }});
        result.discarded++;
        continue;
      }
      const receipt = await deliverAccountEmail(job.id, payload);
      await database.backgroundJob.updateMany({where: claim, data: {
        status: "SUCCEEDED", payload: {type: "ACCOUNT_EMAIL_RECEIPT", outcome: "SENT", transport: receipt.transport},
        completedAt: new Date(), lockedAt: null, lockedBy: null, lastError: null,
      }});
      result.sent++;
    } catch (error) {
      const code = error instanceof AccountEmailError ? error.code : "EMAIL_DELIVERY_FAILED";
      const discarded = job.attempts >= job.maximumAttempts || code === "EMAIL_PAYLOAD_UNREADABLE";
      await database.backgroundJob.updateMany({where: claim, data: {
        status: discarded ? "DEAD_LETTER" : "FAILED",
        ...(discarded ? {payload: {type: "ACCOUNT_EMAIL_RECEIPT", outcome: "FAILED"}, completedAt: new Date()} : {}),
        availableAt: new Date(Date.now() + emailRetryDelay(job.attempts)),
        lockedAt: null, lockedBy: null, lastError: code,
      }});
      if (discarded) result.discarded++;
      else result.retried++;
    }
  }
  return result;
}
