import "server-only";
import {getDatabase} from "@/lib/db";
import {ACCOUNT_EMAIL_JOB} from "@/lib/email/queue";

const DAY = 86_400_000;
export type AccountMaintenanceResult = {
  rateLimits: number;
  verificationTokens: number;
  resetTokens: number;
  sessions: number;
  emailReceipts: number;
};

/**
 * Remove inactive account records in bounded, repeatable batches. Expired rate
 * windows are kept for one day, tokens/sessions for seven days after expiry,
 * and completed email receipts for thirty days. Active and recently expired
 * records are retained. Revoked/consumed records expire naturally before removal.
 */
export async function cleanAccountRecords({limit = 500}: {limit?: number} = {}): Promise<AccountMaintenanceResult> {
  const batch = Math.min(500, Math.max(1, Math.floor(Number.isFinite(limit) ? limit : 500)));
  const now = Date.now();
  const rateCutoff = new Date(now - DAY);
  const accountCutoff = new Date(now - 7 * DAY);
  const receiptCutoff = new Date(now - 30 * DAY);
  return getDatabase().$transaction(async (database) => {
    // Query and transaction deadlines bound a scheduled request even with a backlog.
    await database.$executeRaw`SET LOCAL statement_timeout = '5s'`;
    const rateLimits = await database.$executeRaw`
      WITH candidates AS (
        SELECT "key" FROM "auth_rate_limits" WHERE "expiresAt" < ${rateCutoff}
        ORDER BY "expiresAt", "key" FOR UPDATE SKIP LOCKED LIMIT ${batch}
      )
      DELETE FROM "auth_rate_limits" WHERE "key" IN (SELECT "key" FROM candidates)
        AND "expiresAt" < ${rateCutoff}
    `;
    const verificationTokens = await database.$executeRaw`
      WITH candidates AS (
        SELECT "id" FROM "email_verification_tokens" WHERE "expiresAt" < ${accountCutoff}
        ORDER BY "expiresAt", "id" FOR UPDATE SKIP LOCKED LIMIT ${batch}
      )
      DELETE FROM "email_verification_tokens" WHERE "id" IN (SELECT "id" FROM candidates)
        AND "expiresAt" < ${accountCutoff}
    `;
    const resetTokens = await database.$executeRaw`
      WITH candidates AS (
        SELECT "id" FROM "password_reset_tokens" WHERE "expiresAt" < ${accountCutoff}
        ORDER BY "expiresAt", "id" FOR UPDATE SKIP LOCKED LIMIT ${batch}
      )
      DELETE FROM "password_reset_tokens" WHERE "id" IN (SELECT "id" FROM candidates)
        AND "expiresAt" < ${accountCutoff}
    `;
    const sessions = await database.$executeRaw`
      WITH candidates AS (
        SELECT "id" FROM "sessions" WHERE "expires" < ${accountCutoff}
        ORDER BY "expires", "id" FOR UPDATE SKIP LOCKED LIMIT ${batch}
      )
      DELETE FROM "sessions" WHERE "id" IN (SELECT "id" FROM candidates)
        AND "expires" < ${accountCutoff}
    `;
    const emailReceipts = await database.$executeRaw`
      WITH candidates AS (
        SELECT "id" FROM "background_jobs"
        WHERE "kind" = ${ACCOUNT_EMAIL_JOB} AND "status" IN ('SUCCEEDED', 'DEAD_LETTER')
          AND "completedAt" < ${receiptCutoff}
        ORDER BY "completedAt", "id" FOR UPDATE SKIP LOCKED LIMIT ${batch}
      )
      DELETE FROM "background_jobs" WHERE "id" IN (SELECT "id" FROM candidates)
        AND "kind" = ${ACCOUNT_EMAIL_JOB} AND "status" IN ('SUCCEEDED', 'DEAD_LETTER')
        AND "completedAt" < ${receiptCutoff}
    `;
    return {rateLimits, verificationTokens, resetTokens, sessions, emailReceipts};
  }, {maxWait: 2_000, timeout: 10_000});
}
