import "server-only";

/**
 * Server-side storage API. Implementation lives in storage-core.ts so that
 * non-Next scripts (seed, db tooling) can use the same backends without the
 * server-only guard.
 *
 * Backends: local filesystem (dev) or Postgres StoredObject rows (production
 * serverless) — see storage-core.ts.
 */
export {
  saveFile,
  fileExists,
  resolve,
  readFile,
  streamFile,
  deleteFile,
} from "./storage-core";
