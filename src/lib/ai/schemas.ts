import { z } from "zod";
import { AI_TASKS } from "@/lib/constants";

/** Consistent structured schema every AI task must satisfy. */
export const aiFindingSchema = z.object({
  label: z.string(),
  value: z.string().optional(),
  evidence: z.string().optional(),
  severity: z.enum(["info", "warning", "critical"]).default("info"),
});

export const aiInconsistencySchema = z.object({
  field: z.string(),
  valueA: z.string().optional(),
  valueB: z.string().optional(),
  sourceA: z.string().optional(),
  sourceB: z.string().optional(),
  note: z.string().optional(),
});

export const aiResultSchema = z.object({
  summary: z.string(),
  findings: z.array(aiFindingSchema).default([]),
  inconsistencies: z.array(aiInconsistencySchema).default([]),
  missingInfo: z.array(z.string()).default([]),
  suggestedNextAction: z.string().default(""),
  questions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  requiresHumanVerification: z.array(z.string()).default([]),
  extractedFields: z.record(z.string(), z.string()).optional(),
  draftText: z.string().optional(),
});

export type AiResult = z.infer<typeof aiResultSchema>;
export type AiFinding = z.infer<typeof aiFindingSchema>;
export type AiInconsistency = z.infer<typeof aiInconsistencySchema>;
export type AiTaskType = (typeof AI_TASKS)[keyof typeof AI_TASKS];

/** Context handed to providers — built from real application data. */
export interface AiContext {
  taskType: AiTaskType;
  language: "kn" | "en";
  application: {
    referenceNumber: string;
    type: string;
    stage: string;
    declaredAnnualIncome: number;
    incomeSource: string;
    purpose: string;
    submittedAt: string;
  };
  applicant: {
    fullName: string;
    fatherName: string | null;
    village: string;
    taluk: string;
    district: string;
    address: string;
  };
  documents: Array<{
    documentType: string;
    filename: string;
    verificationStatus: string;
    extractedData: Record<string, string> | null;
  }>;
  requiredDocuments: Array<{ documentType: string; labelEn: string; required: boolean }>;
  fieldVerification?: {
    outcome: string | null;
    rawNotes: string | null;
    observations: string | null;
    checklist: Array<{ key: string; label: string; answer: boolean | null }>;
  } | null;
  recommendation?: { recommendation: string; remarks: string | null } | null;
  extraInput?: Record<string, unknown>;
}
