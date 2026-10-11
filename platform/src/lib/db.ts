import "server-only";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
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

  const url = new URL(connectionString);
  if (url.protocol !== "mysql:") throw new Error("DATABASE_URL must use mysql:// for this release.");
  const adapter = new PrismaMariaDb({host:url.hostname,port:Number(url.port || 3306),user:decodeURIComponent(url.username),password:decodeURIComponent(url.password),database:decodeURIComponent(url.pathname.slice(1)),connectionLimit:5,connectTimeout:5000,acquireTimeout:8000,...(url.searchParams.get('ssl')==='true'?{ssl:true}:{})});
  const client = new PrismaClient({ adapter });

  // Reuse one pool during Next.js hot reload and across server requests.
  globalDatabase.alabbasDatabase = client;
  return client;
}
