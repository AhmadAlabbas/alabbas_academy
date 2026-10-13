import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const database = new URL(process.env.ACADEMY_TEST_DATABASE_URL || 'mysql://invalid');
assert.ok(database.protocol === 'mysql:' && ['localhost', '127.0.0.1', '[::1]'].includes(database.hostname), 'Browser release checks require a migrated and seeded loopback test database. Hosted databases are refused.');
const probe = createServer();
await new Promise((resolve, reject) => {probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve);});
const port = probe.address().port;
await new Promise(resolve => probe.close(resolve));
const base = `http://127.0.0.1:${port}`;
const uploads = await mkdtemp(path.join(tmpdir(), 'academy-browser-uploads-'));
const secret = randomBytes(48).toString('base64url');
const children = [];
let status = 1;
try {
  const server = spawn(process.execPath, ['server.js'], {cwd: root, stdio: 'ignore', env: {
    ...process.env, DATABASE_URL: database.href, PORT: String(port), ACADEMY_HOST: '127.0.0.1',
    AUTH_URL: base, AUTH_SECRET: secret, NEXT_PUBLIC_APP_URL: base, UPLOAD_DIR: uploads, PAYMENTS_ENABLED: 'false',
    // No real email or payment provider is contacted by preview checks.
    SMTP_USER: '', SMTP_PASSWORD: '', RESEND_API_KEY: '', GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
  }});
  children.push(server);
  let spawnError;
  server.once('error', error => {spawnError = error;});
  let ready = false;
  for (let attempt = 0; attempt < 200; attempt++) {
    assert.equal(spawnError, undefined, 'Preview process must start');
    assert.equal(server.exitCode, null, 'Preview process must remain running');
    assert.equal(server.signalCode, null, 'Preview process must remain running');
    try {
      ready = (await fetch(base + '/api/health', {signal: AbortSignal.timeout(1000)})).status === 200;
      if (ready) break;
    } catch { /* Startup may still be in progress. */ }
    await delay(100);
  }
  assert.ok(ready, 'Production preview must connect to its local test database');
  for (const args of [
    ['scripts/check-deployment.mjs', '--url', base, '--environment', process.env.ACADEMY_ENVIRONMENT === 'staging' ? 'staging' : 'production', '--canonical-origin', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'],
    ['scripts/test-theme-navigation.mjs'],
    ['scripts/test-admin-builder.mjs'],
    ['scripts/test-pricing-browser.mjs'],
  ].filter(args => (!process.argv.includes('--admin-only') || args[0] === 'scripts/test-admin-builder.mjs') && (!process.argv.includes('--pricing-only') || args[0] === 'scripts/test-pricing-browser.mjs'))) {
    const check = spawn(process.execPath, args, {cwd: root, stdio: 'inherit', env: {...process.env, AUTH_SECRET: secret, ACADEMY_TEST_BASE_URL: base}});
    children.push(check);
    const result = await new Promise((resolve, reject) => {check.once('error', reject); check.once('exit', code => resolve(code ?? 1));});
    if (result !== 0) {status = result; break;}
    status = 0;
  }
} finally {
  for (const child of children.reverse()) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    await new Promise(resolve => {
      const timeout = setTimeout(() => child.kill('SIGKILL'), 5000);
      timeout.unref();
      child.once('exit', () => {clearTimeout(timeout); resolve();});
      child.kill('SIGTERM');
    });
  }
  await rm(uploads, {recursive: true, force: true});
}
process.exit(status);
