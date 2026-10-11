import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
await access(path.join(root, ".next/standalone/server.js"));

async function freePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = probe.address().port;
  await new Promise((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
    timer.unref();
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

for (const mode of ["Hostinger require", "direct Node", "repository-root require"]) {
  test(mode + " serves the built preview", { timeout: 45000 }, async () => {
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    const entry = path.join(root, mode === "repository-root require" ? "../server.js" : "server.js");
    const args = mode === "direct Node" ? [entry] : ["-e", `require(${JSON.stringify(entry)})`];
    const child = spawn(process.execPath, ["--unhandled-rejections=strict", ...args], {
      cwd: root,
      stdio: "ignore",
      env: {
        ...process.env,
        NODE_ENV: "production",
        PORT: String(port),
        DATABASE_URL: "",
        AUTH_SECRET: "",
        AUTH_URL: base,
        NEXT_PUBLIC_APP_URL: base,
        PAYMENTS_ENABLED: "false",
      },
    });
    let spawnError;
    child.once("error", (error) => { spawnError = error; });
    try {
      let ready = false;
      const deadline = Date.now() + 30000;
      while (Date.now() < deadline) {
        assert.equal(spawnError, undefined, "Node process must start");
        assert.equal(child.exitCode, null, "Entry must remain running after loading");
        assert.equal(child.signalCode, null, "Entry must remain running after loading");
        try {
          const response = await fetch(base + "/ar", { signal: AbortSignal.timeout(1000) });
          const html = await response.text();
          if (response.status === 200 && html.includes("<h1")) {
            ready = true;
            break;
          }
        } catch { /* The process may still be starting. */ }
        await delay(100);
      }
      assert.ok(ready, "Entry must honor the injected PORT and serve the homepage");
      for (const route of ["/ar", "/en", "/ar/login", "/en/signup", "/en/cart"]) {
        const response = await fetch(base + route, { signal: AbortSignal.timeout(5000) });
        assert.equal(response.status, 200, route);
        const html = await response.text();
        assert.ok(html.includes("<h1"), route + " must render");
        const stylesheet = html.match(/href="([^"<>]*\/_next\/static\/[^"<>]+\.css[^"<>]*)"/);
        assert.ok(stylesheet, route + " must include a production stylesheet");
        const css = await fetch(new URL(stylesheet[1].replaceAll("&amp;", "&"), base), { signal: AbortSignal.timeout(5000) });
        assert.equal(css.status, 200, "Production CSS must be available");
        assert.ok((await css.text()).length > 100);
      }
      const health = await fetch(base + "/api/health", { signal: AbortSignal.timeout(5000) });
      assert.equal(health.status, 503, "Missing database must remain visible in health status");
      const body = await health.json();
      assert.equal(body.database, "unconfigured");
      assert.equal(body.ok, false);
      assert.equal(body.paymentsEnabled, false);
    } finally {
      await stop(child);
    }
  });
}
