import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import mariadb from "mariadb";
import { encode } from "next-auth/jwt";

// Exercise the actual production route, fonts and access checks after moving
// standalone output away from the checkout. Only local test databases are allowed.
const root = fileURLToPath(new URL("../", import.meta.url));
const url = new URL(process.env.ACADEMY_TEST_DATABASE_URL || "mysql://invalid");
assert.ok(
  url.protocol === "mysql:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname),
  "Set ACADEMY_TEST_DATABASE_URL to a migrated and seeded local MySQL database; hosted databases are refused.",
);
const db = await mariadb.createConnection({
  host: url.hostname,
  port: Number(url.port || 3306),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  database: decodeURIComponent(url.pathname.slice(1)),
});
const directory = await mkdtemp(path.join(tmpdir(), "academy-certificate-"));
const userIds = [randomUUID(), randomUUID()];
const enrollmentId = randomUUID();
const certificateId = randomUUID();
const serial = "TEST-" + randomUUID();
let child;
try {
  const [course] = await db.query("SELECT id FROM courses LIMIT 1");
  assert.ok(course, "Seed the local database before running this check.");
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const secret = randomBytes(48).toString("base64url");
  const cookies = [];
  for (const userId of userIds) {
    await db.query(
      "INSERT INTO users (id,email,emailVerified,updatedAt) VALUES (?,?,NOW(),NOW())",
      [userId, `certificate-${userId}@example.test`],
    );
    const sessionId = randomUUID();
    const sessionSecret = randomBytes(32).toString("hex");
    await db.query(
      "INSERT INTO sessions (id,tokenHash,userId,expires,sessionVersion) VALUES (?,?,?,DATE_ADD(NOW(),INTERVAL 1 HOUR),0)",
      [sessionId, createHash("sha256").update(sessionSecret).digest("hex"), userId],
    );
    const cookieName = "authjs.session-token";
    const token = await encode({
      secret,
      salt: cookieName,
      token: { sub: userId, sessionId, sessionSecret, sessionVersion: 0 },
      maxAge: 3600,
    });
    cookies.push(`${cookieName}=${token}`);
  }
  await db.query(
    "INSERT INTO enrollments (id,userId,courseId,status,source,completedAt) VALUES (?,?,?,'COMPLETED','test',NOW())",
    [enrollmentId, userIds[0], course.id],
  );
  await db.query(
    "INSERT INTO certificates (id,enrollmentId,serial,verificationHash,learnerName,courseTitleAr,courseTitleEn) VALUES (?,?,?,?,?,?,?)",
    [certificateId, enrollmentId, serial, randomBytes(32).toString("hex"), "أحمد العباس", "أساسيات التصميم البصري", "Visual Design Fundamentals"],
  );
  await cp(path.join(root, ".next/standalone"), directory, { recursive: true });
  const routeFile = path.join(directory, ".next/server/app/api/certificates/[id]/route.js");
  // A build-machine URL cannot exist on Hostinger. Simulate that absence even
  // when this check runs on the original build machine, without moving sources.
  const buildFontModule = pathToFileURL(path.join(root, "node_modules/pdfkit/js/pdfkit.node.mjs")).href;
  const route = await readFile(routeFile, "utf8");
  await writeFile(routeFile, route.replaceAll(buildFontModule, "file:///unavailable-build-machine/node_modules/pdfkit/js/pdfkit.node.mjs"));
  child = spawn(process.execPath, [path.join(directory, "server.js")], {
    cwd: directory,
    stdio: "ignore",
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      DATABASE_URL: url.href,
      AUTH_SECRET: secret,
      AUTH_URL: base,
      NEXT_PUBLIC_APP_URL: base,
      EMAIL_TRANSPORT: "outbox",
      PAYMENTS_ENABLED: "false",
    },
  });
  let ready = false;
  for (let i = 0; i < 150; i++) {
    assert.equal(child.exitCode, null, "Production server must remain running");
    try {
      if ((await fetch(base + "/api/health", { signal: AbortSignal.timeout(1000) })).status === 200) {
        ready = true;
        break;
      }
    } catch { /* Wait for startup. */ }
    await delay(100);
  }
  assert.ok(ready, "Relocated standalone build must start with the local database");
  const download = (cookie) => fetch(base + "/api/certificates/" + certificateId, {
    headers: cookie ? { cookie } : {},
    signal: AbortSignal.timeout(10000),
  });
  assert.equal((await download()).status, 401, "Anonymous requests must be denied");
  assert.equal((await download(cookies[1])).status, 403, "Another learner cannot download this certificate");
  for (const name of ["أحمد العباس", "Ahmed Alabbas"]) {
    await db.query("UPDATE certificates SET learnerName=? WHERE id=?", [name, certificateId]);
    const response = await download(cookies[0]);
    assert.equal(response.status, 200, "Completed learner must receive the PDF for " + name);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.equal(response.headers.get("content-disposition"), `attachment; filename="${serial}.pdf"`);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    const pdf = Buffer.from(await response.arrayBuffer());
    assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
    assert.ok(pdf.length > 5000, "PDF must contain embedded Arabic and Latin fonts");
    assert.ok(pdf.includes(Buffer.from("%%EOF")), "PDF stream must finish");
  }
  await db.query("UPDATE enrollments SET status='ACTIVE' WHERE id=?", [enrollmentId]);
  assert.equal((await download(cookies[0])).status, 403, "Incomplete enrollment must be denied");
  await db.query("UPDATE enrollments SET status='COMPLETED',revokedAt=NOW() WHERE id=?", [enrollmentId]);
  assert.equal((await download(cookies[0])).status, 403, "Revoked enrollment must be denied");
  await db.query("UPDATE enrollments SET revokedAt=NULL WHERE id=?", [enrollmentId]);
  await db.query("UPDATE certificates SET revokedAt=NOW() WHERE id=?", [certificateId]);
  assert.equal((await download(cookies[0])).status, 403, "Revoked certificate must be denied");
  console.log("Passed: relocated production PDF downloads with Arabic/Latin names, download headers, and five access-denial cases.");
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    await new Promise((resolve) => {
      const timer = setTimeout(() => child.kill("SIGKILL"), 5000);
      timer.unref();
      child.once("exit", () => { clearTimeout(timer); resolve(); });
      child.kill("SIGTERM");
    });
  }
  await db.query("DELETE FROM certificates WHERE id=?", [certificateId]);
  await db.query("DELETE FROM enrollments WHERE id=?", [enrollmentId]);
  for (const id of userIds) {
    await db.query("DELETE FROM sessions WHERE userId=?", [id]);
    await db.query("DELETE FROM users WHERE id=?", [id]);
  }
  await db.end();
  await rm(directory, { recursive: true, force: true });
}
