import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";

vi.mock("server-only", () => ({}));
const cleanup = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/maintenance", () => ({cleanAccountRecords: cleanup}));
import {POST} from "@/app/api/jobs/account-maintenance/route";
import {authorizedWorkerRequest} from "@/lib/jobs/authorization";

const secret = "private-test-worker-key-over-32-characters";
const counts = {rateLimits: 1, verificationTokens: 2, resetTokens: 3, sessions: 4, emailReceipts: 5};

beforeEach(() => {
  vi.stubEnv("JOB_WORKER_SECRET", secret);
  vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
  cleanup.mockReset().mockResolvedValue(counts);
});
afterEach(() => vi.unstubAllEnvs());

describe("account maintenance worker authorization", () => {
  it.each([undefined, "Bearer incorrect-worker-key", `Basic ${secret}`, `Bearer  ${secret}`, "Bearer " + "x".repeat(1024)])("denies invalid authorization without running cleanup: %s", async (authorization) => {
    const headers = authorization ? {authorization} : undefined;
    const request = new Request(`https://academy.example/api/jobs/account-maintenance?key=${secret}`, {method: "POST", headers});
    const response = await POST(request);
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(cleanup).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain(secret);
  });

  it("fails closed for an absent or weak configured worker key", () => {
    const request = new Request("https://academy.example/api/jobs/email", {headers: {authorization: `Bearer ${secret}`}});
    for (const configured of ["", "short", ` ${secret}`]) {
      vi.stubEnv("JOB_WORKER_SECRET", configured);
      expect(authorizedWorkerRequest(request)).toBe(false);
    }
  });

  it("returns only bounded cleanup counts to an authenticated scheduler", async () => {
    const request = new Request("https://academy.example/api/jobs/account-maintenance", {method: "POST", headers: {authorization: `Bearer ${secret}`}});
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(counts);
    expect(cleanup).toHaveBeenCalledExactlyOnceWith();
  });

  it("reports unavailable storage without leaking connection errors or credentials", async () => {
    const request = new Request("https://academy.example/api/jobs/account-maintenance", {method: "POST", headers: {authorization: `Bearer ${secret}`}});
    vi.stubEnv("DATABASE_URL", "");
    expect((await POST(request)).status).toBe(503);
    expect(cleanup).not.toHaveBeenCalled();
    vi.stubEnv("DATABASE_URL", "postgresql://localhost/test");
    cleanup.mockRejectedValue(new Error(`private connection error ${secret}`));
    const response = await POST(request);
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain(secret);
  });
});
