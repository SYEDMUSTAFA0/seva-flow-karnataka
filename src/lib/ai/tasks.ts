import "server-only";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import { canViewApplication, hasPermission, type AuthUser } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { getProvider } from "./provider";
import type { AiContext, AiResult, AiTaskType } from "./schemas";
import { PERMISSIONS } from "@/lib/constants";
import { safeJson } from "@/lib/utils";

/** Assemble the real, current application context for an AI task. */
export async function buildContext(
  applicationId: string,
  taskType: AiTaskType,
  language: "kn" | "en",
  extraInput?: Record<string, unknown>
): Promise<AiContext | null> {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      applicant: true,
      documents: { orderBy: { uploadedAt: "asc" } },
      fieldVerification: true,
      recommendations: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!app) return null;

  const requirements = await prisma.documentRequirement.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });

  const fv = app.fieldVerification;
  return {
    taskType,
    language,
    application: {
      referenceNumber: app.referenceNumber,
      type: app.applicationType,
      stage: app.currentStage,
      declaredAnnualIncome: app.declaredAnnualIncome,
      incomeSource: app.incomeSource,
      purpose: app.purpose,
      submittedAt: app.submittedAt.toISOString(),
    },
    applicant: {
      fullName: app.applicant.fullName,
      fatherName: app.applicant.fatherName,
      village: app.applicant.village,
      taluk: app.applicant.taluk,
      district: app.applicant.district,
      address: `${app.applicant.addressLine1}${app.applicant.addressLine2 ? ", " + app.applicant.addressLine2 : ""}`,
    },
    documents: app.documents.map((d) => ({
      documentType: d.documentType,
      filename: d.originalFilename,
      verificationStatus: d.verificationStatus,
      extractedData: safeJson<Record<string, string>>(d.extractedData, null as never) ?? null,
    })),
    requiredDocuments: requirements.map((r) => ({
      documentType: r.documentType,
      labelEn: r.labelEn,
      required: r.required,
    })),
    fieldVerification: fv
      ? {
          outcome: fv.outcome,
          rawNotes: fv.rawNotes,
          observations: fv.observations,
          checklist: safeJson(fv.checklistJson, [] as never) ?? [],
        }
      : null,
    recommendation: app.recommendations[0]
      ? { recommendation: app.recommendations[0].recommendation, remarks: app.recommendations[0].remarks }
      : null,
    extraInput,
  };
}

/**
 * Run an AI assistance task:
 * permission → context → provider → validate → persist AIInteraction + audit.
 */
export async function runAiTask(
  user: AuthUser,
  applicationId: string,
  taskType: AiTaskType,
  language: "kn" | "en",
  extraInput?: Record<string, unknown>
): Promise<{ result: AiResult; interactionId: string; provider: string; model: string }> {
  if (!hasPermission(user, PERMISSIONS.AI_USE)) throw new AuthError("FORBIDDEN");
  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { assignedOfficerId: true } });
  if (!app || !canViewApplication(user, app)) throw new AuthError("FORBIDDEN");

  const ctx = await buildContext(applicationId, taskType, language, extraInput);
  if (!ctx) throw new AuthError("FORBIDDEN");

  const provider = getProvider();
  const result = await provider.generate(ctx);

  const interaction = await prisma.aIInteraction.create({
    data: {
      applicationId,
      officerId: user.id,
      taskType,
      inputRef: JSON.stringify({ applicationId, taskType, extraKeys: Object.keys(extraInput ?? {}) }),
      output: JSON.stringify(result),
      confidence: result.confidence,
      model: provider.model,
      provider: provider.name,
    },
  });
  await logAudit({
    applicationId,
    actorId: user.id,
    action: "AI_ASSISTANCE",
    entityType: "AIInteraction",
    entityId: interaction.id,
    metadata: { taskType, provider: provider.name, model: provider.model, confidence: result.confidence },
  });

  return { result, interactionId: interaction.id, provider: provider.name, model: provider.model };
}

/** Officer edited/rejected AI output — recorded for the override metric. */
export async function markAiOverride(interactionId: string, user: AuthUser) {
  const interaction = await prisma.aIInteraction.findUnique({ where: { id: interactionId } });
  if (!interaction || interaction.officerId !== user.id) throw new AuthError("FORBIDDEN");
  await prisma.aIInteraction.update({ where: { id: interactionId }, data: { officerOverride: true } });
  await logAudit({
    applicationId: interaction.applicationId,
    actorId: user.id,
    action: "AI_OVERRIDE",
    entityType: "AIInteraction",
    entityId: interactionId,
    remarks: "Officer edited AI-generated content",
  });
}
