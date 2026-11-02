import { describe, expect, it } from "vitest";
import { aiResultSchema } from "@/lib/ai/schemas";
import { buildPrompt, getProvider, providerInfo } from "@/lib/ai/provider";

const VALID = {
  summary: "Applicant declares Rs.1.2L agricultural income; four documents uploaded.",
  findings: [{ label: "Income", value: "120000", evidence: "Application", severity: "info" }],
  inconsistencies: [
    { field: "Name", valueA: "Lakshmamma", valueB: "Lakshmama", sourceA: "AADHAAR", sourceB: "RATION_CARD", note: "Spelling differs" },
  ],
  missingInfo: ["Income proof not uploaded"],
  suggestedNextAction: "Verify remaining documents",
  questions: ["Is the self-declaration notarised?"],
  confidence: 0.72,
  requiresHumanVerification: ["OCR-extracted name on ration card"],
  extractedFields: { holderName: "Lakshmamma" },
  draftText: "Draft field report...",
};

describe("aiResultSchema", () => {
  it("accepts a fully-populated result", () => {
    const r = aiResultSchema.safeParse(VALID);
    expect(r.success).toBe(true);
  });

  it("applies defaults for optional arrays", () => {
    const r = aiResultSchema.parse({ summary: "s" });
    expect(r.findings).toEqual([]);
    expect(r.confidence).toBe(0.5);
  });

  it("rejects confidence outside 0..1", () => {
    expect(aiResultSchema.safeParse({ summary: "s", confidence: 1.5 }).success).toBe(false);
    expect(aiResultSchema.safeParse({ summary: "s", confidence: -0.1 }).success).toBe(false);
  });

  it("rejects malformed findings", () => {
    expect(
      aiResultSchema.safeParse({ summary: "s", findings: [{ label: 3 }] }).success
    ).toBe(false);
    expect(
      aiResultSchema.safeParse({ summary: "s", findings: [{ label: "x", severity: "urgent" }] }).success
    ).toBe(false);
  });
});

describe("provider selection", () => {
  it("returns demo provider without API keys", () => {
    expect(getProvider().name).toBe("demo");
    expect(providerInfo().demo).toBe(true);
  });

  it("builds a context-aware prompt with guard rails", () => {
    const prompt = buildPrompt({
      taskType: "DOCUMENT_COMPARISON",
      language: "kn",
      application: {
        referenceNumber: "SF/INC/2026/00001",
        type: "INCOME_CERTIFICATE",
        stage: "DOCUMENT_SCRUTINY",
        declaredAnnualIncome: 120000,
        incomeSource: "AGRICULTURE",
        purpose: "SCHOLARSHIP",
        submittedAt: new Date().toISOString(),
      },
      applicant: { fullName: "Lakshmamma", fatherName: null, village: "Harohalli", taluk: "Kanakapura", district: "Ramanagara", address: "x" },
      documents: [],
      requiredDocuments: [],
    });
    expect(prompt).toContain("NEVER decide eligibility");
    expect(prompt).toContain("NEVER invent facts");
    expect(prompt).toContain("SF/INC/2026/00001");
    expect(prompt).toContain("Kannada");
    expect(prompt).toContain("DOCUMENT_COMPARISON");
  });
});

describe("demo provider", () => {
  it("produces schema-valid, context-derived output for every task type", async () => {
    const provider = getProvider();
    const base = {
      language: "kn" as const,
      application: {
        referenceNumber: "SF/INC/2026/00009",
        type: "INCOME_CERTIFICATE",
        stage: "DOCUMENT_SCRUTINY",
        declaredAnnualIncome: 120000,
        incomeSource: "AGRICULTURE",
        purpose: "SCHOLARSHIP",
        submittedAt: new Date().toISOString(),
      },
      applicant: { fullName: "Lakshmamma", fatherName: "Hanumaiah", village: "Harohalli", taluk: "Kanakapura", district: "Ramanagara", address: "No 42" },
      documents: [
        { documentType: "AADHAAR", filename: "aadhaar.pdf", verificationStatus: "PENDING", extractedData: { holderName: "Lakshmamma", annualIncome: "98000" } },
        { documentType: "INCOME_PROOF", filename: "income.pdf", verificationStatus: "PENDING", extractedData: { holderName: "Lakshmama", annualIncome: "98000" } },
      ],
      requiredDocuments: [
        { documentType: "AADHAAR", labelEn: "Aadhaar card", required: true },
        { documentType: "INCOME_PROOF", labelEn: "Income proof", required: true },
        { documentType: "RATION_CARD", labelEn: "Ration card", required: true },
      ],
    };
    for (const taskType of ["DOCUMENT_EXTRACTION", "DOCUMENT_COMPARISON", "MISSING_INFO", "CASE_SUMMARY", "DECISION_SUPPORT", "FIELD_REPORT"] as const) {
      const out = await provider.generate({ ...base, taskType });
      const parsed = aiResultSchema.safeParse(out);
      expect(parsed.success, taskType).toBe(true);
      expect(out.summary.length).toBeGreaterThan(10);
      expect(out.confidence).toBeGreaterThanOrEqual(0);
      expect(out.confidence).toBeLessThanOrEqual(1);
    }
    const cmp = await provider.generate({ ...base, taskType: "MISSING_INFO" });
    expect(cmp.missingInfo.join(" ")).toMatch(/RATION_CARD|Ration/i);
  });
});
