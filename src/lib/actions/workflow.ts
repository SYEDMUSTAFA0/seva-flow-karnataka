"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, AuthError } from "@/lib/auth";
import { dictFor, getLanguage } from "@/i18n";
import { submitFieldVerification, submitRecommendation, submitDecision } from "@/lib/services/applications";
import { runAiTask, markAiOverride } from "@/lib/ai/tasks";
import type { AiTaskType } from "@/lib/ai/schemas";
import type { ActionResult } from "./applications";

async function guard<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  const lang = await getLanguage();
  const t = dictFor(lang);
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AuthError)
      return { ok: false, error: e.code === "FORBIDDEN" ? t.errors.forbidden : t.errors.unauthenticated };
    console.error(e);
    return { ok: false, error: t.errors.generic };
  }
}

// ─── Field verification ──────────────────────────────────────────────────────

const fieldSchema = z.object({
  visitedAt: z.string().min(1),
  checklist: z.array(z.object({ key: z.string(), label: z.string(), answer: z.boolean().nullable() })),
  rawNotes: z.string().max(4000).default(""),
  observations: z.string().min(10).max(8000),
  outcome: z.enum(["VERIFIED", "FURTHER_VERIFICATION", "UNABLE_TO_VERIFY", "RETURN_FOR_CLARIFICATION"]),
  aiAssisted: z.boolean().default(false),
  applicantInteraction: z.string().max(2000).optional(),
  locationLat: z.number().optional(),
  locationLng: z.number().optional(),
});

export async function submitFieldVerificationAction(applicationId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = fieldSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid field data" };
  const res = await guard(() =>
    submitFieldVerification(user, applicationId, {
      ...parsed.data,
      visitedAt: new Date(parsed.data.visitedAt),
    })
  );
  if (res.ok) revalidatePath(`/applications/${applicationId}`);
  return res;
}

// ─── Recommendation ──────────────────────────────────────────────────────────

const recoSchema = z.object({
  recommendation: z.enum(["RECOMMEND_APPROVAL", "RECOMMEND_REJECTION", "RETURN_FOR_VERIFICATION"]),
  remarks: z.string().min(5).max(3000),
  aiAssisted: z.boolean().default(false),
  aiSummary: z.string().max(4000).optional(),
});

export async function submitRecommendationAction(applicationId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = recoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid recommendation" };
  const res = await guard(() => submitRecommendation(user, applicationId, parsed.data));
  if (res.ok) revalidatePath(`/applications/${applicationId}`);
  return res;
}

// ─── Final decision ──────────────────────────────────────────────────────────

const decisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED", "RETURNED"]),
    reason: z.string().max(300).optional(),
    remarks: z.string().max(3000).optional(),
    applicantExplanationKn: z.string().max(3000).optional(),
    approvedIncome: z.number().int().min(0).max(100_000_000).optional(),
  })
  .refine((d) => d.decision === "APPROVED" || !!d.reason, { message: "reason required" });

export async function submitDecisionAction(applicationId: string, input: unknown): Promise<ActionResult<{ certificateNumber?: string | null }>> {
  const user = await requireUser();
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "A reason is required" };
  const res = await guard(() => submitDecision(user, applicationId, parsed.data));
  if (res.ok) {
    revalidatePath(`/applications/${applicationId}`);
    revalidatePath("/applications");
  }
  return res as ActionResult<{ certificateNumber?: string | null }>;
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export async function runAiAction(
  applicationId: string,
  taskType: AiTaskType,
  extraInput?: Record<string, unknown>
): Promise<ActionResult<{ result: unknown; interactionId: string; provider: string; model: string }>> {
  const lang = await getLanguage();
  const user = await requireUser();
  const res = await guard(() => runAiTask(user, applicationId, taskType, lang, extraInput));
  if (res.ok) revalidatePath(`/applications/${applicationId}`);
  return res;
}

export async function markAiOverrideAction(interactionId: string): Promise<ActionResult> {
  const user = await requireUser();
  return guard(() => markAiOverride(interactionId, user));
}
