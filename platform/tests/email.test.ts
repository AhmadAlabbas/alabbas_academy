import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {mkdtemp, readFile, readdir, rm, stat, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";

vi.mock("server-only", () => ({}));

import {accountEmailOrigin, emailConfigurationReady} from "@/lib/email/config";
import {openEmailPayload, sealEmailPayload, type AccountEmailPayload} from "@/lib/email/payload";
import {renderAccountEmail} from "@/lib/email/template";
import {deliverAccountEmail, removeExpiredOutboxMessages} from "@/lib/email/delivery";
import {emailRetryDelay} from "@/lib/email/worker";

const payload: AccountEmailPayload = {
  kind: "VERIFY_EMAIL", to: "student@example.com", name: 'Ahmed <script>alert("x")</script> & friends',
  locale: "ar", token: "a".repeat(64), userId: "user-1", expiresAt: "2030-01-01T00:00:00.000Z",
};
const secret = "local-test-secret-that-has-at-least-32-characters";
let directory: string | undefined;

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("AUTH_SECRET", secret);
  vi.stubEnv("AUTH_URL", "http://localhost:3001");
  vi.stubEnv("EMAIL_TRANSPORT", "outbox");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("EMAIL_FROM", "");
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  if (directory) await rm(directory, {recursive: true, force: true});
  directory = undefined;
});

describe("account email configuration", () => {
  it("requires an explicit local transport and sufficient encryption secret", () => {
    expect(emailConfigurationReady()).toBe(true);
    vi.stubEnv("AUTH_SECRET", "short");
    expect(emailConfigurationReady()).toBe(false);
    vi.stubEnv("AUTH_SECRET", secret);
    vi.stubEnv("EMAIL_TRANSPORT", "");
    expect(emailConfigurationReady()).toBe(false);
  });

  it("never enables the development outbox in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_URL", "https://academy.example");
    expect(emailConfigurationReady()).toBe(false);
  });

  it("requires a real provider key and valid sender for production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTH_URL", "https://academy.example");
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test-key");
    vi.stubEnv("EMAIL_FROM", "Alabbas Academy <accounts@academy.example>");
    expect(emailConfigurationReady()).toBe(true);
    vi.stubEnv("EMAIL_FROM", "Alabbas Academy <accounts@academy.example");
    expect(emailConfigurationReady()).toBe(false);
    vi.stubEnv("EMAIL_FROM", "accounts@academy.example\r\nBcc: somebody@example.com");
    expect(emailConfigurationReady()).toBe(false);
  });

  it.each([
    "javascript:alert(1)", "https://user:secret@academy.example", "https://academy.example/path",
    "https://academy.example?next=bad", "https://academy.example#bad", "http://academy.example",
  ])("rejects a non-origin or unsafe account URL: %s", (origin) => {
    vi.stubEnv("AUTH_URL", origin);
    expect(emailConfigurationReady()).toBe(false);
    expect(() => accountEmailOrigin()).toThrow("EMAIL_ORIGIN_INVALID");
  });

  it("uses the configured public origin only when AUTH_URL is unset", () => {
    vi.stubEnv("AUTH_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://academy.example");
    expect(accountEmailOrigin()).toBe("https://academy.example");
  });
});

describe("sealed email payloads", () => {
  it("round trips without persisting token, recipient, or URL in the job JSON", () => {
    const sealed = sealEmailPayload(payload);
    const persisted = JSON.stringify(sealed);
    expect(persisted).not.toContain(payload.token);
    expect(persisted).not.toContain(payload.to);
    expect(persisted).not.toContain("http");
    expect(openEmailPayload(sealed)).toEqual(payload);
    expect(sealEmailPayload(payload).ciphertext).not.toBe(sealed.ciphertext);
  });

  it.each(["ciphertext", "tag", "iv", "expiresAt"] as const)("authenticates %s against tampering", (field) => {
    const sealed = sealEmailPayload(payload);
    const changed = field === "expiresAt" ? "2031-01-01T00:00:00.000Z" : `${sealed[field].startsWith("A") ? "B" : "A"}${sealed[field].slice(1)}`;
    expect(() => openEmailPayload({...sealed, [field]: changed})).toThrow("EMAIL_PAYLOAD_UNREADABLE");
  });

  it("fails closed after key rotation and for invalid recipients or tokens", () => {
    const sealed = sealEmailPayload(payload);
    vi.stubEnv("AUTH_SECRET", "a-different-test-secret-over-32-characters");
    expect(() => openEmailPayload(sealed)).toThrow("EMAIL_PAYLOAD_UNREADABLE");
    expect(() => sealEmailPayload({...payload, to: "malicious\r\nBcc: somebody@example.com"})).toThrow("EMAIL_PAYLOAD_INVALID");
    expect(() => sealEmailPayload({...payload, token: "x"})).toThrow("EMAIL_PAYLOAD_INVALID");
  });
});

