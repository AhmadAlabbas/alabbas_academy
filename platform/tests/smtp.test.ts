import { afterEach, describe, it, expect, vi } from "vitest";
const transport = vi.hoisted(() => ({ sendMail: vi.fn(), close: vi.fn() }));
const createTransport = vi.hoisted(() =>
  vi.fn((options: Record<string, unknown>) => {
    void options;
    return transport;
  }),
);
vi.mock("server-only", () => ({}));
vi.mock("nodemailer", () => ({ default: { createTransport } }));
import { smtpSend } from "@/lib/email/delivery";
import { configuredEmailTransport } from "@/lib/email/config";
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});
function configure() {
  vi.stubEnv("EMAIL_TRANSPORT", "smtp");
  vi.stubEnv("SMTP_HOST", "smtp.hostinger.com");
  vi.stubEnv("SMTP_PORT", "465");
  vi.stubEnv("SMTP_SECURE", "true");
  vi.stubEnv("SMTP_USER", "hello@example.test");
  vi.stubEnv("SMTP_PASSWORD", "private-test-password");
  vi.stubEnv("EMAIL_FROM", "Academy <hello@example.test>");
}
describe("bounded SMTP delivery", () => {
  it("requires sender and private mailbox configuration", () => {
    configure();
    expect(configuredEmailTransport()).toBe("smtp");
    vi.stubEnv("SMTP_PASSWORD", "");
    expect(() => configuredEmailTransport()).toThrow(
      "EMAIL_PROVIDER_UNAVAILABLE",
    );
  });
  it("uses verified TLS and bounded connections without a worker pool", async () => {
    configure();
    transport.sendMail.mockResolvedValue({
      accepted: ["learner@example.test"],
    });
    await smtpSend({
      to: "learner@example.test",
      subject: "Verification",
      html: "<p>Verify</p>",
      text: "Verify",
    });
    const options = createTransport.mock.calls[0][0] as Record<string, unknown>;
    expect(options.secure).toBe(true);
    expect(options.socketTimeout).toBe(10000);
    expect(options).not.toHaveProperty("pool");
    expect(options).not.toHaveProperty("tls");
    expect(transport.close).toHaveBeenCalledOnce();
  });
  it("requires STARTTLS on port 587", async () => {
    configure();
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_SECURE", "false");
    transport.sendMail.mockResolvedValue({
      accepted: ["learner@example.test"],
    });
    await smtpSend({
      to: "learner@example.test",
      subject: "Verification",
      html: "<p>Verify</p>",
      text: "Verify",
    });
    expect(createTransport.mock.calls[0][0]).toMatchObject({
      secure: false,
      requireTLS: true,
      port: 587,
    });
  });
  it("rejects unsuccessful delivery, closes transport and redacts provider errors", async () => {
    configure();
    transport.sendMail.mockRejectedValue(
      Error("secret SMTP password in provider error"),
    );
    await expect(
      smtpSend({
        to: "learner@example.test",
        subject: "Verification",
        html: "<p>Verify</p>",
        text: "Verify",
      }),
    ).rejects.toThrow("EMAIL_PROVIDER_FAILED");
    expect(transport.close).toHaveBeenCalledOnce();
  });
});
