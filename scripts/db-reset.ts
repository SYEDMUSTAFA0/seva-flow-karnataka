/** Remove the embedded data directory and re-run full setup. */
import fs from "node:fs";
import { execSync } from "node:child_process";

try {
  process.loadEnvFile?.(".env");
} catch {
  /* optional */
}

const dir = process.env.DATABASE_DIR ?? "./.data/pglite";
if (fs.existsSync(dir)) {
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`→ Removed ${dir}`);
}
execSync("npx tsx scripts/db-setup.ts", { stdio: "inherit" });
