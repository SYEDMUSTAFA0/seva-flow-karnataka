import "server-only";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { canViewApplication, hasPermission, type AuthUser } from "@/lib/permissions";
import { addTimeline, logAudit } from "@/lib/audit";
import { deleteFile, saveFile } from "@/lib/storage";
import { PERMISSIONS } from "@/lib/constants";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const ALLOWED_EXT = new Set([".pdf", ".jpg", ".jpeg", ".png", ".webp"]);

export interface UploadFilePayload {
  name: string;
  type: string;
  buffer: Buffer;
}

export class ValidationError extends Error {
  constructor(public reason: "TOO_LARGE" | "BAD_TYPE" | "MISSING_FIELDS") {
    super(reason);
  }
}

function validateFile(file: UploadFilePayload) {
  const ext = ("." + (file.name.split(".").pop() ?? "")).toLowerCase();
  if (!ALLOWED_MIME.has(file.type) || !ALLOWED_EXT.has(ext)) {
    throw new ValidationError("BAD_TYPE");
  }
  if (file.buffer.byteLength > MAX_UPLOAD_BYTES) throw new ValidationError("TOO_LARGE");
}

async function loadAppForWrite(user: AuthUser, applicationId: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || !canViewApplication(user, app)) throw new AuthError("FORBIDDEN");
  return app;
}

/**
 * Upload a document for an application. Creates a new ApplicationDocument row;
 * for replacing an existing requirement's document use replaceDocument().
 */
export async function uploadDocument(
  user: AuthUser,
  input: { applicationId: string; documentType: string; file: UploadFilePayload }
) {
  if (!input.applicationId || !input.documentType) throw new ValidationError("MISSING_FIELDS");
  if (!hasPermission(user, PERMISSIONS.DOC_UPLOAD)) throw new AuthError("FORBIDDEN");
  validateFile(input.file);
  await loadAppForWrite(user, input.applicationId);

  const { storageKey, sizeBytes } = await saveFile(input.applicationId, input.file.name, input.file.buffer);
  const doc = await prisma.applicationDocument.create({
    data: {
      applicationId: input.applicationId,
      documentType: input.documentType,
      storageKey,
      originalFilename: input.file.name,
      mimeType: input.file.type,
      sizeBytes,
      uploadedById: user.id,
    },
  });
  await addTimeline({
    applicationId: input.applicationId,
    actorId: user.id,
    action: "DOCUMENT_UPLOADED",
    remarks: `${input.documentType} — ${input.file.name}`,
  });
  await logAudit({
    applicationId: input.applicationId,
    actorId: user.id,
    action: "DOCUMENT_UPLOADED",
    entityType: "ApplicationDocument",
    entityId: doc.id,
    metadata: { documentType: input.documentType, filename: input.file.name, sizeBytes },
  });
  return doc;
}

/**
 * Replace the stored file behind an existing document row — keeps the same
 * record id and application association; resets verification state and clears
 * stale AI extraction so the new file gets reviewed fresh.
 */
export async function replaceDocument(user: AuthUser, documentId: string, file: UploadFilePayload) {
  if (!hasPermission(user, PERMISSIONS.DOC_UPLOAD)) throw new AuthError("FORBIDDEN");
  validateFile(file);

  const doc = await prisma.applicationDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new AuthError("FORBIDDEN", "Document not found");
  await loadAppForWrite(user, doc.applicationId);
  if (doc.verificationStatus === "VERIFIED") {
    throw new AuthError("FORBIDDEN", "A verified document cannot be replaced");
  }

  const oldKey = doc.storageKey;
  const { storageKey, sizeBytes } = await saveFile(doc.applicationId, file.name, file.buffer);
  const updated = await prisma.applicationDocument.update({
    where: { id: documentId },
    data: {
      storageKey,
      originalFilename: file.name,
      mimeType: file.type,
      sizeBytes,
      uploadedById: user.id,
      uploadedAt: new Date(),
      verificationStatus: "PENDING",
      extractedData: null,
      extractionDoneAt: null,
    },
  });
  await deleteFile(oldKey);
  await logAudit({
    applicationId: doc.applicationId,
    actorId: user.id,
    action: "DOCUMENT_REPLACED",
    entityType: "ApplicationDocument",
    entityId: doc.id,
    metadata: { documentType: doc.documentType, filename: file.name, sizeBytes },
  });
  await addTimeline({
    applicationId: doc.applicationId,
    actorId: user.id,
    action: "DOCUMENT_REPLACED",
    remarks: `${doc.documentType} — ${file.name}`,
  });
  return updated;
}

/** Remove a document row and its stored object. Verified documents cannot be removed. */
export async function deleteDocument(user: AuthUser, documentId: string) {
  if (!hasPermission(user, PERMISSIONS.DOC_UPLOAD)) throw new AuthError("FORBIDDEN");
  const doc = await prisma.applicationDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new AuthError("FORBIDDEN", "Document not found");
  await loadAppForWrite(user, doc.applicationId);
  if (doc.verificationStatus === "VERIFIED") {
    throw new AuthError("FORBIDDEN", "A verified document cannot be removed");
  }

  await prisma.applicationDocument.delete({ where: { id: doc.id } });
  await deleteFile(doc.storageKey);
  await logAudit({
    applicationId: doc.applicationId,
    actorId: user.id,
    action: "DOCUMENT_REMOVED",
    entityType: "ApplicationDocument",
    entityId: doc.id,
    metadata: { documentType: doc.documentType, filename: doc.originalFilename },
  });
}
