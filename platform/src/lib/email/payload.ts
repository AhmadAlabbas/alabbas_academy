import "server-only";
import {createCipheriv, createDecipheriv, hkdfSync, randomBytes} from "node:crypto";
import {AccountEmailError, emailEncryptionSecret} from "./config";

export type AccountEmailKind = "VERIFY_EMAIL" | "RESET_PASSWORD";
export type AccountEmailInput = {
  kind: AccountEmailKind;
  to: string;
  name?: string | null;
  locale: "ar" | "en";
  token: string;
  userId?: string;
};
export type AccountEmailPayload = AccountEmailInput & {expiresAt: string};
export type SealedEmailPayload = {
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
  expiresAt: string;
};

function encryptionKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", emailEncryptionSecret(), "alabbas-academy", "account-email-payload:v1", 32));
}

function additionalData(expiresAt: string): Buffer {
  return Buffer.from(`alabbas-account-email:v1:${expiresAt}`, "utf8");
}

export function validateEmailPayload(value: unknown): AccountEmailPayload {
  if (!value || typeof value !== "object") throw new AccountEmailError("EMAIL_PAYLOAD_INVALID");
  const payload = value as AccountEmailPayload;
  if (
    !["VERIFY_EMAIL", "RESET_PASSWORD"].includes(payload.kind) ||
    !["ar", "en"].includes(payload.locale) ||
    typeof payload.to !== "string" ||
    payload.to.length > 254 ||
    !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(payload.to) ||
    typeof payload.token !== "string" ||
    !/^[A-Za-z0-9_-]{32,256}$/.test(payload.token) ||
    (payload.name !== undefined && payload.name !== null && (typeof payload.name !== "string" || payload.name.length > 120)) ||
    (payload.userId !== undefined && (typeof payload.userId !== "string" || payload.userId.length > 128)) ||
    typeof payload.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(payload.expiresAt)) ||
    new Date(payload.expiresAt).toISOString() !== payload.expiresAt
  ) throw new AccountEmailError("EMAIL_PAYLOAD_INVALID");
  return payload;
}

export function sealEmailPayload(value: AccountEmailPayload): SealedEmailPayload {
  const payload = validateEmailPayload(value);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(additionalData(payload.expiresAt));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return {
    version: 1,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
    expiresAt: payload.expiresAt,
  };
}

export function openEmailPayload(value: unknown): AccountEmailPayload {
  try {
    const sealed = value as SealedEmailPayload;
    if (!sealed || sealed.version !== 1 || typeof sealed.iv !== "string" || typeof sealed.tag !== "string" || typeof sealed.ciphertext !== "string" || typeof sealed.expiresAt !== "string") {
      throw new Error("invalid envelope");
    }
    const iv = Buffer.from(sealed.iv, "base64url");
    const tag = Buffer.from(sealed.tag, "base64url");
    if (iv.length !== 12 || tag.length !== 16 || sealed.ciphertext.length > 8192) throw new Error("invalid envelope");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAAD(additionalData(sealed.expiresAt));
    decipher.setAuthTag(tag);
    const bytes = Buffer.concat([decipher.update(Buffer.from(sealed.ciphertext, "base64url")), decipher.final()]);
    const payload = validateEmailPayload(JSON.parse(bytes.toString("utf8")));
    if (payload.expiresAt !== sealed.expiresAt) throw new Error("invalid expiry");
    return payload;
  } catch {
    throw new AccountEmailError("EMAIL_PAYLOAD_UNREADABLE");
  }
}
