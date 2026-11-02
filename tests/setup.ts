import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Each test file gets its own PGlite data directory and storage bucket so
// parallel files never share an embedded Postgres instance (single-user).
const root = mkdtempSync(path.join(tmpdir(), "sevaflow-test-"));
process.env.DATABASE_DIR = path.join(root, "pglite");
process.env.STORAGE_DIR = path.join(root, "storage");
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "test-session-secret";
process.env.AI_PROVIDER = "demo";
delete process.env.DB_MODE;
