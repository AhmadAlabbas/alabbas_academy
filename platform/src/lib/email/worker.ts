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

async function discardExpiredOrExhaustedJobs(database: PrismaClient, now: Date): Promise<number> {
  const stale = new Date(now.getTime() - LEASE_MILLISECONDS);
  return database.$executeRaw`
    UPDATE "background_jobs"
    SET "status" = 'DEAD_LETTER', "payload" = '{"type":"ACCOUNT_EMAIL_RECEIPT","outcome":"DISCARDED"}'::jsonb,
        "lastError" = 'EMAIL_EXPIRED_OR_EXHAUSTED', "completedAt" = ${now},
        "lockedAt" = NULL, "lockedBy" = NULL, "updatedAt" = ${now}
    WHERE "kind" = ${ACCOUNT_EMAIL_JOB}
      AND ("status" IN ('PENDING', 'FAILED') OR ("status" = 'RUNNING' AND "lockedAt" < ${stale}))
      AND (("payload"->>'expiresAt') <= ${now.toISOString()} OR "attempts" >= "maximumAttempts")
  `;
}

async function claimEmailJob(database: PrismaClient, workerId: string, now: Date): Promise<BackgroundJob | null> {
  const stale = new Date(now.getTime() - LEASE_MILLISECONDS);
  const jobs = await database.$queryRaw<BackgroundJob[]>`
    WITH candidate AS (
      SELECT "id" FROM "background_jobs"
      WHERE "kind" = ${ACCOUNT_EMAIL_JOB} AND "availableAt" <= ${now}
        AND "attempts" < "maximumAttempts"
        AND ("status" IN ('PENDING', 'FAILED') OR ("status" = 'RUNNING' AND "lockedAt" < ${stale}))
      ORDER BY "availableAt", "createdAt"
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE "background_jobs" AS job
    SET "status" = 'RUNNING', "attempts" = job."attempts" + 1,
        "lockedAt" = ${now}, "lockedBy" = ${workerId}, "updatedAt" = ${now}
    FROM candidate WHERE job."id" = candidate."id"
    RETURNING job.*
  `;
  return jobs[0] ?? null;
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

/** Process a bounded batch. PostgreSQL claims and leases prevent duplicate workers. */
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
