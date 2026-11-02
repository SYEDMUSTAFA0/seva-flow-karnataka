"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser, requireUser, AuthError } from "@/lib/auth";
import { dictFor, getLanguage } from "@/i18n";
import {
  advanceStage,
  createApplication,
  verifyDocument,
} from "@/lib/services/applications";
import { prisma } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import { logAudit, addTimeline } from "@/lib/audit";
import { canViewApplication, hasPermission } from "@/lib/permissions";
import { PERMISSIONS, STAGES, type Stage } from "@/lib/constants";

export interface ActionResult<T = unknown> {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
}

async function fail<T>(fn: () => Promise<T>, t: Awaited<ReturnType<typeof dictFor>>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: e.code === "FORBIDDEN" ? t.errors.forbidden : t.errors.unauthenticated };
    console.error(e);
    return { ok: false, error: t.errors.generic };
  }
}

const applicantSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  fullNameKn: z.string().trim().max(120).optional(),
  fatherName: z.string().trim().max(120).optional(),
  phone: z.string().trim().regex(/^[6-9]\d{9}$/),
  alternatePhone: z.string().trim().regex(/^[6-9]\d{9}$/).optional().or(z.literal("")),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional(),
  village: z.string().trim().min(2).max(100),
  villageKn: z.string().trim().max(100).optional(),
  hobli: z.string().trim().max(100).optional(),
  taluk: z.string().trim().min(2).max(100),
  talukKn: z.string().trim().max(100).optional(),
  district: z.string().trim().min(2).max(100),
  districtKn: z.string().trim().max(100).optional(),
  pincode: z.string().trim().regex(/^\d{6}$/),
  aadhaarLast4: z.string().trim().regex(/^\d{4}$/).optional().or(z.literal("")),
});

const createSchema = z.object({
  applicant: applicantSchema,
  declaredAnnualIncome: z.number().int().min(0).max(100_000_000),
  incomeSource: z.string().min(1),
  purpose: z.string().min(1),
  purposeDetails: z.string().trim().max(300).optional(),
  assignedOfficerId: z.string().optional(),
});

export async function createApplicationAction(input: unknown): Promise<ActionResult<{ id: string; referenceNumber: string }>> {
  const lang = await getLanguage();
  const t = dictFor(lang);
  const user = await requireUser();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const issue of parsed.error.issues) fe[issue.path.join(".")] = issue.message;
    return { ok: false, fieldErrors: fe };
  }
  return fail(() => createApplication(user, parsed.data), t);
}

export async function advanceStageAction(
  applicationId: string,
  to: string,
  opts?: { remarks?: string; remarksKn?: string; explanationKn?: string }
): Promise<ActionResult> {
  const lang = await getLanguage();
  const t = dictFor(lang);
  const user = await requireUser();
  const res = await fail(() => advanceStage(user, applicationId, to as Stage, opts), t);
  if (res.ok) revalidatePath(`/applications/${applicationId}`);
  return res;
}

export async function verifyDocumentAction(
  documentId: string,
  status: "VERIFIED" | "INVALID" | "NEEDS_CLARIFICATION",
  remarks?: string
): Promise<ActionResult> {
  const lang = await getLanguage();
  const t = dictFor(lang);
  const user = await requireUser();
  const res = await fail(() => verifyDocument(user, documentId, status, remarks), t);
  if (res.ok) revalidatePath("/applications");
  return res;
}

const MAX_UPLOAD = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["application/pdf", "image/jpeg", "image/png", "image/svg+xml", "image/webp"]);

export async function uploadDocumentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const lang = await getLanguage();
  const t = dictFor(lang);
  const user = await requireUser();
  const applicationId = formData.get("applicationId") as string;
  const documentType = formData.get("documentType") as string;
  const file = formData.get("file") as File | null;
  if (!applicationId || !documentType || !file) return { ok: false, error: t.errors.generic };
  if (file.size > MAX_UPLOAD) return { ok: false, error: t.errors.uploadTooLarge };
  if (!ALLOWED_MIME.has(file.type)) return { ok: false, error: t.errors.uploadBadType };
  if (!hasPermission(user, PERMISSIONS.DOC_UPLOAD)) return { ok: false, error: t.errors.forbidden };

  const res = await fail(async () => {
    const app = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!app || !canViewApplication(user, app)) throw new AuthError("FORBIDDEN");
    const buf = Buffer.from(await file.arrayBuffer());
    const { storageKey, sizeBytes } = await saveFile(applicationId, file.name, buf);
    const doc = await prisma.applicationDocument.create({
      data: {
        applicationId,
        documentType,
        storageKey,
        originalFilename: file.name,
        mimeType: file.type,
        sizeBytes,
        uploadedById: user.id,
      },
    });
    await addTimeline({
      applicationId,
      actorId: user.id,
      action: "DOCUMENT_UPLOADED",
      remarks: `${documentType} — ${file.name}`,
    });
    await logAudit({
      applicationId,
      actorId: user.id,
      action: "DOCUMENT_UPLOADED",
      entityType: "ApplicationDocument",
      entityId: doc.id,
      metadata: { documentType, filename: file.name, sizeBytes },
    });
    return { id: doc.id };
  }, t);
  if (res.ok) revalidatePath(`/applications/${applicationId}`);
  return res;
}

/** Return to applicant for missing info (scrutiny stage). */
export async function requestDocumentsAction(
  applicationId: string,
  opts: { missingTypes: string[]; explanationKn: string; remarks?: string }
): Promise<ActionResult> {
  const lang = await getLanguage();
  const t = dictFor(lang);
  const user = await requireUser();
  const res = await fail(
    () =>
      advanceStage(user, applicationId, STAGES.RETURNED, {
        remarks: `Documents requested: ${opts.missingTypes.join(", ")}${opts.remarks ? ` — ${opts.remarks}` : ""}`,
        remarksKn: opts.explanationKn,
      }),
    t
  );
  if (res.ok) revalidatePath(`/applications/${applicationId}`);
  return res;
}

export async function recordResubmissionAction(applicationId: string): Promise<ActionResult> {
  const lang = await getLanguage();
  const t = dictFor(lang);
  const user = await requireUser();
  const res = await fail(() => advanceStage(user, applicationId, STAGES.DOCUMENT_SCRUTINY), t);
  if (res.ok) revalidatePath(`/applications/${applicationId}`);
  return res;
}

export async function getOfficers() {
  const user = await getCurrentUser();
  if (!user) return [];
  return prisma.user.findMany({
    where: { active: true, roleId: { in: ["FIELD_OFFICER", "REVENUE_INSPECTOR", "APPROVING_OFFICER"] } },
    select: { id: true, name: true, nameKn: true, roleId: true, taluk: true, district: true },
    orderBy: { name: "asc" },
  });
}
