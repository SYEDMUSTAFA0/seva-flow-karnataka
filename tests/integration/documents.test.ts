import { beforeAll, describe, expect, it } from "vitest";
import { setupTestDb, SAMPLE_APPLICATION } from "../helpers/testdb";
import type { AuthUser } from "@/lib/permissions";

const svc = () => import("@/lib/services/documents");
const storage = () => import("@/lib/storage");

let users: Awaited<ReturnType<typeof setupTestDb>>["users"];
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let appId: string;

const pdf = () => ({ name: "aadhaar.pdf", type: "application/pdf", buffer: Buffer.from("%PDF-1.4 demo") });

beforeAll(async () => {
  const db = await setupTestDb();
  users = db.users;
  prisma = db.prisma;
  const { createApplication } = await import("@/lib/services/applications");
  const app = await createApplication(users.inspector, { ...SAMPLE_APPLICATION });
  appId = app.id;
});

describe("documents: upload", () => {
  it("uploads a document — row, file bytes, timeline + audit", async () => {
    const { uploadDocument } = await svc();
    const doc = await uploadDocument(users.admin, {
      applicationId: appId,
      documentType: "AADHAAR",
      file: pdf(),
    });
    expect(doc.id).toBeTruthy();
    expect(doc.sizeBytes).toBeGreaterThan(0);

    const { readFile } = await storage();
    const bytes = await readFile(doc.storageKey);
    expect(bytes?.toString()).toContain("%PDF");

    const audit = await prisma.auditLog.findFirst({ where: { entityId: doc.id, action: "DOCUMENT_UPLOADED" } });
    expect(audit?.actorId).toBe(users.admin.id);
  });

  it("rejects unsupported types and oversized files", async () => {
    const { uploadDocument, ValidationError } = await svc();
    await expect(
      uploadDocument(users.admin, {
        applicationId: appId,
        documentType: "OTHER",
        file: { name: "note.txt", type: "text/plain", buffer: Buffer.from("hi") },
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      uploadDocument(users.admin, {
        applicationId: appId,
        documentType: "OTHER",
        file: { name: "x.svg", type: "image/svg+xml", buffer: Buffer.from("<svg/>") },
      })
    ).rejects.toThrow(ValidationError);
    await expect(
      uploadDocument(users.admin, {
        applicationId: appId,
        documentType: "OTHER",
        file: { name: "big.pdf", type: "application/pdf", buffer: Buffer.alloc(6 * 1024 * 1024) },
      })
    ).rejects.toThrow(ValidationError);
  });

  it("denies upload to an application the officer cannot view", async () => {
    const { uploadDocument } = await svc();
    const outsider: AuthUser = {
      id: "unrelated-officer",
      email: "outsider@test.kar",
      name: "Outsider",
      nameKn: "ಔಟ್",
      roleId: "FIELD_OFFICER",
      roleNameEn: "Field Officer",
      roleNameKn: "ಕ್ಷೇತ್ರ",
      taluk: "Kanakapura",
      district: "Ramanagara",
    };
    await expect(
      uploadDocument(outsider, { applicationId: appId, documentType: "OTHER", file: pdf() })
    ).rejects.toThrow();
  });
});

describe("documents: replace & remove", () => {
  it("replaces a pending doc — same row, new key, old object deleted", async () => {
    const { uploadDocument, replaceDocument } = await svc();
    const { fileExists } = await storage();
    const doc = await uploadDocument(users.admin, { applicationId: appId, documentType: "RATION_CARD", file: pdf() });
    const oldKey = doc.storageKey;

    const rep = await replaceDocument(users.admin, doc.id, {
      name: "ration-card-v2.png",
      type: "image/png",
      buffer: Buffer.from("\x89PNG fake"),
    });
    expect(rep.id).toBe(doc.id);
    expect(rep.storageKey).not.toBe(oldKey);
    expect(rep.mimeType).toBe("image/png");
    expect(rep.verificationStatus).toBe("PENDING");
    expect(await fileExists(oldKey)).toBe(false);
    expect(
      await prisma.auditLog.findFirst({ where: { entityId: doc.id, action: "DOCUMENT_REPLACED" } })
    ).toBeTruthy();
  });

  it("blocks replace/remove on officer-verified documents", async () => {
    const { uploadDocument, replaceDocument, deleteDocument } = await svc();
    const doc = await uploadDocument(users.admin, { applicationId: appId, documentType: "PHOTOGRAPH", file: pdf() });
    await prisma.applicationDocument.update({
      where: { id: doc.id },
      data: { verificationStatus: "VERIFIED" },
    });
    await expect(replaceDocument(users.admin, doc.id, pdf())).rejects.toThrow();
    await expect(deleteDocument(users.admin, doc.id)).rejects.toThrow();
  });

  it("removes a pending doc — row and stored object gone, audit written", async () => {
    const { uploadDocument, deleteDocument } = await svc();
    const { fileExists } = await storage();
    const doc = await uploadDocument(users.admin, { applicationId: appId, documentType: "INCOME_PROOF", file: pdf() });
    await deleteDocument(users.admin, doc.id);
    expect(await prisma.applicationDocument.findUnique({ where: { id: doc.id } })).toBeNull();
    expect(await fileExists(doc.storageKey)).toBe(false);
    expect(
      await prisma.auditLog.findFirst({ where: { entityId: doc.id, action: "DOCUMENT_REMOVED" } })
    ).toBeTruthy();
  });

  it("denies upload without the doc:upload permission", async () => {
    const { uploadDocument } = await svc();
    // APPROVING_OFFICER has no doc:upload in ROLE_PERMISSIONS
    await expect(
      uploadDocument(users.approver, { applicationId: appId, documentType: "OTHER", file: pdf() })
    ).rejects.toThrow();
  });
});
