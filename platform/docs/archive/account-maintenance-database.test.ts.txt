import {randomBytes, randomUUID} from "node:crypto";
import {Pool} from "pg";
import {PrismaPg} from "@prisma/adapter-pg";
import {afterAll, afterEach, beforeAll, describe, expect, it, vi} from "vitest";
import {PrismaClient} from "@/generated/prisma/client";

vi.mock("server-only", () => ({}));
let database: PrismaClient;
vi.mock("@/lib/db", () => ({getDatabase: () => database}));
import {cleanAccountRecords} from "@/lib/auth/maintenance";

const testUrl = process.env.ACCOUNT_MAINTENANCE_TEST_DATABASE_URL;
const schema = `account_cleanup_test_${randomUUID().replaceAll("-", "")}`;
const tables = ["auth_rate_limits", "email_verification_tokens", "password_reset_tokens", "sessions", "background_jobs"] as const;
let administrator: Pool | undefined;
let fixtures: Pool;
const DAY = 86_400_000;
const day = (offset: number) => new Date(Date.now() + offset * DAY);
const key = () => randomBytes(32).toString("hex");
const empty = {rateLimits: 0, verificationTokens: 0, resetTokens: 0, sessions: 0, emailReceipts: 0};

async function rate(expiresAt: Date) {
  const id = key();
  await fixtures.query('INSERT INTO auth_rate_limits (key, attempts, "expiresAt", "updatedAt") VALUES ($1, 20, $2, NOW())', [id, expiresAt]);
  return id;
}

async function token(table: "email_verification_tokens" | "password_reset_tokens", expiresAt: Date, consumedAt: Date | null = null) {
  const id = randomUUID();
  if (table === "email_verification_tokens") {
    await fixtures.query('INSERT INTO email_verification_tokens (id, "userId", email, "tokenHash", "expiresAt", "consumedAt") VALUES ($1, $2, $3, $4, $5, $6)', [id, "isolated-fixture-user", "fixture@example.test", key(), expiresAt, consumedAt]);
  } else {
    await fixtures.query('INSERT INTO password_reset_tokens (id, "userId", "tokenHash", "expiresAt", "consumedAt") VALUES ($1, $2, $3, $4, $5)', [id, "isolated-fixture-user", key(), expiresAt, consumedAt]);
  }
  return id;
}

async function session(expires: Date, revokedAt: Date | null = null) {
  const id = randomUUID();
  await fixtures.query('INSERT INTO sessions (id, "userId", "tokenHash", expires, "revokedAt", "sessionVersion") VALUES ($1, $2, $3, $4, $5, 0)', [id, "isolated-fixture-user", key(), expires, revokedAt]);
  return id;
}

async function receipt(status: string, completedAt: Date | null, kind = "ACCOUNT_EMAIL") {
  const id = randomUUID();
  await fixtures.query('INSERT INTO background_jobs (id, kind, payload, status, "completedAt", "updatedAt") VALUES ($1, $2, $3::jsonb, $4::"public"."JobStatus", $5, NOW())', [id, kind, JSON.stringify({type: "ACCOUNT_EMAIL_RECEIPT"}), status, completedAt]);
  return id;
}

async function remaining(table: typeof tables[number]) {
  const rows = await fixtures.query<{id: string}>(`SELECT ${table === "auth_rate_limits" ? "key" : "id"} AS id FROM "${table}"`);
  return rows.rows.map(({id}) => id).sort();
}

describe.skipIf(!testUrl)("account housekeeping PostgreSQL integration (isolated local schema)", () => {
  beforeAll(async () => {
    const url = new URL(testUrl!);
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Account housekeeping tests require an explicit local database.");
    administrator = new Pool({connectionString: testUrl, max: 1});
    await administrator.query(`CREATE SCHEMA "${schema}"`);
    // LIKE copies columns/indexes, but deliberately excludes application foreign
    // keys: all fixtures and cleanup remain in this isolated schema.
    for (const table of tables) await administrator.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    url.searchParams.set("options", `-csearch_path=${schema},public`);
    fixtures = new Pool({connectionString: url.toString(), max: 5});
    database = new PrismaClient({adapter: new PrismaPg({connectionString: url.toString(), max: 5}, {schema})});
  });
  afterEach(async () => {
    if (fixtures) for (const table of tables) await fixtures.query(`DELETE FROM "${table}"`);
  });
  afterAll(async () => {
    if (database) await database.$disconnect();
    if (fixtures) await fixtures.end();
    if (administrator) {
      await administrator.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await administrator.end();
    }
  });

  it("removes only records outside retention, preserving active and recently expired credentials/windows", async () => {
    const rates = [await rate(day(1)), await rate(day(-0.5))];
    await rate(day(-2));
    const verification = [await token("email_verification_tokens", day(1)), await token("email_verification_tokens", day(-1), day(-2))];
    await token("email_verification_tokens", day(-8), day(-9));
    const resets = [await token("password_reset_tokens", day(1)), await token("password_reset_tokens", day(-1))];
    await token("password_reset_tokens", day(-8));
    const sessions = [await session(day(1)), await session(day(-1), day(-2))];
    await session(day(-8), day(-9));
    const jobs = [await receipt("SUCCEEDED", day(-1)), await receipt("PENDING", null), await receipt("FAILED", day(-31)), await receipt("RUNNING", day(-31)), await receipt("SUCCEEDED", day(-31), "UNRELATED_JOB")];
    await receipt("SUCCEEDED", day(-31));
    await receipt("DEAD_LETTER", day(-31));
    expect(await cleanAccountRecords()).toEqual({...empty, rateLimits: 1, verificationTokens: 1, resetTokens: 1, sessions: 1, emailReceipts: 2});
    expect(await remaining("auth_rate_limits")).toEqual(rates.sort());
    expect(await remaining("email_verification_tokens")).toEqual(verification.sort());
    expect(await remaining("password_reset_tokens")).toEqual(resets.sort());
    expect(await remaining("sessions")).toEqual(sessions.sort());
    expect(await remaining("background_jobs")).toEqual(jobs.sort());
    expect(await cleanAccountRecords()).toEqual(empty);
  });

  it("bounds concurrent deletion batches and completes safely on repeat", async () => {
    await Promise.all(Array.from({length: 7}, () => rate(day(-2))));
    const runs = await Promise.all([cleanAccountRecords({limit: 2}), cleanAccountRecords({limit: 2})]);
    expect(runs.map(({rateLimits}) => rateLimits)).toEqual([2, 2]);
    expect(await remaining("auth_rate_limits")).toHaveLength(3);
    expect((await cleanAccountRecords({limit: 2})).rateLimits).toBe(2);
    expect((await cleanAccountRecords({limit: 2})).rateLimits).toBe(1);
    expect(await cleanAccountRecords({limit: 2})).toEqual(empty);
  });

  it("skips a locked rate counter being renewed and keeps the refreshed active window", async () => {
    const id = await rate(day(-2));
    const connection = await fixtures.connect();
    try {
      await connection.query("BEGIN");
      await connection.query('UPDATE auth_rate_limits SET "expiresAt" = $1 WHERE key = $2', [day(1), id]);
      expect(await cleanAccountRecords()).toEqual(empty);
      await connection.query("COMMIT");
      expect(await cleanAccountRecords()).toEqual(empty);
      expect(await remaining("auth_rate_limits")).toEqual([id]);
    } finally {
      await connection.query("ROLLBACK");
      connection.release();
    }
  });
});
