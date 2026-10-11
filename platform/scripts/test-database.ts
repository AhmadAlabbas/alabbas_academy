import 'dotenv/config';
import {spawnSync} from 'node:child_process';

// Opt-in integration checks must never use a hosted or production database.
const connectionString = process.env.DATABASE_URL;
let localDatabase = false;
try {
  const url = new URL(connectionString ?? '');
  localDatabase = ['postgres:', 'postgresql:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
} catch { /* Never print malformed connection strings. */ }
if (!connectionString || !localDatabase) {
  console.error('Database tests require an explicitly configured local PostgreSQL database.');
  process.exit(1);
}
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run',
  'tests/auth-database.test.ts', 'tests/cart-database.test.ts', 'tests/email-database.test.ts', 'tests/account-maintenance-database.test.ts'], {
  stdio: 'inherit',
  env: {...process.env, AUTH_TEST_DATABASE_URL: connectionString, CART_TEST_DATABASE_URL: connectionString, EMAIL_TEST_DATABASE_URL: connectionString, ACCOUNT_MAINTENANCE_TEST_DATABASE_URL: connectionString},
});
process.exit(result.status ?? 1);
