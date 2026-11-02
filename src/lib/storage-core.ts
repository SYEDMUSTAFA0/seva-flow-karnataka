import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { prisma } from "./db";

/**
 * Storage backend selection.
 *
 * "fs" — local filesystem under STORAGE_DIR (default for embedded/dev mode).
 * "db" — file bytes inside Postgres (StoredObject table). Default whenever
 *        DB_MODE=server, because serverless hosts (Vercel & co.) have no
 *        persistent filesystem.
 *
 * Explicit override: STORAGE_BACKEND=fs|db.
 */

const ROOT = path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR ?? "./.data/storage");

function backend(): "fs" | "db" {
  const explicit = process.env.STORAGE_BACKEND?.toLowerCase();
  if (explicit === "fs" || explicit === "db") return explicit;
  return (process.env.DB_MODE ?? "embedded").toLowerCase() === "server" ? "db" : "fs";
}

export async function saveFile(
  applicationId: string,
  filename: string,
  data: Buffer
): Promise<{ storageKey: string; sizeBytes: number }> {
  const safeName = filename.replace(/[^A-Za-z0-9._-]/g, "_").slice(-80);
  const storageKey = `${applicationId}/${Date.now()}-${randomBytes(4).toString("hex")}-${safeName}`;

  if (backend() === "db") {
    await prisma.storedObject.create({ data: { key: storageKey, data: new Uint8Array(data) } });
  } else {
    const full = path.join(ROOT, storageKey);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }
  return { storageKey, sizeBytes: data.byteLength };
}

export async function fileExists(storageKey: string): Promise<boolean> {
  if (backend() === "db") {
    const row = await prisma.storedObject.findUnique({ where: { key: storageKey }, select: { key: true } });
    return row !== null;
  }
  try {
    await fs.access(resolve(storageKey));
    return true;
  } catch {
    return false;
  }
}

/** Filesystem path — only valid when the fs backend is active. */
export function resolve(storageKey: string): string {
  const full = path.resolve(ROOT, storageKey);
  if (!full.startsWith(ROOT)) throw new Error("Invalid storage key");
  return full;
}

export async function readFile(storageKey: string): Promise<Buffer | null> {
  if (backend() === "db") {
    const row = await prisma.storedObject.findUnique({ where: { key: storageKey }, select: { data: true } });
    return row ? Buffer.from(row.data) : null;
  }
  try {
    return await fs.readFile(/*turbopackIgnore: true*/ resolve(storageKey));
  } catch {
    return null;
  }
}

/** Filesystem stream — only valid when the fs backend is active. */
export function streamFile(storageKey: string) {
  return createReadStream(/*turbopackIgnore: true*/ resolve(storageKey));
}

export async function deleteFile(storageKey: string): Promise<void> {
  if (backend() === "db") {
    await prisma.storedObject.deleteMany({ where: { key: storageKey } });
    return;
  }
  try {
    await fs.unlink(resolve(storageKey));
  } catch {
    /* already gone */
  }
}
