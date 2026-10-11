import "server-only";
import { getDatabase } from "@/lib/db";
export type AccountMaintenanceResult = {
  rateLimits: number;
  verificationTokens: number;
  resetTokens: number;
  sessions: number;
  emailReceipts: number;
};
export async function cleanAccountRecords({
  limit = 500,
}: { limit?: number } = {}): Promise<AccountMaintenanceResult> {
  const take = Math.min(
    500,
    Math.max(1, Math.floor(Number.isFinite(limit) ? limit : 500)),
  );
  const db = getDatabase();
  const old = new Date(Date.now() - 7 * 86400000);
  return db.$transaction(
    async (tx) => {
      // MariaDB 10.6+/MySQL 8: skip live locks instead of stalling account requests.
      const rateCutoff = new Date(Date.now() - 86400000),
        receiptCutoff = new Date(Date.now() - 30 * 86400000);
      const rates = await tx.$queryRaw<
        { key: string }[]
      >`SELECT \`key\` FROM auth_rate_limits WHERE expiresAt < ${rateCutoff} ORDER BY expiresAt LIMIT ${take} FOR UPDATE SKIP LOCKED`;
      const verify = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM email_verification_tokens WHERE expiresAt < ${old} ORDER BY expiresAt LIMIT ${take} FOR UPDATE SKIP LOCKED`;
      const reset = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM password_reset_tokens WHERE expiresAt < ${old} ORDER BY expiresAt LIMIT ${take} FOR UPDATE SKIP LOCKED`;
      const sessions = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM sessions WHERE expires < ${old} ORDER BY expires LIMIT ${take} FOR UPDATE SKIP LOCKED`;
      const jobs = await tx.$queryRaw<
        { id: string }[]
      >`SELECT id FROM background_jobs WHERE kind='ACCOUNT_EMAIL' AND status IN ('SUCCEEDED','DEAD_LETTER') AND completedAt < ${receiptCutoff} ORDER BY completedAt LIMIT ${take} FOR UPDATE SKIP LOCKED`;
      return {
        rateLimits: (
          await tx.authRateLimit.deleteMany({
            where: {
              key: { in: rates.map((x) => x.key) },
              expiresAt: { lt: new Date(Date.now() - 86400000) },
            },
          })
        ).count,
        verificationTokens: (
          await tx.emailVerificationToken.deleteMany({
            where: {
              id: { in: verify.map((x) => x.id) },
              expiresAt: { lt: old },
            },
          })
        ).count,
        resetTokens: (
          await tx.passwordResetToken.deleteMany({
            where: {
              id: { in: reset.map((x) => x.id) },
              expiresAt: { lt: old },
            },
          })
        ).count,
        sessions: (
          await tx.session.deleteMany({
            where: {
              id: { in: sessions.map((x) => x.id) },
              expires: { lt: old },
            },
          })
        ).count,
        emailReceipts: (
          await tx.backgroundJob.deleteMany({
            where: {
              id: { in: jobs.map((x) => x.id) },
              kind: "ACCOUNT_EMAIL",
              status: { in: ["SUCCEEDED", "DEAD_LETTER"] },
            },
          })
        ).count,
      };
    },
    { timeout: 10000 },
  );
}
