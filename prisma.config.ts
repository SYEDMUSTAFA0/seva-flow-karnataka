// Prisma 7 project configuration.
// The embedded (PGlite) development path does NOT use this datasource —
// scripts/db-setup.ts applies the schema through the PGlite adapter instead.
// This datasource URL is used by `prisma migrate` commands when working
// against a real PostgreSQL server (DB_MODE=server / production).

try {
  process.loadEnvFile?.(".env");
} catch {
  // .env optional — env vars may be injected by the platform
}

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations prefer a direct (non-pooled) endpoint when one is provided —
    // e.g. Neon's -pooler host works at runtime but DDL is safer direct.
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@localhost:5432/sevaflow",
  },
});
