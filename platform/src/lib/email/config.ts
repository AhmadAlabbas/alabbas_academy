import "server-only";

export type EmailTransport = "smtp" | "resend" | "outbox";

export class AccountEmailError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "AccountEmailError";
  }
}

/** Only configured origins may appear in account links; never trust request headers. */
export function accountEmailOrigin(): string {
  const configured = process.env.AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!configured) throw new AccountEmailError("EMAIL_ORIGIN_UNAVAILABLE");
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new AccountEmailError("EMAIL_ORIGIN_INVALID");
  }
  const developmentLoopback =
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
    url.protocol === "http:";
  if (
    (url.protocol !== "https:" && !developmentLoopback) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new AccountEmailError("EMAIL_ORIGIN_INVALID");
  }
  return url.origin;
}

export function emailEncryptionSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32 || secret.trim() !== secret) {
    throw new AccountEmailError("EMAIL_ENCRYPTION_UNAVAILABLE");
  }
  return secret;
}

export function configuredEmailTransport(): EmailTransport {
  const transport = process.env.EMAIL_TRANSPORT || "smtp";
  if (transport === "outbox" && process.env.NODE_ENV !== "production") return "outbox";
  if (transport === "smtp") {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !validSender(process.env.EMAIL_FROM || '') || ![465,587].includes(Number(process.env.SMTP_PORT || 465))) throw new AccountEmailError("EMAIL_PROVIDER_UNAVAILABLE");
    return "smtp";
  }
  if (transport !== "resend") throw new AccountEmailError("EMAIL_TRANSPORT_UNAVAILABLE");
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !/^re_[A-Za-z0-9_-]+$/.test(key) || !from || !validSender(from)) {
    throw new AccountEmailError("EMAIL_PROVIDER_UNAVAILABLE");
  }
  return "resend";
}

function validSender(value: string): boolean {
  if (value.length > 254 || /[\r\n]/.test(value)) return false;
  const displayed = /^([^<>\r\n]+) <([^<>\r\n]+)>$/.exec(value);
  const address = displayed ? displayed[2] : value;
  return /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(address);
}

/** Signup must fail closed until links and a real delivery transport are configured. */
export function emailConfigurationReady(): boolean {
  try {
    accountEmailOrigin();
    emailEncryptionSecret();
    configuredEmailTransport();
    return true;
  } catch {
    return false;
  }
}
