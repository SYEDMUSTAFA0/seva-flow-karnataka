// Database client — PostgreSQL via Prisma driver adapters.
//
// DB_MODE=embedded (default): real PostgreSQL runs in-process through PGlite
// (WASM Postgres). Zero external services; data lives in DATABASE_DIR.
//
// DB_MODE=server: connects to the PostgreSQL server at DATABASE_URL through
// the official @prisma/adapter-pg driver (managed Postgres in production).

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";

const globalForDb = globalThis as unknown as {
  prisma?: PrismaClient;
  pglite?: PGlite;
};

function createClient(): PrismaClient {
  const mode = (process.env.DB_MODE ?? "embedded").toLowerCase();

  if (mode === "server") {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DB_MODE=server requires DATABASE_URL to be set");
    }
    return new PrismaClient({
      adapter: new PrismaPg({ connectionString }),
    });
  }

  const dir = process.env.DATABASE_DIR ?? "./.data/pglite";
  const pglite = globalForDb.pglite ?? new PGlite(dir);
  globalForDb.pglite = pglite;
  return new PrismaClient({ adapter: new PrismaPGlite(pglite) });
}

export const prisma = globalForDb.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForDb.prisma = prisma;
