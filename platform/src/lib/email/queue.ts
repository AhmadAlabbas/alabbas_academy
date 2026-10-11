import "server-only";
import {createHash} from "node:crypto";
import type {Prisma} from "@/generated/prisma/client";
import {AccountEmailError, emailConfigurationReady} from "./config";
import {sealEmailPayload, type AccountEmailInput} from "./payload";

export const ACCOUNT_EMAIL_JOB = "ACCOUNT_EMAIL";

/** Use the caller's transaction so an account token and its encrypted email commit together. */
export async function enqueueAccountEmail(transaction: Prisma.TransactionClient, input: AccountEmailInput): Promise<string> {
  if (!emailConfigurationReady()) throw new AccountEmailError("EMAIL_CONFIGURATION_UNAVAILABLE");
  const tokenHash = createHash("sha256").update(input.token).digest("hex");
  let expiresAt = new Date(Date.now() + (input.kind === "VERIFY_EMAIL" ? 24 * 60 * 60_000 : 30 * 60_000));
  if (input.userId) {
    const token = input.kind === "VERIFY_EMAIL"
      ? await transaction.emailVerificationToken.findUnique({where: {tokenHash}, select: {userId: true, email: true, expiresAt: true, consumedAt: true}})
      : await transaction.passwordResetToken.findUnique({where: {tokenHash}, select: {userId: true, expiresAt: true, consumedAt: true, user: {select: {email: true}}}});
    const tokenEmail = token && ("email" in token ? token.email : token.user.email);
    if (!token || token.userId !== input.userId || tokenEmail !== input.to || token.consumedAt || token.expiresAt.getTime() <= Date.now()) {
      throw new AccountEmailError("EMAIL_TOKEN_UNAVAILABLE");
    }
    expiresAt = token.expiresAt;
  }
  const payload = sealEmailPayload({...input, expiresAt: expiresAt.toISOString()});
  const job = await transaction.backgroundJob.upsert({
    where: {deduplicationKey: `account-email:${input.kind}:${tokenHash}`},
    create: {
      kind: ACCOUNT_EMAIL_JOB,
      deduplicationKey: `account-email:${input.kind}:${tokenHash}`,
      payload,
      maximumAttempts: 5,
      availableAt: new Date(),
    },
    update: {},
    select: {id: true},
  });
  return job.id;
}
