import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { getDatabase } from "@/lib/db";
import { configuredEmailTransport, emailEncryptionSecret } from "./config";
import { smtpSend } from "./delivery";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
export type Notification = { to: string; subject: string; text: string };
function secret() {
  return createHash("sha256")
    .update(emailEncryptionSecret() + "notifications-v1")
    .digest();
}
function encode(message: Notification) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", secret(), iv);
  const body = Buffer.concat([
    cipher.update(JSON.stringify(message), "utf8"),
    cipher.final(),
  ]);
  return {
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: body.toString("base64"),
  };
}
function decode(value: unknown): Notification {
  const p = value as ReturnType<typeof encode>;
  const cipher = createDecipheriv(
    "aes-256-gcm",
    secret(),
    Buffer.from(p.iv, "base64"),
  );
  cipher.setAuthTag(Buffer.from(p.tag, "base64"));
  return JSON.parse(
    Buffer.concat([
      cipher.update(Buffer.from(p.ciphertext, "base64")),
      cipher.final(),
    ]).toString("utf8"),
  );
}
function escape(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export async function queueNotification(
  key: string,
  message: Notification,
  tx?: Prisma.TransactionClient,
) {
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(message.to) ||
    message.subject.length > 191 ||
    message.text.length > 10000
  )
    throw new Error("INVALID_EMAIL");
  await (tx ?? getDatabase()).backgroundJob.createMany({
    data: [
      {
        kind: "NOTIFICATION_EMAIL",
        deduplicationKey: key,
        payload: encode(message),
      },
    ],
    skipDuplicates: true,
  });
}
export async function sendPendingNotifications(limit = 3) {
  let sent = 0,
    failed = 0;
  const db = getDatabase(),
    worker = randomUUID();
  const jobs = await db.backgroundJob.findMany({
    where: {
      kind: "NOTIFICATION_EMAIL",
      availableAt: { lte: new Date() },
      OR: [
        { status: { in: ["PENDING", "FAILED"] } },
        { status: "RUNNING", lockedAt: { lt: new Date(Date.now() - 120000) } },
      ],
    },
    take: Math.min(10, limit),
    orderBy: { createdAt: "asc" },
  });
  for (const job of jobs) {
    if (job.attempts >= 5) {
      await db.backgroundJob.update({
        where: { id: job.id },
        data: { status: "DEAD_LETTER", payload: { outcome: "EXHAUSTED" } },
      });
      continue;
    }
    const claimed = await db.backgroundJob.updateMany({
      where: { id: job.id, status: job.status, attempts: job.attempts },
      data: {
        status: "RUNNING",
        lockedAt: new Date(),
        lockedBy: worker,
        attempts: { increment: 1 },
      },
    });
    if (!claimed.count) continue;
    try {
      const message = decode(job.payload),
        html = `<html lang="${/[\u0600-\u06ff]/.test(message.text) ? "ar" : "en"}"><body style="font-family:Arial;background:#f5f7fa;padding:24px"><div dir="auto" style="max-width:600px;margin:auto;padding:28px;background:white;border-radius:20px;border-top:6px solid #79cae7"><h1 style="font-size:24px;color:#19243c">${escape(message.subject)}</h1><p style="white-space:pre-line;line-height:1.9">${escape(message.text)}</p><p>Alabbas Academy · أكاديمية العباس</p></div></body></html>`;
      const transport = configuredEmailTransport();
      if (transport === "smtp") await smtpSend({ ...message, html });
      else if (transport === "resend") {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
            "Idempotency-Key": job.id,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM,
            to: [message.to],
            subject: message.subject,
            text: message.text,
            html,
          }),
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        });
        if (!response.ok || !(await response.json()).id)
          throw new Error("Email failed");
      } else {
        const directory = resolve(".local/mail/notifications");
        await mkdir(directory, { recursive: true, mode: 0o700 });
        await writeFile(
          resolve(directory, job.id + ".json"),
          JSON.stringify(message),
          { mode: 0o600 },
        );
      }
      await db.backgroundJob.updateMany({
        where: { id: job.id, lockedBy: worker },
        data: {
          status: "SUCCEEDED",
          payload: { outcome: "SENT" },
          completedAt: new Date(),
          lockedBy: null,
          lockedAt: null,
          lastError: null,
        },
      });
      sent++;
    } catch {
      await db.backgroundJob.updateMany({
        where: { id: job.id, lockedBy: worker },
        data: {
          status: "FAILED",
          lockedAt: null,
          lockedBy: null,
          availableAt: new Date(Date.now() + 60000),
          lastError: "EMAIL_DELIVERY_FAILED",
        },
      });
      failed++;
    }
  }
  return { sent, failed };
}
