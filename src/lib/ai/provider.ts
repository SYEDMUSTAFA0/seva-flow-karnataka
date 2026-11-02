import { aiResultSchema, type AiContext, type AiResult } from "./schemas";

export class AiError extends Error {
  constructor(
    public code: "NO_PROVIDER" | "PROVIDER_ERROR" | "BAD_OUTPUT" | "TIMEOUT",
    message: string
  ) {
    super(message);
  }
}

export interface AiProvider {
  name: string;
  model: string;
  generate(ctx: AiContext): Promise<AiResult>;
}

// ─── Provider selection ──────────────────────────────────────────────────────

export function getProvider(): AiProvider {
  const kind = (process.env.AI_PROVIDER ?? "demo").toLowerCase();
  if (kind === "openai" && process.env.OPENAI_API_KEY) return new OpenAIProvider();
  if (kind === "gemini" && process.env.GEMINI_API_KEY) return new GeminiProvider();
  // fall back to deterministic demo mode — clearly labelled everywhere
  return new DemoProvider();
}

export function providerInfo(): { provider: string; model: string; demo: boolean } {
  const kind = (process.env.AI_PROVIDER ?? "demo").toLowerCase();
  if (kind === "openai" && process.env.OPENAI_API_KEY)
    return { provider: "openai", model: process.env.OPENAI_MODEL ?? "gpt-4o-mini", demo: false };
  if (kind === "gemini" && process.env.GEMINI_API_KEY)
    return { provider: "gemini", model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash", demo: false };
  return { provider: "demo", model: "demo-deterministic", demo: true };
}

// ─── Shared prompt construction ──────────────────────────────────────────────

export function buildPrompt(ctx: AiContext): string {
  const langLine =
    ctx.language === "kn"
      ? "Write the summary and suggestedNextAction in Kannada. Keep field labels in English."
      : "Write in English.";
  return `You are an assistive AI inside a Karnataka government officer workflow for income certificate applications.

HARD RULES — violating them makes your output useless:
- NEVER decide eligibility or recommend a final verdict as fact. Officers decide.
- NEVER invent facts or document contents. Only use the data provided.
- Mark uncertain or OCR-derived values as requiring human verification.
- Explain the evidence behind every finding.

TASK: ${ctx.taskType}
${langLine}

Respond with STRICT JSON matching this shape (all keys required):
{
  "summary": "string — 2-4 sentence case summary",
  "findings": [{"label": "string", "value": "string", "evidence": "string", "severity": "info|warning|critical"}],
  "inconsistencies": [{"field": "string", "valueA": "string", "valueB": "string", "sourceA": "string", "sourceB": "string", "note": "string"}],
  "missingInfo": ["string"],
  "suggestedNextAction": "string",
  "questions": ["string — questions the officer should investigate"],
  "confidence": 0.0,
  "requiresHumanVerification": ["string"],
  "extractedFields": {"fieldName": "value"},
  "draftText": "string — only for FIELD_REPORT / DECISION_SUPPORT tasks"
}

APPLICATION DATA (fictional demo record):
${JSON.stringify(ctx, null, 1)}`;
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

class OpenAIProvider implements AiProvider {
  name = "openai";
  model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  async generate(ctx: AiContext): Promise<AiResult> {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You output strict JSON only. You are an advisory assistant to government officers; you never make final decisions." },
          { role: "user", content: buildPrompt(ctx) },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new AiError("PROVIDER_ERROR", `OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new AiError("BAD_OUTPUT", "Empty response from OpenAI");
    return parseOutput(text);
  }
}

// ─── Gemini ──────────────────────────────────────────────────────────────────

class GeminiProvider implements AiProvider {
  name = "gemini";
  model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";

  async generate(ctx: AiContext): Promise<AiResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
        contents: [{ role: "user", parts: [{ text: buildPrompt(ctx) }] }],
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new AiError("PROVIDER_ERROR", `Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new AiError("BAD_OUTPUT", "Empty response from Gemini");
    return parseOutput(text);
  }
}

function parseOutput(text: string): AiResult {
  try {
    const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return aiResultSchema.parse(JSON.parse(cleaned));
  } catch (e) {
    throw new AiError("BAD_OUTPUT", `AI returned unparseable output: ${(e as Error).message.slice(0, 200)}`);
  }
}

// ─── Deterministic demo provider ─────────────────────────────────────────────
// Realistic, context-aware sample output built from actual application data.
// No model is called — every response is labelled demo everywhere in the UI.

class DemoProvider implements AiProvider {
  name = "demo";
  model = "demo-deterministic";

  async generate(ctx: AiContext): Promise<AiResult> {
    await new Promise((r) => setTimeout(r, 900)); // simulate latency
    switch (ctx.taskType) {
      case "DOCUMENT_EXTRACTION": return demoExtraction(ctx);
      case "DOCUMENT_COMPARISON": return demoComparison(ctx);
      case "MISSING_INFO": return demoMissingInfo(ctx);
      case "FIELD_REPORT": return demoFieldReport(ctx);
      case "CASE_SUMMARY": return demoCaseSummary(ctx);
      case "DECISION_SUPPORT": return demoDecisionSupport(ctx);
    }
  }
}

const norm = (s?: string | null) => (s ?? "").toLowerCase().replace(/[^a-z]/g, "");
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function demoExtraction(ctx: AiContext): AiResult {
  const docs = ctx.documents;
  const extractedFields: Record<string, string> = {};
  const findings = docs.map((d) => {
    const ed = d.extractedData ?? {};
    Object.entries(ed).forEach(([k, v]) => (extractedFields[`${d.documentType}.${k}`] = v));
    return {
      label: `${d.documentType.replace(/_/g, " ")} — ${d.filename}`,
      value: Object.entries(ed).map(([k, v]) => `${k}: ${v}`).join(" · ") || "No fields could be extracted",
      evidence: "Stored extraction from document analysis",
      severity: d.extractedData ? ("info" as const) : ("warning" as const),
    };
  });
  const missing = ctx.requiredDocuments
    .filter((r) => r.required && !docs.some((d) => d.documentType === r.documentType && d.verificationStatus !== "INVALID"))
    .map((r) => `${r.labelEn} (${r.documentType})`);
  const kn = ctx.language === "kn";
  return {
    summary: kn
      ? `${ctx.applicant.fullName} ಅವರ ಅರ್ಜಿಯಲ್ಲಿ ${docs.length} ದಾಖಲೆಗಳಿವೆ. ${missing.length > 0 ? `${missing.length} ಕಡ್ಡಾಯ ದಾಖಲೆ(ಗಳು) ಕಾಣೆಯಾಗಿವೆ.` : "ಎಲ್ಲಾ ಕಡ್ಡಾಯ ದಾಖಲೆಗಳು ಅಪ್‌ಲೋಡ್ ಆಗಿವೆ."} ಹೊರತೆಗೆದ ಮಾಹಿತಿಯನ್ನು ಮೂಲ ದಾಖಲೆಗಳೊಂದಿಗೆ ಪರಿಶೀಲಿಸಿ.`
      : `${docs.length} document(s) on file for ${ctx.applicant.fullName}. ${missing.length > 0 ? `${missing.length} required document(s) missing.` : "All required documents are uploaded."} Verify extracted values against originals.`,
    findings,
    inconsistencies: [],
    missingInfo: missing,
    suggestedNextAction: kn
      ? missing.length ? "ಕಾಣೆಯಾದ ದಾಖಲೆಗಳಿಗಾಗಿ ಅರ್ಜಿದಾರರಿಗೆ ಮನವಿ ಕಳುಹಿಸಿ." : "ದಾಖಲೆ ಪರಿಶೀಲನೆ ಮುಗಿಯಿಸಿ ಹೋಲಿಕೆ ನಡೆಸಿ."
      : missing
        ? "Request the missing documents from the applicant."
        : "Complete document scrutiny and run a cross-document comparison.",
    questions: docs.filter((d) => !d.extractedData).map((d) => `Manually inspect ${d.filename} — extraction was not possible.`),
    confidence: 0.72,
    requiresHumanVerification: docs.map((d) => `${d.documentType}: confirm extracted values against the original`),
    extractedFields,
  };
}

function demoComparison(ctx: AiContext): AiResult {
  const inconsistencies = [];
  const names = new Map<string, string>();
  for (const d of ctx.documents) {
    const n = d.extractedData?.name ?? d.extractedData?.headOfFamily;
    if (n) names.set(d.documentType, n);
  }
  const appName = ctx.applicant.fullName;
  const uniqueNames = [...new Set([appName, ...names.values()])];
  const normSet = new Set(uniqueNames.map(norm));
  if (normSet.size > 1) {
    inconsistencies.push({
      field: "Applicant name",
      valueA: appName,
      valueB: uniqueNames.find((n) => norm(n) !== norm(appName)) ?? "",
      sourceA: "Application form",
      sourceB: [...names.entries()].find(([, n]) => norm(n) !== norm(appName))?.[0] ?? "documents",
      note: "Name spelling differs across records — confirm the correct legal spelling.",
    });
  }

  const incomeDoc = ctx.documents.find((d) => d.documentType === "INCOME_PROOF" || d.documentType === "SELF_DECLARATION");
  const docIncome = incomeDoc?.extractedData?.annualIncome ? Number(incomeDoc.extractedData.annualIncome) : null;
  if (docIncome != null && Math.abs(docIncome - ctx.application.declaredAnnualIncome) > ctx.application.declaredAnnualIncome * 0.15) {
    inconsistencies.push({
      field: "Annual income",
      valueA: inr(ctx.application.declaredAnnualIncome),
      valueB: inr(docIncome),
      sourceA: "Declared in application",
      sourceB: incomeDoc?.documentType ?? "document",
      note: "Documented income differs materially from the declared amount — investigate.",
    });
  }

  const addresses = new Set(
    ctx.documents
      .map((d) => d.extractedData?.address)
      .filter(Boolean)
      .map((a) => norm(a).slice(0, 40))
  );
  if (addresses.size > 1) {
    inconsistencies.push({
      field: "Address",
      valueA: ctx.applicant.address,
      valueB: "Differing address strings across documents",
      sourceA: "Application form",
      sourceB: "Uploaded documents",
      note: "Address wording differs — verify current residence.",
    });
  }

  const kn = ctx.language === "kn";
  return {
    summary: kn
      ? inconsistencies.length
        ? `${inconsistencies.length} ಸಂಭಾವ್ಯ ಅಸಂಗತಿ(ಗಳು) ಕಂಡುಬಂದಿವೆ. ಸಲ್ಲಿಸುವ ಮೊದಲು ಪರಿಶೀಲಿಸಿ.`
        : "ದಾಖಲೆಗಳಾದ್ಯಂತ ಹೆಸರು, ವಿಳಾಸ ಮತ್ತು ಆದಾಯ ಹೋಲಿಕೆ ಮಾಡಲಾಗಿದೆ — ಯಾವುದೇ ಅಸಂಗತಿ ಕಂಡುಬಂದಿಲ್ಲ."
      : inconsistencies.length
        ? `${inconsistencies.length} possible inconsistency(ies) found across documents. Review before proceeding.`
        : "Compared names, addresses and income across documents — no inconsistencies detected.",
    findings: [
      { label: "Documents compared", value: String(ctx.documents.length), severity: "info" },
      { label: "Name variants seen", value: uniqueNames.join(" / ") || "—", severity: inconsistencies.some((i) => i.field === "Applicant name") ? "warning" : "info" },
      { label: "Declared income", value: inr(ctx.application.declaredAnnualIncome), severity: "info" },
    ],
    inconsistencies,
    missingInfo: [],
    suggestedNextAction: kn
      ? inconsistencies.length ? "ಅಸಂಗತಿಗಳನ್ನು ಅರ್ಜಿದಾರರೊಂದಿಗೆ ಸ್ಪಷ್ಟಿಸಿ ಅಥವಾ ಹಸ್ತಚಾಲಿತವಾಗಿ ಪರಿಶೀಲಿಸಿ." : "ದಾಖಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿದೆ ಎಂದು ಗುರುತಿಸಿ ಮುಂದುವರೆಯಿರಿ."
      : inconsistencies.length
        ? "Clarify inconsistencies with the applicant or verify manually."
        : "Mark documents verified and proceed.",
    questions: inconsistencies.map((i) => `Confirm ${i.field}: which value is correct — ${i.valueA} or ${i.valueB}?`),
    confidence: inconsistencies.length ? 0.64 : 0.8,
    requiresHumanVerification: inconsistencies.map((i) => i.field),
  };
}

function demoMissingInfo(ctx: AiContext): AiResult {
  const present = new Set(ctx.documents.filter((d) => d.verificationStatus !== "INVALID").map((d) => d.documentType));
  const missing = ctx.requiredDocuments.filter((r) => r.required && !present.has(r.documentType));
  // group: income evidence covered if either member uploaded
  const hasIncomeEvidence = present.has("INCOME_PROOF") || present.has("SELF_DECLARATION");
  const effectiveMissing = missing.filter(
    (m) => !(m.documentType === "INCOME_PROOF" && hasIncomeEvidence) && !(m.documentType === "SELF_DECLARATION" && hasIncomeEvidence)
  );
  const kn = ctx.language === "kn";
  return {
    summary: kn
      ? effectiveMissing.length
        ? `${effectiveMissing.length} ಕಡ್ಡಾಯ ದಾಖಲೆ(ಗಳು) ಕಾಣೆಯಾಗಿವೆ: ${effectiveMissing.map((m) => m.labelEn).join(", ")}.`
        : "ಎಲ್ಲಾ ಕಡ್ಡಾಯ ದಾಖಲೆಗಳು ಸಲ್ಲಿಸಲಾಗಿವೆ."
      : effectiveMissing.length
        ? `${effectiveMissing.length} required document(s) missing: ${effectiveMissing.map((m) => m.labelEn).join(", ")}.`
        : "All required documents have been submitted.",
    findings: effectiveMissing.map((m) => ({ label: m.labelEn, value: m.documentType, severity: "warning" as const })),
    inconsistencies: [],
    missingInfo: effectiveMissing.map((m) => `${m.labelEn} — ${m.documentType}`),
    suggestedNextAction: kn
      ? effectiveMissing.length ? "ಕಾಣೆಯಾದ ದಾಖಲೆಗಳ ವಿವರವಾದ ಕನ್ನಡ ಮನವಿಯೊಂದಿಗೆ ಅರ್ಜಿಯನ್ನು ಹಿಂತಿರುಗಿಸಿ." : "ದಾಖಲೆ ಪರಿಶೀಲನೆಯನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ."
      : effectiveMissing.length
        ? "Return the application with a Kannada request listing the missing documents."
        : "Complete document scrutiny.",
    questions: [],
    confidence: 0.9,
    requiresHumanVerification: [],
  };
}

function demoFieldReport(ctx: AiContext): AiResult {
  const fv = ctx.fieldVerification;
  const unanswered = (fv?.checklist ?? []).filter((c) => c.answer == null).map((c) => c.label);
  const notes = (ctx.extraInput?.rawNotes as string) || fv?.rawNotes || "";
  const kn = ctx.language === "kn";
  const draft = [
    `FIELD VERIFICATION REPORT — ${ctx.application.referenceNumber}`,
    ``,
    `Applicant: ${ctx.applicant.fullName}${ctx.applicant.fatherName ? ` (father/guardian: ${ctx.applicant.fatherName})` : ""}`,
    `Address visited: ${ctx.applicant.address}, ${ctx.applicant.village}, ${ctx.applicant.taluk} taluk, ${ctx.applicant.district} district`,
    `Purpose: ${ctx.application.purpose} · Declared income: ${inr(ctx.application.declaredAnnualIncome)} (${ctx.application.incomeSource})`,
    ``,
    `Officer observations (from field notes):`,
    notes || "—",
    ``,
    `Checklist: ${(fv?.checklist ?? []).map((c) => `${c.label}: ${c.answer === true ? "Yes" : c.answer === false ? "No" : "—"}`).join(" | ")}`,
  ].join("\n");
  return {
    summary: kn
      ? `ಅಧಿಕಾರಿಯ ಟಿಪ್ಪಣಿಗಳ ಆಧಾರದ ಮೇಲೆ ರಚನಾತ್ಮಕ ವರದಿ ರಚಿಸಲಾಗಿದೆ. ${unanswered.length ? `${unanswered.length} ಪಟ್ಟಿ ಅಂಶಗಳಿಗೆ ಉತ್ತರಿಸಲಾಗಿಲ್ಲ.` : "ಎಲ್ಲಾ ಪಟ್ಟಿ ಅಂಶಗಳಿಗೆ ಉತ್ತರಿಸಲಾಗಿದೆ."} ಸಲ್ಲಿಸುವ ಮೊದಲು ಪರಿಶೀಲಿಸಿ ಸಂಪಾದಿಸಿ.`
      : `Structured report drafted from officer notes. ${unanswered.length ? `${unanswered.length} checklist item(s) unanswered.` : "All checklist items answered."} Review and edit before submitting.`,
    findings: [
      { label: "Notes captured", value: notes ? `${notes.length} chars` : "none", severity: notes ? "info" : "warning" },
      { label: "Checklist completion", value: `${(fv?.checklist ?? []).filter((c) => c.answer != null).length}/${(fv?.checklist ?? []).length}`, severity: unanswered.length ? "warning" : "info" },
    ],
    inconsistencies: [],
    missingInfo: unanswered,
    suggestedNextAction: kn ? "ವರದಿಯನ್ನು ಸಂಪಾದಿಸಿ ಫಲಿತಾಂಶ ಆಯ್ಕೆಮಾಡಿ ಸಲ್ಲಿಸಿ." : "Edit the report, choose an outcome and submit.",
    questions: unanswered.length ? [`Complete checklist items: ${unanswered.join(", ")}`] : [],
    confidence: notes ? 0.75 : 0.4,
    requiresHumanVerification: ["Confirm the report text accurately reflects the visit"],
    draftText: draft,
  };
}

function demoCaseSummary(ctx: AiContext): AiResult {
  const verifiedDocs = ctx.documents.filter((d) => d.verificationStatus === "VERIFIED").length;
  const fv = ctx.fieldVerification;
  const kn = ctx.language === "kn";
  return {
    summary: kn
      ? `${ctx.applicant.fullName}, ${ctx.applicant.village}, ${ctx.applicant.taluk} ತಾಲೂಕು — ${ctx.application.purpose} ಗಾಗಿ ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ ಅರ್ಜಿ. ಘೋಷಿತ ಆದಾಯ ${inr(ctx.application.declaredAnnualIncome)} (${ctx.application.incomeSource}). ${verifiedDocs}/${ctx.documents.length} ದಾಖಲೆಗಳು ಪರಿಶೀಲಿಸಲಾಗಿವೆ. ಸ್ಥಳ ಪರಿಶೀಲನೆ: ${fv?.outcome ?? "ಮಾಡಲಾಗಿಲ್ಲ"}.`
      : `${ctx.applicant.fullName} of ${ctx.applicant.village}, ${ctx.applicant.taluk} taluk applied for an income certificate for ${ctx.application.purpose}. Declared income ${inr(ctx.application.declaredAnnualIncome)} (${ctx.application.incomeSource}). ${verifiedDocs}/${ctx.documents.length} documents verified. Field verification: ${fv?.outcome ?? "not done"}.`,
    findings: [
      { label: "Declared income", value: inr(ctx.application.declaredAnnualIncome), evidence: "Application form", severity: "info" },
      { label: "Documents verified", value: `${verifiedDocs}/${ctx.documents.length}`, evidence: "Document checklist", severity: verifiedDocs === ctx.documents.length ? "info" : "warning" },
      { label: "Field outcome", value: fv?.outcome ?? "—", evidence: "Field verification report", severity: fv?.outcome === "VERIFIED" ? "info" : "warning" },
    ],
    inconsistencies: [],
    missingInfo: [],
    suggestedNextAction: kn
      ? fv?.outcome === "VERIFIED" ? "ಅನುಮೋದನೆಯನ್ನು ಶಿಫಾರಸು ಮಾಡುವುದನ್ನು ಪರಿಗಣಿಸಿ." : "ಸ್ಥಳ ಪರಿಶೀಲನೆಯ ಫಲಿತಾಂಶದ ಆಧಾರದ ಮೇಲೆ ನಿರ್ಧರಿಸಿ."
      : fv?.outcome === "VERIFIED" ? "Consider recommending approval." : "Base the recommendation on the field verification outcome.",
    questions: [],
    confidence: 0.74,
    requiresHumanVerification: ["Confirm income figure against income evidence", "Review field report observations"],
  };
}

function demoDecisionSupport(ctx: AiContext): AiResult {
  const comp = demoComparison(ctx);
  const verifiedDocs = ctx.documents.filter((d) => d.verificationStatus === "VERIFIED").length;
  const fv = ctx.fieldVerification;
  const blockers = comp.inconsistencies.length + (fv?.outcome && fv.outcome !== "VERIFIED" ? 1 : 0);
  const leaning = blockers === 0 && verifiedDocs === ctx.documents.length ? "RECOMMEND_APPROVAL" : blockers > 1 ? "RECOMMEND_REJECTION" : "RETURN_FOR_VERIFICATION";
  const kn = ctx.language === "kn";
  return {
    summary: kn
      ? `ಡಾಕ್ಯುಮೆಂಟ್ ಸ್ಥಿತಿ: ${verifiedDocs}/${ctx.documents.length} ಪರಿಶೀಲಿಸಲಾಗಿದೆ. ಸ್ಥಳ ಪರಿಶೀಲನೆ: ${fv?.outcome ?? "—"}. ${comp.inconsistencies.length} ಅಸಂಗತಿಗಳು ಕಂಡುಬಂದಿವೆ. ಸಲಹೆ: ${leaning} — ಇದು ಕೇವಲ ಸಲಹೆ; ಅಂತಿಮ ನಿರ್ಧಾರ ನಿಮ್ಮದು.`
      : `Document status: ${verifiedDocs}/${ctx.documents.length} verified. Field verification: ${fv?.outcome ?? "—"}. ${comp.inconsistencies.length} inconsistency(ies) detected. Suggestion: ${leaning} — advisory only; the final decision is yours.`,
    findings: [
      { label: "Documents verified", value: `${verifiedDocs}/${ctx.documents.length}`, severity: verifiedDocs === ctx.documents.length ? "info" : "warning" },
      { label: "Field outcome", value: fv?.outcome ?? "not completed", severity: fv?.outcome === "VERIFIED" ? "info" : "warning" },
      { label: "Inconsistencies", value: String(comp.inconsistencies.length), severity: comp.inconsistencies.length ? "critical" : "info" },
    ],
    inconsistencies: comp.inconsistencies,
    missingInfo: comp.missingInfo,
    suggestedNextAction: leaning,
    questions: comp.questions,
    confidence: 0.68,
    requiresHumanVerification: ["Review all flagged inconsistencies", "Confirm approved income amount", "Verify field report"],
    draftText: `${leaning}: Based on ${verifiedDocs}/${ctx.documents.length} verified documents, field outcome "${fv?.outcome ?? "n/a"}" and ${comp.inconsistencies.length} unresolved inconsistency(ies). Officer review required before decision.`,
  };
}
