import "dotenv/config";
import {getDatabase} from "../src/lib/db";
import {cleanAccountRecords} from "../src/lib/auth/maintenance";

try {
  // Only deletion counts are logged; no account identifiers or credentials.
  console.log(JSON.stringify(await cleanAccountRecords()));
} catch {
  console.error("ACCOUNT_MAINTENANCE_UNAVAILABLE");
  process.exitCode = 1;
} finally {
  if (process.env.DATABASE_URL) {
    try { await getDatabase().$disconnect(); } catch { /* Keep connection details private. */ }
  }
}
