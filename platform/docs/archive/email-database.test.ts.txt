import {createHash, randomBytes, randomUUID} from "node:crypto";
import {mkdtemp, rm, stat} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {Pool} from "pg";
import {PrismaPg} from "@prisma/adapter-pg";
import {afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi} from "vitest";
import {PrismaClient} from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));
let database: PrismaClient;
vi.mock("@/lib/db", () => ({getDatabase: () => database}));

import {deliverPendingAccountEmails, enqueueAccountEmail} from "@/lib/email";
import {sealEmailPayload, type AccountEmailInput} from "@/lib/email/payload";

const testUrl = process.env.EMAIL_TEST_DATABASE_URL;
const schema = `email_test_${randomUUID().replaceAll("-", "")}`;
let administrator: Pool | undefined;
let directory: string | undefined;

async function fixture(kind: AccountEmailInput["kind"] = "VERIFY_EMAIL") {
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const user = await database.user.create({data: {email: `email-worker-${randomUUID()}@example.test`, name: "Email test learner"}});
  const input: AccountEmailInput = {kind, to: user.email, name: user.name, locale: "ar", token, userId: user.id};
  const jobId = await database.$transaction(async (transaction) => {
    if (kind === "VERIFY_EMAIL") {
      await transaction.emailVerificationToken.create({data: {userId: user.id, email: user.email, tokenHash, expiresAt: new Date(Date.now() + 86_400_000)}});
    } else {
      await transaction.passwordResetToken.create({data: {userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 1_800_000)}});
    }
    return enqueueAccountEmail(transaction, input);
  });
  return {jobId, input, tokenHash, user};
}

async function job(jobId: string) {
  return database.backgroundJob.findUniqueOrThrow({where: {id: jobId}});
}

function expectScrubbed(payload: unknown) {
  expect(payload).not.toHaveProperty("ciphertext");
  expect(payload).not.toHaveProperty("token");
}

