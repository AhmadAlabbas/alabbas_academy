import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("server-only", () => ({}));
const {ready, deliver} = vi.hoisted(() => ({ready: vi.fn(), deliver: vi.fn()}));
vi.mock("@/lib/email", () => ({emailConfigurationReady: ready, deliverPendingAccountEmails: deliver}));

import {POST} from "@/app/api/jobs/email/route";

const secret = "worker-secret-with-at-least-32-characters";
function request(authorization?: string, query = ""): Request {
  return new Request(`https://academy.example/api/jobs/email${query}`, {
    method: "POST", headers: authorization ? {Authorization: authorization} : {},
  });
}

beforeEach(() => {
  vi.stubEnv("JOB_WORKER_SECRET", secret);
  ready.mockReturnValue(true);
  deliver.mockResolvedValue({sent: 1, retried: 0, discarded: 0});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("account email worker authorization", () => {
  it.each([undefined, "Bearer wrong-key", `Basic ${secret}`, "Bearer ", `Bearer ${secret} extra`])("rejects an absent or incorrect header %s", async (header) => {
    const response = await POST(request(header));
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(deliver).not.toHaveBeenCalled();
    expect(ready).not.toHaveBeenCalled();
  });

  it("never accepts a secret supplied in the public URL", async () => {
    expect((await POST(request(undefined, `?token=${secret}`))).status).toBe(401);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("rejects weak or whitespace-only configured credentials", async () => {
    vi.stubEnv("JOB_WORKER_SECRET", "short");
    expect((await POST(request("Bearer short"))).status).toBe(401);
    vi.stubEnv("JOB_WORKER_SECRET", " ".repeat(64));
    expect((await POST(request(`Bearer ${" ".repeat(64)}`))).status).toBe(401);
  });

  it("returns only redacted delivery counters after authorized bounded processing", async () => {
    const response = await POST(request(`Bearer ${secret}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({sent: 1, retried: 0, discarded: 0});
    expect(deliver).toHaveBeenCalledWith({limit: 5});
  });

  it("fails closed for unavailable provider configuration", async () => {
    ready.mockReturnValue(false);
    const response = await POST(request(`Bearer ${secret}`));
    expect(response.status).toBe(503);
    expect(deliver).not.toHaveBeenCalled();
  });

  it("redacts unexpected database and provider failures", async () => {
    deliver.mockRejectedValue(new Error("private database url, email address and token"));
    const response = await POST(request(`Bearer ${secret}`));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({error: "Email service unavailable"});
  });
});
