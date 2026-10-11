import { randomBytes, randomUUID, createHash } from "node:crypto";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/generated/prisma/client";
vi.mock("server-only", () => ({}));
let database: PrismaClient;
let directory: string;
vi.mock("@/lib/db", () => ({ getDatabase: () => database }));
import { enqueueAccountEmail } from "@/lib/email/queue";
import { deliverPendingAccountEmails } from "@/lib/email/worker";
import { sealEmailPayload, type AccountEmailInput } from "@/lib/email/payload";
const testUrl = process.env.ACADEMY_TEST_DATABASE_URL;
const job = (id: string) =>
  database.backgroundJob.findUniqueOrThrow({ where: { id } });
function expectScrubbed(payload: unknown) {
  expect(payload).not.toHaveProperty("ciphertext");
  expect(payload).not.toHaveProperty("iv");
}
async function fixture(kind: AccountEmailInput["kind"] = "VERIFY_EMAIL") {
  const user = await database.user.create({
      data: { email: `delivery-${randomUUID()}@example.test` },
    }),
    token = randomBytes(32).toString("hex"),
    tokenHash = createHash("sha256").update(token).digest("hex"),
    expiresAt = new Date(Date.now() + 86400000);
  const input: AccountEmailInput = {
    kind,
    userId: user.id,
    to: user.email,
    locale: "en",
    token,
  };
  const jobId = await database.$transaction(async (tx) => {
    if (kind === "VERIFY_EMAIL")
      await tx.emailVerificationToken.create({
        data: { userId: user.id, email: user.email, tokenHash, expiresAt },
      });
    else
      await tx.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
      });
    return enqueueAccountEmail(tx, input);
  });
  return { input, jobId, tokenHash };
}
describe.skipIf(!testUrl)("MariaDB account email request delivery", () => {
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (
      !["localhost", "127.0.0.1"].includes(url.hostname) ||
      !url.pathname.startsWith("/academy_test_")
    )
      throw Error("Isolated local database required");
    database = new PrismaClient({ adapter: new PrismaMariaDb(testUrl!) });
    directory = await mkdtemp(join(tmpdir(), "academy-delivery-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(directory);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_SECRET", "isolated-delivery-secret".repeat(3));
    vi.stubEnv("AUTH_URL", "http://localhost:3001");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001");
    vi.stubEnv("RESEND_API_KEY", "re_isolated_test_key");
    vi.stubEnv("EMAIL_FROM", "Academy <academy@example.test>");
  });
  beforeEach(async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "outbox");
    await database.backgroundJob.deleteMany({
      where: { kind: "ACCOUNT_EMAIL" },
    });
    await database.user.deleteMany({
      where: { email: { startsWith: "delivery-" } },
    });
    await database.user.deleteMany({
      where: { email: { startsWith: "rollback-" } },
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => {
    await database?.$disconnect();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  it("rolls back both token and queue entry when the account transaction fails", async () => {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const user = await database.user.create({
      data: { email: `rollback-${randomUUID()}@example.test` },
    });
    await expect(
      database.$transaction(async (transaction) => {
        await transaction.emailVerificationToken.create({
          data: {
            userId: user.id,
            email: user.email,
            tokenHash,
            expiresAt: new Date(Date.now() + 86_400_000),
          },
        });
        await enqueueAccountEmail(transaction, {
          kind: "VERIFY_EMAIL",
          to: user.email,
          locale: "en",
          token,
          userId: user.id,
        });
        throw new Error("intentional account rollback");
      }),
    ).rejects.toThrow("intentional account rollback");
    expect(await database.emailVerificationToken.count({where: {userId: user.id}})).toBe(0);
    // Other suites can leave receipt/contact notifications in this shared test
    // database. Only the account queue participates in this transaction.
    expect(await database.backgroundJob.count({where: {kind: 'ACCOUNT_EMAIL'}})).toBe(0);
  });

  it("deduplicates repeated enqueue and copies the token's exact expiry", async () => {
    const value = await fixture();
    expect(
      await database.$transaction((transaction) =>
        enqueueAccountEmail(transaction, value.input),
      ),
    ).toBe(value.jobId);
    expect(await database.backgroundJob.count({where: {kind: 'ACCOUNT_EMAIL'}})).toBe(1);
    const token = await database.emailVerificationToken.findUniqueOrThrow({
      where: { tokenHash: value.tokenHash },
    });
    const persisted = await job(value.jobId);
    expect(persisted.payload).toHaveProperty(
      "expiresAt",
      token.expiresAt.toISOString(),
    );
    expect(JSON.stringify(persisted.payload)).not.toContain(value.input.token);
    expect(JSON.stringify(persisted.payload)).not.toContain(value.input.to);
  });

  it("claims one job once across simultaneous MariaDB request handlers and scrubs successful payloads", async () => {
    const value = await fixture();
    const results = await Promise.all([
      deliverPendingAccountEmails({ limit: 1 }),
      deliverPendingAccountEmails({ limit: 1 }),
    ]);
    expect(results.reduce((sum, result) => sum + result.sent, 0)).toBe(1);
    const delivered = await job(value.jobId);
    expect(delivered.status).toBe("SUCCEEDED");
    expect(delivered.attempts).toBe(1);
    expectScrubbed(delivered.payload);
    expect(
      (
        await stat(
          join(directory!, ".local/mail/outbox", `${value.jobId}.json`),
        )
      ).mode & 0o077,
    ).toBe(0);
  });

  it("discards a consumed token before sending an email", async () => {
    const value = await fixture();
    await database.emailVerificationToken.update({
      where: { tokenHash: value.tokenHash },
      data: { consumedAt: new Date() },
    });
    expect((await deliverPendingAccountEmails({ limit: 1 })).discarded).toBe(1);
    const discarded = await job(value.jobId);
    expect(discarded.status).toBe("DEAD_LETTER");
    expect(discarded.lastError).toBe("EMAIL_TOKEN_UNAVAILABLE");
    expectScrubbed(discarded.payload);
    await expect(
      stat(join(directory!, ".local/mail/outbox", `${value.jobId}.json`)),
    ).rejects.toHaveProperty("code", "ENOENT");
  });

  it("clears expired encrypted payloads without consuming a delivery attempt", async () => {
    const value = await fixture();
    await database.backgroundJob.update({
      where: { id: value.jobId },
      data: {
        payload: sealEmailPayload({
          ...value.input,
          expiresAt: new Date(Date.now() - 1_000).toISOString(),
        }),
      },
    });
    expect((await deliverPendingAccountEmails({ limit: 1 })).discarded).toBe(1);
    const discarded = await job(value.jobId);
    expect(discarded.attempts).toBe(0);
    expect(discarded.status).toBe("DEAD_LETTER");
    expectScrubbed(discarded.payload);
  });

  it("recovers a stale lease from a worker that crashed", async () => {
    const value = await fixture();
    await database.backgroundJob.update({
      where: { id: value.jobId },
      data: {
        status: "RUNNING",
        attempts: 1,
        lockedAt: new Date(Date.now() - 180_000),
        lockedBy: "crashed-worker",
      },
    });
    expect((await deliverPendingAccountEmails({ limit: 1 })).sent).toBe(1);
    expect((await job(value.jobId)).attempts).toBe(2);
    expect((await job(value.jobId)).lockedBy).toBeNull();
  });

  it("persists provider failure with backoff and reuses its idempotency key on retry", async () => {
    const value = await fixture("RESET_PASSWORD");
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    const provider = vi
      .fn()
      .mockResolvedValue(
        new Response(`sensitive ${value.input.token}`, { status: 503 }),
      );
    vi.stubGlobal("fetch", provider);
    expect((await deliverPendingAccountEmails({ limit: 1 })).retried).toBe(1);
    const failed = await job(value.jobId);
    expect(failed.status).toBe("FAILED");
    expect(failed.attempts).toBe(1);
    expect(failed.lastError).toBe("EMAIL_PROVIDER_FAILED");
    expect(failed.availableAt.getTime()).toBeGreaterThan(Date.now() + 50_000);
    expect(failed.payload).toHaveProperty("ciphertext");
    expect(JSON.stringify(failed)).not.toContain(value.input.token);
    await database.backgroundJob.update({
      where: { id: value.jobId },
      data: { availableAt: new Date(Date.now() - 1_000) },
    });
    provider.mockResolvedValue(Response.json({ id: "provider-receipt" }));
    expect((await deliverPendingAccountEmails({ limit: 1 })).sent).toBe(1);
    expect(provider.mock.calls[0][1].headers["Idempotency-Key"]).toBe(
      provider.mock.calls[1][1].headers["Idempotency-Key"],
    );
    expect((await job(value.jobId)).attempts).toBe(2);
    expectScrubbed((await job(value.jobId)).payload);
  });

  it("stops after the fifth provider failure and removes sensitive payloads", async () => {
    const value = await fixture();
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response("provider failure", { status: 500 })),
    );
    await database.backgroundJob.update({
      where: { id: value.jobId },
      data: { attempts: 4 },
    });
    expect((await deliverPendingAccountEmails({ limit: 1 })).discarded).toBe(1);
    const discarded = await job(value.jobId);
    expect(discarded.attempts).toBe(5);
    expect(discarded.status).toBe("DEAD_LETTER");
    expectScrubbed(discarded.payload);
  });

  it("clears an exhausted crashed job instead of making a sixth attempt", async () => {
    const value = await fixture();
    await database.backgroundJob.update({
      where: { id: value.jobId },
      data: {
        status: "RUNNING",
        attempts: 5,
        lockedAt: new Date(Date.now() - 180_000),
        lockedBy: "crashed-worker",
      },
    });
    expect((await deliverPendingAccountEmails({ limit: 1 })).discarded).toBe(1);
    const discarded = await job(value.jobId);
    expect(discarded.attempts).toBe(5);
    expect(discarded.status).toBe("DEAD_LETTER");
    expectScrubbed(discarded.payload);
  });

  it("rejects a corrupted encrypted payload and retains only a redacted receipt", async () => {
    const value = await fixture();
    await database.backgroundJob.update({
      where: { id: value.jobId },
      data: {
        payload: {
          version: 1,
          iv: "invalid",
          tag: "invalid",
          ciphertext: "corrupted",
          expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        },
      },
    });
    expect((await deliverPendingAccountEmails({ limit: 1 })).discarded).toBe(1);
    const discarded = await job(value.jobId);
    expect(discarded.lastError).toBe("EMAIL_PAYLOAD_UNREADABLE");
    expectScrubbed(discarded.payload);
  });
});
