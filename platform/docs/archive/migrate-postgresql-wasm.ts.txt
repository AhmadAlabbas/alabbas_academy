import "dotenv/config";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { bindMigrationAwareSqlAdapterFactory } from "@prisma/driver-adapter-utils";
import type { MigrationList } from "@prisma/schema-engine-wasm";

class MigrationConfigurationError extends Error {}

async function loadMigrations(): Promise<MigrationList> {
  const baseDir = path.resolve("prisma/migrations");
  const entries = await readdir(baseDir, { withFileTypes: true });
  let lockfile: string | null = null;
  try {
    lockfile = await readFile(path.join(baseDir, "migration_lock.toml"), "utf8");
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }

  const migrationDirectories = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(async (entry) => ({
        path: entry.name,
        migrationFile: {
          path: "migration.sql",
          content: {
            tag: "ok" as const,
            value: await readFile(path.join(baseDir, entry.name, "migration.sql"), "utf8"),
          },
        },
      })),
  );

  return {
    baseDir,
    lockfile: { path: "migration_lock.toml", content: lockfile },
    shadowDbInitScript: "",
    migrationDirectories,
  };
}

async function migrate() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new MigrationConfigurationError("DATABASE_URL is required to deploy PostgreSQL migrations.");

  const migrationsList = await loadMigrations();
  // This is Prisma's official schema engine and official pg adapter. The engine
  // owns migration locking, history, SQL checksums, and failed-migration handling.
  // Do not replace applyMigrations with raw SQL or manually stamp history rows.
  const { SchemaEngine } = await import("@prisma/schema-engine-wasm");
  const pool = new pg.Pool({ connectionString, max: 2 });
  let engine: Awaited<ReturnType<typeof SchemaEngine.new>> | undefined;
  try {
    engine = await SchemaEngine.new(
      { datamodels: undefined },
      () => {},
      bindMigrationAwareSqlAdapterFactory(new PrismaPg(pool)),
    );

    const history = await engine.diagnoseMigrationHistory({
      migrationsList,
      optInToShadowDatabase: false,
      filters: { externalTables: [], externalEnums: [] },
    });
    if (history.editedMigrationNames.length > 0) {
      throw new MigrationConfigurationError("An applied migration's checksum has changed. Restore the committed migration before deploying.");
    }
    if (history.failedMigrationNames.length > 0) {
      throw new MigrationConfigurationError("Prisma migration history contains a failed migration. Resolve it before deploying.");
    }
    if (history.history?.diagnostic === "migrationsDirectoryIsBehind" || history.history?.diagnostic === "historiesDiverge") {
      throw new MigrationConfigurationError("Database migration history differs from this checkout. Deploy the matching committed migrations.");
    }

    const result = await engine.applyMigrations({
      migrationsList,
      filters: { externalTables: [], externalEnums: [] },
    });
    if (result.appliedMigrationNames.length === 0) {
      console.info("PostgreSQL migrations are up to date.");
    } else {
      for (const name of result.appliedMigrationNames) console.info(`Applied migration: ${name}`);
    }
  } finally {
    engine?.free();
    await pool.end();
  }
}

migrate().catch((error: unknown) => {
  // Never print connection strings, provider credentials, or full SQL parameter
  // values. Configuration failures are actionable; engine failures stay private.
  console.error(error instanceof MigrationConfigurationError
    ? error.message
    : "Migration deployment failed. Check database connectivity and Prisma migration history before retrying.");
  process.exitCode = 1;
});