describe("bilingual account email templates", () => {
  it("escapes personalized HTML and provides a correct RTL verification link", () => {
    const email = renderAccountEmail(payload);
    expect(email.html).toContain('lang="ar" dir="rtl"');
    expect(email.html).toContain("&lt;script&gt;");
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("24 ساعة");
    expect(email.text).toContain(`http://localhost:3001/ar/verify-email?token=${payload.token}`);
    expect(email.html).toContain("#19243c");
    expect(email.html).toContain("#79cae7");
    expect(email.html).toContain("#f2cf8d");
  });

  it("provides an English reset with the thirty-minute expiry and trusted origin", () => {
    vi.stubEnv("AUTH_URL", "https://academy.example");
    const email = renderAccountEmail({...payload, kind: "RESET_PASSWORD", locale: "en", name: null});
    expect(email.html).toContain('lang="en" dir="ltr"');
    expect(email.subject).toBe("Reset your password — Alabbas Academy");
    expect(email.text).toContain(`https://academy.example/en/reset-password?token=${payload.token}`);
    expect(email.text).toContain("expires in 30 minutes");
    expect(email.text).toContain("Do not share this link");
    expect(email.text).not.toContain(payload.to);
  });
});

describe("account email delivery", () => {
  beforeEach(() => {
    vi.stubEnv("EMAIL_TRANSPORT", "resend");
    vi.stubEnv("RESEND_API_KEY", "re_test-key");
    vi.stubEnv("EMAIL_FROM", "accounts@academy.example");
  });

  it("uses a fixed provider endpoint, bounded timeout, and stable per-job idempotency key", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({id: "provider-id"}), {status: 200}));
    vi.stubGlobal("fetch", fetcher);
    expect(await deliverAccountEmail("job-123", payload)).toEqual({transport: "resend"});
    const [endpoint, request] = fetcher.mock.calls[0];
    expect(endpoint).toBe("https://api.resend.com/emails");
    expect(request.headers["Idempotency-Key"]).toBe("account-email/job-123");
    expect(request.redirect).toBe("error");
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(request.body).to).toEqual([payload.to]);
  });

  it.each([429, 500, 403])("rejects provider failure %s without copying sensitive provider messages", async (status) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(`sensitive ${payload.token}`, {status})));
    await expect(deliverAccountEmail("job-123", payload)).rejects.toThrow(status === 429 ? "EMAIL_PROVIDER_RATE_LIMITED" : "EMAIL_PROVIDER_FAILED");
  });

  it("rejects network failure and malformed success instead of declaring delivery", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error(`secret: ${payload.token}`)));
    await expect(deliverAccountEmail("job-123", payload)).rejects.toThrow("EMAIL_PROVIDER_UNREACHABLE");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", {status: 200})));
    await expect(deliverAccountEmail("job-123", payload)).rejects.toThrow("EMAIL_PROVIDER_INVALID_RECEIPT");
  });

  it("writes private atomic development messages and reuses a per-job file on retry", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "outbox");
    directory = await mkdtemp(join(tmpdir(), "academy-email-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(directory);
    await deliverAccountEmail("job-123", payload);
    await deliverAccountEmail("job-123", payload);
    const filename = join(directory, ".local/mail/outbox/job-123.json");
    expect((await stat(filename)).mode & 0o077).toBe(0);
    expect(JSON.parse(await readFile(filename, "utf8")).text).toContain(payload.token);
    expect(await readdir(join(directory, ".local/mail/outbox"))).toEqual(["job-123.json"]);
    await expect(deliverAccountEmail("../public/mail", payload)).rejects.toThrow("EMAIL_JOB_INVALID");
  });

  it("deletes expired local links while retaining messages that can still be used", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "outbox");
    directory = await mkdtemp(join(tmpdir(), "academy-email-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(directory);
    await deliverAccountEmail("job-123", payload);
    const outbox = join(directory, ".local/mail/outbox");
    await writeFile(join(outbox, "expired.json"), JSON.stringify({expiresAt: "2020-01-01T00:00:00.000Z"}), {mode: 0o600});
    await writeFile(join(outbox, "expired-write.tmp"), JSON.stringify({expiresAt: "2020-01-01T00:00:00.000Z"}), {mode: 0o600});
    await removeExpiredOutboxMessages();
    expect(await readdir(outbox)).toEqual(["job-123.json"]);
  });

  it("uses exponential bounded retry delays", () => {
    expect([1, 2, 3, 4, 5, 100].map(emailRetryDelay)).toEqual([60_000, 120_000, 240_000, 480_000, 900_000, 900_000]);
  });
});