describe.skipIf(!testUrl)("account email PostgreSQL integration (explicit local database; isolated schema)", () => {
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Email integration tests require an explicit local test database.");
    administrator = new Pool({connectionString: testUrl, max: 1});
    // Each run has empty copies of four tables in a unique schema. The existing
    // application's users, jobs, migrations, and outbox remain untouched.
    await administrator.query(`CREATE SCHEMA "${schema}"`);
    for (const enumeration of ["Locale", "UserStatus", "JobStatus"] as const) {
      const labels = await administrator.query<{enumlabel: string}>(
        "SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid JOIN pg_namespace ON pg_type.typnamespace = pg_namespace.oid WHERE pg_namespace.nspname = 'public' AND pg_type.typname = $1 ORDER BY enumsortorder",
        [enumeration],
      );
      const values = labels.rows.map(({enumlabel}) => `'${enumlabel.replaceAll("'", "''")}'`).join(", ");
      await administrator.query(`CREATE TYPE "${schema}"."${enumeration}" AS ENUM (${values})`);
    }
    for (const table of ["users", "email_verification_tokens", "password_reset_tokens", "background_jobs"] as const) {
      await administrator.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    }
    // Prisma qualifies enum casts with its configured schema as well as tables.
    for (const [table, column, enumeration, defaultValue] of [
      ["users", "preferredLocale", "Locale", "ar"], ["users", "status", "UserStatus", "ACTIVE"],
      ["background_jobs", "status", "JobStatus", "PENDING"],
    ] as const) {
      await administrator.query(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${column}" DROP DEFAULT`);
      await administrator.query(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${column}" TYPE "${schema}"."${enumeration}" USING "${column}"::text::"${schema}"."${enumeration}"`);
      await administrator.query(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${column}" SET DEFAULT '${defaultValue}'::"${schema}"."${enumeration}"`);
    }
    url.searchParams.set("options", `-csearch_path=${schema},public`);
    database = new PrismaClient({adapter: new PrismaPg({connectionString: url.toString(), max: 10}, {schema})});
    directory = await mkdtemp(join(tmpdir(), "academy-email-database-"));
    vi.spyOn(process, "cwd").mockReturnValue(directory);
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_SECRET", randomBytes(32).toString("hex"));
    vi.stubEnv("AUTH_URL", "http://localhost:3001");
  });

  beforeEach(() => {
    vi.stubEnv("EMAIL_TRANSPORT", "outbox");
    vi.stubEnv("RESEND_API_KEY", "re_integration-test");
    vi.stubEnv("EMAIL_FROM", "accounts@example.test");
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (!database) return;
    await database.backgroundJob.deleteMany();
    await database.emailVerificationToken.deleteMany();
    await database.passwordResetToken.deleteMany();
    await database.user.deleteMany();
    if (directory) await rm(join(directory, ".local"), {recursive: true, force: true});
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    if (database) await database.$disconnect();
    if (administrator) {
      await administrator.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await administrator.end();
    }
    if (directory) await rm(directory, {recursive: true, force: true});
  });

  it("rolls back both token and queue entry when the account transaction fails", async () => {
    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const user = await database.user.create({data: {email: `rollback-${randomUUID()}@example.test`}});
    await expect(database.$transaction(async (transaction) => {
      await transaction.emailVerificationToken.create({data: {userId: user.id, email: user.email, tokenHash, expiresAt: new Date(Date.now() + 86_400_000)}});
      await enqueueAccountEmail(transaction, {kind: "VERIFY_EMAIL", to: user.email, locale: "en", token, userId: user.id});
      throw new Error("intentional account rollback");
    })).rejects.toThrow("intentional account rollback");
    expect(await database.emailVerificationToken.count()).toBe(0);
    expect(await database.backgroundJob.count()).toBe(0);
  });

  it("deduplicates repeated enqueue and copies the token's exact expiry", async () => {
    const value = await fixture();
    expect(await database.$transaction((transaction) => enqueueAccountEmail(transaction, value.input))).toBe(value.jobId);
    expect(await database.backgroundJob.count()).toBe(1);
    const token = await database.emailVerificationToken.findUniqueOrThrow({where: {tokenHash: value.tokenHash}});
    const persisted = await job(value.jobId);
    expect(persisted.payload).toHaveProperty("expiresAt", token.expiresAt.toISOString());
    expect(JSON.stringify(persisted.payload)).not.toContain(value.input.token);
    expect(JSON.stringify(persisted.payload)).not.toContain(value.input.to);
  });

  it("claims one job once across simultaneous PostgreSQL workers and scrubs successful payloads", async () => {
    const value = await fixture();
    const results = await Promise.all([deliverPendingAccountEmails({limit: 1}), deliverPendingAccountEmails({limit: 1})]);
    expect(results.reduce((sum, result) => sum + result.sent, 0)).toBe(1);
    const delivered = await job(value.jobId);
    expect(delivered.status).toBe("SUCCEEDED");
    expect(delivered.attempts).toBe(1);
    expectScrubbed(delivered.payload);
    expect((await stat(join(directory!, ".local/mail/outbox", `${value.jobId}.json`))).mode & 0o077).toBe(0);
  });

  it("discards a consumed token before sending an email", async () => {
    const value = await fixture();
    await database.emailVerificationToken.update({where: {tokenHash: value.tokenHash}, data: {consumedAt: new Date()}});
    expect((await deliverPendingAccountEmails({limit: 1})).discarded).toBe(1);
    const discarded = await job(value.jobId);
    expect(discarded.status).toBe("DEAD_LETTER");
    expect(discarded.lastError).toBe("EMAIL_TOKEN_UNAVAILABLE");
    expectScrubbed(discarded.payload);
    await expect(stat(join(directory!, ".local/mail/outbox", `${value.jobId}.json`))).rejects.toHaveProperty("code", "ENOENT");
  });

  it("clears expired encrypted payloads without consuming a delivery attempt", async () => {
    const value = await fixture();
    await database.backgroundJob.update({where: {id: value.jobId}, data: {payload: sealEmailPayload({...value.input, expiresAt: new Date(Date.now() - 1_000).toISOString()})}});
    expect((await deliverPendingAccountEmails({limit: 1})).discarded).toBe(1);
    const discarded = await job(value.jobId);
    expect(discarded.attempts).toBe(0);
    expect(discarded.status).toBe("DEAD_LETTER");
    expectScrubbed(discarded.payload);
  });

  it("recovers a stale lease from a worker that crashed", async () => {
    const value = await fixture();
    await database.backgroundJob.update({where: {id: value.jobId}, data: {status: "RUNNING", attempts: 1, lockedAt: new Date(Date.now() - 180_000), lockedBy: "crashed-worker"}});
    expect((await deliverPendingAccountEmails({limit: 1})).sent).toBe(1);
    expect((await job(value.jobId)).attempts).toBe(2);
    expect((await job(value.jobId)).lockedBy).toBeNull();
  });

  it("persists provider failure with backoff and reuses its idempotency key on retry", async () => {
    const value = await fixture("RESET_PASSWORD");
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    const provider = vi.fn().mockResolvedValue(new Response(`sensitive ${value.input.token}`, {status: 503}));
    vi.stubGlobal("fetch", provider);
    expect((await deliverPendingAccountEmails({limit: 1})).retried).toBe(1);
    const failed = await job(value.jobId);
    expect(failed.status).toBe("FAILED");
    expect(failed.attempts).toBe(1);
    expect(failed.lastError).toBe("EMAIL_PROVIDER_FAILED");
    expect(failed.availableAt.getTime()).toBeGreaterThan(Date.now() + 50_000);
    expect(failed.payload).toHaveProperty("ciphertext");
    expect(JSON.stringify(failed)).not.toContain(value.input.token);
    await database.backgroundJob.update({where: {id: value.jobId}, data: {availableAt: new Date(Date.now() - 1_000)}});
    provider.mockResolvedValue(Response.json({id: "provider-receipt"}));
    expect((await deliverPendingAccountEmails({limit: 1})).sent).toBe(1);
    expect(provider.mock.calls[0][1].headers["Idempotency-Key"]).toBe(provider.mock.calls[1][1].headers["Idempotency-Key"]);
    expect((await job(value.jobId)).attempts).toBe(2);
    expectScrubbed((await job(value.jobId)).payload);
  });

  it("stops after the fifth provider failure and removes sensitive payloads", async () => {
    const value = await fixture();
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("provider failure", {status: 500})));
    await database.backgroundJob.update({where: {id: value.jobId}, data: {attempts: 4}});
    expect((await deliverPendingAccountEmails({limit: 1})).discarded).toBe(1);
    const discarded = await job(value.jobId);
    expect(discarded.attempts).toBe(5);
    expect(discarded.status).toBe("DEAD_LETTER");
    expectScrubbed(discarded.payload);
  });

  it("clears an exhausted crashed job instead of making a sixth attempt", async () => {
    const value = await fixture();
    await database.backgroundJob.update({where: {id: value.jobId}, data: {status: "RUNNING", attempts: 5, lockedAt: new Date(Date.now() - 180_000), lockedBy: "crashed-worker"}});
    expect((await deliverPendingAccountEmails({limit: 1})).discarded).toBe(1);
    const discarded = await job(value.jobId);
    expect(discarded.attempts).toBe(5);
    expect(discarded.status).toBe("DEAD_LETTER");
    expectScrubbed(discarded.payload);
  });

  it("rejects a corrupted encrypted payload and retains only a redacted receipt", async () => {
    const value = await fixture();
    await database.backgroundJob.update({where: {id: value.jobId}, data: {payload: {version: 1, iv: "invalid", tag: "invalid", ciphertext: "corrupted", expiresAt: new Date(Date.now() + 86_400_000).toISOString()}}});
    expect((await deliverPendingAccountEmails({limit: 1})).discarded).toBe(1);
    const discarded = await job(value.jobId);
    expect(discarded.lastError).toBe("EMAIL_PAYLOAD_UNREADABLE");
    expectScrubbed(discarded.payload);
  });
});
