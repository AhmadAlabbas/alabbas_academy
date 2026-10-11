import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("server-only", () => ({}));
import { getDatabase } from "@/lib/db";
import {
  queueNotification,
  sendPendingNotifications,
} from "@/lib/email/notifications";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { cleanAccountRecords } from "@/lib/auth/maintenance";
const configured = process.env.ACADEMY_TEST_DATABASE_URL;
describe.skipIf(!configured)("MariaDB durable queues and rate limits", () => {
  beforeAll(() => {
    vi.stubEnv("DATABASE_URL", configured!);
    vi.stubEnv("AUTH_SECRET", "isolated-email-test-secret".repeat(3));
    vi.stubEnv("AUTH_URL", "http://localhost:3001");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3001");
    vi.stubEnv("EMAIL_TRANSPORT", "outbox");
  });
  afterAll(async () => {
    await getDatabase().$disconnect();
    vi.unstubAllEnvs();
  });
  it("seals notification PII and deduplicates job creation and simultaneous delivery", async () => {
    const key = randomUUID(),
      message = {
        to: "private-mail@example.com",
        subject: "Test",
        text: "Secret receipt information",
      };
    await Promise.all([
      queueNotification(key, message),
      queueNotification(key, message),
    ]);
    const db = getDatabase(),
      job = await db.backgroundJob.findUniqueOrThrow({
        where: { deduplicationKey: key },
      });
    expect(JSON.stringify(job.payload)).not.toContain(message.to);
    expect(JSON.stringify(job.payload)).not.toContain(message.text);
    await Promise.all([
      sendPendingNotifications(10),
      sendPendingNotifications(10),
    ]);
    const delivered = await db.backgroundJob.findUniqueOrThrow({
      where: { id: job.id },
    });
    expect(delivered.status).toBe("SUCCEEDED");
    expect(delivered.attempts).toBe(1);
  });
  it("allows exactly the configured limit across concurrent requests", async () => {
    const identity = randomUUID();
    const result = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        consumeRateLimit("concurrent", identity, 3, 60),
      ),
    );
    expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(result.filter((r) => r.status === "rejected")).toHaveLength(7);
  });
  it("removes expired limits while retaining active limits", async () => {
    const db = getDatabase(),
      old = randomUUID(),
      active = randomUUID();
    await db.authRateLimit.createMany({
      data: [
        {
          key: old,
          attempts: 1,
          expiresAt: new Date(Date.now() - 2 * 86400000),
        },
        { key: active, attempts: 1, expiresAt: new Date(Date.now() + 60000) },
      ],
    });
    await cleanAccountRecords();
    expect(
      await db.authRateLimit.findUnique({ where: { key: old } }),
    ).toBeNull();
    expect(
      await db.authRateLimit.findUnique({ where: { key: active } }),
    ).not.toBeNull();
  });
});
