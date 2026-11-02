/**
 * Embedded-database setup.
 *
 * 1. Generates the DDL for prisma/schema.prisma via `prisma migrate diff`
 *    (no server needed) and stores it as prisma/migrations/0001_init so
 *    `prisma migrate deploy` works unchanged against a real Postgres server.
 * 2. Applies the SQL to the embedded PGlite database.
 * 3. Runs the deterministic seed.
 *
 * Stop the dev server before running this — PGlite holds an exclusive lock
 * on the data directory while the app is running.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";

try {
  process.loadEnvFile?.(".env");
} catch {
  /* .env optional */
}

const DATABASE_DIR = process.env.DATABASE_DIR ?? "./.data/pglite";
const MIGRATIONS_DIR = path.join("prisma", "migrations");
const INIT_MIGRATION = path.join(MIGRATIONS_DIR, "0001_init");

async function main() {
  console.log("→ Generating migration SQL from prisma/schema.prisma …");
  const sql = execSync(
    "npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script",
    { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 }
  );

  if (!sql.trim()) {
    throw new Error("migrate diff produced empty output");
  }

  // Persist as a standard migration for server-mode `prisma migrate deploy`.
  fs.mkdirSync(INIT_MIGRATION, { recursive: true });
  fs.writeFileSync(path.join(INIT_MIGRATION, "migration.sql"), sql, "utf-8");
  fs.writeFileSync(
    path.join(MIGRATIONS_DIR, "migration_lock.toml"),
    'provider = "postgresql"\n',
    "utf-8"
  );
  console.log(`→ Wrote ${path.join(INIT_MIGRATION, "migration.sql")}`);

  fs.mkdirSync(DATABASE_DIR, { recursive: true });
  const db = new PGlite(DATABASE_DIR);
  await db.waitReady;

  const exists = await db.query<{ exists: boolean }>(
    `SELECT to_regclass('public."Application"') IS NOT NULL AS exists`
  );
  if (exists.rows[0]?.exists) {
    console.log("→ Embedded database already initialised — skipping schema apply.");
  } else {
    console.log(`→ Applying schema to embedded Postgres at ${DATABASE_DIR} …`);
    await db.exec(sql);
    console.log("→ Schema applied.");
  }

  await db.close();

  console.log("→ Seeding demo data …");
  execSync("npx tsx prisma/seed.ts", { stdio: "inherit" });
  console.log("✔ Database ready.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
