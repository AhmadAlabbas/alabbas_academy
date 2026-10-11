import "dotenv/config";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import mariadb from "mariadb";
let url: URL;
try {
  url = new URL(process.env.DATABASE_URL || "");
  if (
    url.protocol !== "mysql:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
  )
    throw Error();
} catch {
  console.error(
    "Tests require a local MySQL/MariaDB database. Hosted databases are refused.",
  );
  process.exit(1);
}
const name = "academy_test_" + randomUUID().replaceAll("-", "");
const connection = await mariadb.createConnection({
  host: url.hostname,
  port: Number(url.port) || 3306,
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
});
let status = 1;
try {
  await connection.query(
    `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  url.pathname = "/" + name;
  const env = {
    ...process.env,
    DATABASE_URL: url.href,
    AUTH_TEST_DATABASE_URL: url.href,
    ACADEMY_TEST_DATABASE_URL: url.href,
    CART_TEST_DATABASE_URL: url.href,
  };
  const migrate = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    { env, stdio: "inherit" },
  );
  if (migrate.status === 0) {
    const run = spawnSync(
      process.execPath,
      [
        "node_modules/vitest/vitest.mjs",
        "run",
        "--no-file-parallelism",
        "tests/auth-database.test.ts",
        "tests/commerce-database.test.ts",
        "tests/email-database.test.ts",
        "tests/cart-database.test.ts",
        "tests/account-email-database.test.ts",
        "tests/account-maintenance-database.test.ts",
      ],
      { env, stdio: "inherit" },
    );
    status = run.status ?? 1;
  }
} finally {
  await connection.query(`DROP DATABASE \`${name}\``);
  await connection.end();
}
process.exit(status);
