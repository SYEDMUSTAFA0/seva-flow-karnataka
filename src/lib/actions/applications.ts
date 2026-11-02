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
import { deleteDocument, uploadDocument } from "@/lib/services/documents";
import { prisma } from "@/lib/db";
import { STAGES, type Stage } from "@/lib/constants";

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

export async function uploadDocumentAction(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const lang = await getLanguage();
  const t = dictFor(lang);
  const user = await requireUser();
  const applicationId = formData.get("applicationId") as string;
  const documentType = formData.get("documentType") as string;
  const file = formData.get("file") as File | null;
  if (!applicationId || !documentType || !file) return { ok: false, error: t.errors.generic };

  const res = await fail(async () => {
    const buf = Buffer.from(await file.arrayBuffer());
    const doc = await uploadDocument(user, {
      applicationId,
      documentType,
      file: { name: file.name, type: file.type, buffer: buf },
    });
    return { id: doc.id };
  }, t);
  if (res.ok) revalidatePath(`/applications/${applicationId}`);
  return res;
}

export async function deleteDocumentAction(documentId: string): Promise<ActionResult> {
  const lang = await getLanguage();
  const t = dictFor(lang);
  const user = await requireUser();
  const doc = await prisma.applicationDocument.findUnique({
    where: { id: documentId },
    select: { applicationId: true },
  });
  const res = await fail(() => deleteDocument(user, documentId), t);
  if (res.ok && doc) revalidatePath(`/applications/${doc.applicationId}`);
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
