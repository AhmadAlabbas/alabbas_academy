import { randomUUID, randomBytes } from "node:crypto";
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import mariadb from "mariadb";
vi.mock("server-only", () => ({}));
import { getDatabase } from "@/lib/db";
import { cleanAccountRecords } from "@/lib/auth/maintenance";
const configured = process.env.ACADEMY_TEST_DATABASE_URL,
  day = (n: number) => new Date(Date.now() + n * 86400000),
  key = () => randomBytes(32).toString("hex");
describe.skipIf(!configured)("MariaDB account retention", () => {
  let userId: string;
  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", configured!);
    userId = (
      await getDatabase().user.create({
        data: { email: `retention-${randomUUID()}@example.test` },
      })
    ).id;
  });
  beforeEach(async () => {
    const db = getDatabase();
    await db.authRateLimit.deleteMany();
    await db.emailVerificationToken.deleteMany({ where: { userId } });
    await db.passwordResetToken.deleteMany({ where: { userId } });
    await db.session.deleteMany({ where: { userId } });
    await db.backgroundJob.deleteMany({
      where: { deduplicationKey: { startsWith: "retention-" } },
    });
  });
  afterAll(async () => {
    await getDatabase().$disconnect();
    vi.unstubAllEnvs();
  });
  it("preserves active/recent windows, tokens, sessions and pending jobs", async () => {
    const db = getDatabase(),
      stale = key(),
      recent = key(),
      active = key();
    await db.authRateLimit.createMany({
      data: [
        { key: stale, expiresAt: day(-2) },
        { key: recent, expiresAt: day(-0.5) },
        { key: active, expiresAt: day(1) },
      ],
    });
    await db.emailVerificationToken.createMany({
      data: [-8, -1, 1].map((n) => ({
        userId,
        email: "retention@example.test",
        tokenHash: key(),
        expiresAt: day(n),
      })),
    });
    await db.passwordResetToken.createMany({
      data: [-8, -1, 1].map((n) => ({
        userId,
        tokenHash: key(),
        expiresAt: day(n),
      })),
    });
    await db.session.createMany({
      data: [-8, -1, 1].map((n) => ({
        userId,
        tokenHash: key(),
        expires: day(n),
        sessionVersion: 0,
      })),
    });
    await db.backgroundJob.createMany({
      data: [
        {
          kind: "ACCOUNT_EMAIL",
          deduplicationKey: "retention-old",
          payload: {},
          status: "SUCCEEDED",
          completedAt: day(-31),
        },
        {
          kind: "ACCOUNT_EMAIL",
          deduplicationKey: "retention-future",
          payload: {},
          status: "PENDING",
          createdAt: day(-40),
        },
        {
          kind: "ACCOUNT_EMAIL",
          deduplicationKey: "retention-recent",
          payload: {},
          status: "SUCCEEDED",
          completedAt: day(-1),
        },
      ],
    });
    expect(await cleanAccountRecords()).toEqual({
      rateLimits: 1,
      verificationTokens: 1,
      resetTokens: 1,
      sessions: 1,
      emailReceipts: 1,
    });
    expect(await db.authRateLimit.count()).toBe(2);
    expect(await db.emailVerificationToken.count({ where: { userId } })).toBe(
      2,
    );
    expect(
      await db.backgroundJob.findUnique({
        where: { deduplicationKey: "retention-future" },
      }),
    ).not.toBeNull();
  });
  it("bounds concurrent batches without duplicate deletion or lost counters", async () => {
    const db = getDatabase();
    await db.authRateLimit.createMany({
      data: Array.from({ length: 7 }, () => ({
        key: key(),
        expiresAt: day(-2),
      })),
    });
    const runs = await Promise.all([
      cleanAccountRecords({ limit: 2 }),
      cleanAccountRecords({ limit: 2 }),
    ]);
    expect(runs.map((r) => r.rateLimits)).toEqual([2, 2]);
    expect(await db.authRateLimit.count()).toBe(3);
    expect((await cleanAccountRecords({ limit: 2 })).rateLimits).toBe(2);
    expect((await cleanAccountRecords({ limit: 2 })).rateLimits).toBe(1);
  });
  it("skips a locked counter being renewed and preserves the new active window", async () => {
    const id = key(),
      db = getDatabase();
    await db.authRateLimit.create({ data: { key: id, expiresAt: day(-2) } });
    const u = new URL(configured!),
      connection = await mariadb.createConnection({
        host: u.hostname,
        port: Number(u.port),
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: u.pathname.slice(1),
      });
    try {
      await connection.beginTransaction();
      await connection.query(
        "UPDATE auth_rate_limits SET expiresAt=? WHERE `key`=?",
        [day(1), id],
      );
      expect((await cleanAccountRecords()).rateLimits).toBe(0);
      await connection.commit();
      expect((await cleanAccountRecords()).rateLimits).toBe(0);
      expect(
        await db.authRateLimit.findUnique({ where: { key: id } }),
      ).not.toBeNull();
    } finally {
      await connection.rollback();
      await connection.end();
    }
  });
});
