import "dotenv/config";
import {getDatabase} from "../src/lib/db";
import {deliverPendingAccountEmails} from "../src/lib/email";

try {
  const result = await deliverPendingAccountEmails({limit: 10});
  // The CLI is a one-shot scheduler target; no token, recipient, or URL is logged.
  console.log(JSON.stringify(result));
} catch {
  console.error("EMAIL_WORKER_UNAVAILABLE");
  process.exitCode = 1;
} finally {
  if (process.env.DATABASE_URL) {
    try {
      await getDatabase().$disconnect();
    } catch {
      // Closing an unavailable connection must not reveal its configuration.
    }
  }
}
