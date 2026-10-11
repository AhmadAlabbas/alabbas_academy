import "server-only";
import {randomUUID} from "node:crypto";
import {constants} from "node:fs";
import {link, mkdir, open, readdir, unlink} from "node:fs/promises";
import {resolve} from "node:path";
import {AccountEmailError, configuredEmailTransport} from "./config";
import type {AccountEmailPayload} from "./payload";
import {renderAccountEmail} from "./template";
import nodemailer from "nodemailer";

export type EmailDeliveryReceipt = {transport: "smtp" | "resend" | "outbox"};

function outboxDirectory(): string {
  return resolve(process.cwd(), ".local/mail/outbox");
}

/** Local testing must not keep expired one-time links indefinitely. */
export async function removeExpiredOutboxMessages(): Promise<void> {
  if (process.env.EMAIL_TRANSPORT !== "outbox" || process.env.NODE_ENV === "production") return;
  const directory = outboxDirectory();
  const entries = await readdir(directory, {withFileTypes: true}).catch(() => []);
  for (const entry of entries) {
    if (!entry.isFile() || !/^[A-Za-z0-9_-]+\.(json|tmp)$/.test(entry.name)) continue;
    const filename = resolve(directory, entry.name);
    let file;
    try {
      file = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
      if (entry.name.endsWith(".tmp") && (await file.stat()).mtimeMs < Date.now() - 120_000) {
        await unlink(filename);
        continue;
      }
      const message = JSON.parse(await file.readFile("utf8")) as {expiresAt?: unknown};
      if (typeof message.expiresAt === "string" && Date.parse(message.expiresAt) <= Date.now()) await unlink(filename);
    } catch {
      // A malformed development artifact must not affect durable job processing.
    } finally {
      await file?.close();
    }
  }
}

export async function deliverAccountEmail(jobId: string, payload: AccountEmailPayload): Promise<EmailDeliveryReceipt> {
  const transport = configuredEmailTransport();
  const rendered = renderAccountEmail(payload);
  if (transport === "smtp") {
    await smtpSend({to:payload.to,...rendered});
    return {transport};
  }
  if (transport === "outbox") {
    // Explicit development-only transport. These files contain one-time tokens;
    // they are ignored by Git and must never be served by a public route.
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(jobId)) throw new AccountEmailError("EMAIL_JOB_INVALID");
    const directory = outboxDirectory();
    await mkdir(directory, {recursive: true, mode: 0o700});
    const filename = resolve(directory, `${jobId}.json`);
    const temporary = resolve(directory, `${jobId}-${randomUUID()}.tmp`);
    let file;
    try {
      file = await open(temporary, "wx", 0o600);
      await file.writeFile(JSON.stringify({jobId, to: payload.to, expiresAt: payload.expiresAt, ...rendered}, null, 2), "utf8");
      await file.sync();
      await file.close();
      file = undefined;
      await link(temporary, filename);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") {
        throw new AccountEmailError("EMAIL_OUTBOX_UNAVAILABLE");
      }
      const existing = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        const stats = await existing.stat();
        const message = JSON.parse(await existing.readFile("utf8")) as {jobId?: unknown; to?: unknown; text?: unknown};
        if (!stats.isFile() || (stats.mode & 0o077) !== 0 || message.jobId !== jobId || message.to !== payload.to || message.text !== rendered.text) throw new AccountEmailError("EMAIL_OUTBOX_UNAVAILABLE");
      } finally {
        await existing.close();
      }
      // Atomic per-job files make development retries idempotent even after a crash.
    } finally {
      await file?.close();
      await unlink(temporary).catch(() => undefined);
    }
    return {transport};
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `account-email/${jobId}`,
      },
      body: JSON.stringify({from: process.env.EMAIL_FROM, to: [payload.to], subject: rendered.subject, html: rendered.html, text: rendered.text}),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
  } catch {
    throw new AccountEmailError("EMAIL_PROVIDER_UNREACHABLE");
  }
  if (!response.ok) {
    throw new AccountEmailError(response.status === 429 ? "EMAIL_PROVIDER_RATE_LIMITED" : "EMAIL_PROVIDER_FAILED");
  }
  // Do not treat an unrelated HTML response or malformed success as delivery.
  const receipt = await response.json().catch(() => null) as {id?: unknown} | null;
  if (!receipt || typeof receipt.id !== "string" || !receipt.id) throw new AccountEmailError("EMAIL_PROVIDER_INVALID_RECEIPT");
  return {transport};
}

export async function smtpSend(message:{to:string;subject:string;html:string;text:string}) {
  const smtp=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||465),secure:process.env.SMTP_SECURE !== 'false',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD},connectionTimeout:7000,greetingTimeout:7000,socketTimeout:10000,requireTLS:process.env.SMTP_SECURE === 'false'});
  try { const receipt=await smtp.sendMail({from:process.env.EMAIL_FROM,...message}); if(!receipt.accepted?.length)throw new Error('Rejected'); }
  catch {throw new AccountEmailError('EMAIL_PROVIDER_FAILED');}
  finally{smtp.close();}
}
