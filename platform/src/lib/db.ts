import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const globalDatabase = globalThis as unknown as {
  alabbasDatabase?: PrismaClient;
};

/** Creates a connection lazily so static pages can build without database secrets. */
export function getDatabase(): PrismaClient {
  if (globalDatabase.alabbasDatabase) return globalDatabase.alabbasDatabase;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for database-backed operations.");
  }

  const adapter = new PrismaPg({ connectionString, max: 10 });
  const client = new PrismaClient({ adapter });

  // Reuse one pool during Next.js hot reload and across server requests.
  globalDatabase.alabbasDatabase = client;
  return client;
}
