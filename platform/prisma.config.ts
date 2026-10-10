import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // Generating the client does not require database credentials. Commands that
  // connect to PostgreSQL fail explicitly when DATABASE_URL is missing.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
