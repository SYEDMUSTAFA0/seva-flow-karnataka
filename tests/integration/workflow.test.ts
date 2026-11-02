import { beforeAll, describe, expect, it } from "vitest";
import { SAMPLE_APPLICATION, setupTestDb } from "../helpers/testdb";
import type { AuthUser } from "@/lib/permissions";

const svc = () => import("@/lib/services/applications");
const { STAGES, DECISIONS, RECOMMENDATIONS, FIELD_OUTCOMES, DOCUMENT_TYPES } = await import(
  "@/lib/constants"
);

let users: Awaited<ReturnType<typeof setupTestDb>>["users"];
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];
let fieldOther: AuthUser;

beforeAll(async () => {
  const db = await setupTestDb();
  users = db.users;
  prisma = db.prisma;
  const u = await prisma.user.create({
    data: { email: "field-other@test.kar", name: "Other FO", passwordHash: "x", roleId: "FIELD_OFFICER", taluk: "Kanakapura", district: "Ramanagara" },
  });
  fieldOther = { id: u.id, email: u.email, name: u.name, nameKn: null, roleId: "FIELD_OFFICER", roleNameEn: "Field Officer", roleNameKn: "ಕ್ಷೇತ್ರ ಅಧಿಕಾರಿ", taluk: u.taluk, district: u.district };
});

async function makeApplication(u: AuthUser = users.inspector) {
  const { createApplication } = await svc();
  return createApplication(u, { ...SAMPLE_APPLICATION });
}

describe("application creation", () => {
  it("creates an application with sequential reference number + audit + timeline", async () => {
    const app = await makeApplication();
    expect(app.referenceNumber).toMatch(/^SF\/INC\/\d{4}\/\d{6}$/);
    expect(app.currentStage).toBe(STAGES.RECEIVED);

    const audits = await prisma.auditLog.findMany({ where: { applicationId: app.id } });
    expect(audits.map((a) => a.action)).toContain("APPLICATION_CREATED");
    const timeline = await prisma.applicationTimeline.findMany({ where: { applicationId: app.id } });
    expect(timeline.length).toBeGreaterThan(0);
  });

  it("denies creation to roles without app:create", async () => {
    await expect(makeApplication(users.field)).rejects.toThrow("FORBIDDEN");
    await expect(makeApplication(users.approver)).rejects.toThrow("FORBIDDEN");
  });
});

describe("full approval workflow", () => {
  it("walks RECEIVED → APPROVED with audit at every step and a certificate number", async () => {
    const { advanceStage, verifyDocument, submitFieldVerification, submitRecommendation, submitDecision, getApplicationOrThrow } =
      await svc();
    const app = await makeApplication();

    // received → scrutiny (inspector only)
    await expect(advanceStage(users.field, app.id, STAGES.DOCUMENT_SCRUTINY)).rejects.toThrow("FORBIDDEN");
    await advanceStage(users.inspector, app.id, STAGES.DOCUMENT_SCRUTINY);

    // add a document + verify it
    const doc = await prisma.applicationDocument.create({
      data: {
        applicationId: app.id,
        documentType: DOCUMENT_TYPES.AADHAAR,
        storageKey: "test/aadhaar.pdf",
        originalFilename: "aadhaar.pdf",
        mimeType: "application/pdf",
        sizeBytes: 12345,
        uploadedById: users.inspector.id,
      },
    });
    await expect(verifyDocument(users.field, doc.id, "VERIFIED")).rejects.toThrow("FORBIDDEN");
    await verifyDocument(users.inspector, doc.id, "VERIFIED");
    const verified = await prisma.applicationDocument.findUnique({ where: { id: doc.id } });
    expect(verified?.verificationStatus).toBe("VERIFIED");

    // scrutiny → field verification (assigns a field officer)
    const toField = await advanceStage(users.inspector, app.id, STAGES.FIELD_VERIFICATION);
    expect(toField.assignedOfficerId).toBe(users.field.id);

    // unassigned field officer cannot verify
    await expect(
      submitFieldVerification(fieldOther, app.id, {
        visitedAt: new Date(),
        checklist: [{ key: "residenceConfirmed", label: "Residence", answer: true }],
        rawNotes: "x", observations: "x", outcome: FIELD_OUTCOMES.VERIFIED, aiAssisted: false,
      })
    ).rejects.toThrow("FORBIDDEN");

    // assigned field officer submits → recommendation stage
    await submitFieldVerification(users.field, app.id, {
      visitedAt: new Date(),
      checklist: [
        { key: "applicantPresent", label: "Applicant present", answer: true },
        { key: "residenceConfirmed", label: "Residence confirmed", answer: true },
        { key: "incomeConsistent", label: "Income consistent", answer: true },
      ],
      rawNotes: "House verified, applicant present, farmland matches declaration.",
      observations: "Residence and income consistent with application.",
      outcome: FIELD_OUTCOMES.VERIFIED,
      aiAssisted: true,
      locationLat: 12.55,
      locationLng: 77.42,
    });
    let state = await getApplicationOrThrow(users.inspector, app.id);
    expect(state?.currentStage).toBe(STAGES.OFFICER_RECOMMENDATION);
    expect(state?.fieldVerification?.outcome).toBe(FIELD_OUTCOMES.VERIFIED);

    // recommendation → final decision
    await expect(
      submitRecommendation(users.field, app.id, { recommendation: RECOMMENDATIONS.RECOMMEND_APPROVAL, remarks: "ok", aiAssisted: false })
    ).rejects.toThrow("FORBIDDEN");
    await submitRecommendation(users.inspector, app.id, {
      recommendation: RECOMMENDATIONS.RECOMMEND_APPROVAL,
      remarks: "Documents verified, field report satisfactory.",
      aiAssisted: true,
      aiSummary: "Case appears consistent.",
    });
    state = await getApplicationOrThrow(users.inspector, app.id);
    expect(state?.currentStage).toBe(STAGES.FINAL_DECISION);

    // only the approving officer decides
    await expect(
      submitDecision(users.inspector, app.id, { decision: DECISIONS.APPROVED, approvedIncome: 120000 })
    ).rejects.toThrow("FORBIDDEN");
    await submitDecision(users.approver, app.id, {
      decision: DECISIONS.APPROVED,
      approvedIncome: 120000,
      remarks: "All checks satisfied.",
    });

    state = await getApplicationOrThrow(users.inspector, app.id);
    expect(state?.currentStage).toBe(STAGES.APPROVED);
    expect(state?.decision?.certificateNumber).toMatch(/^IC\/RAM\/\d{4}\/\d{6}$/);
    expect(state?.decision?.approvedIncome).toBe(120000);

    // double decision blocked
    await expect(
      submitDecision(users.approver, app.id, { decision: DECISIONS.REJECTED, reason: "late change" })
    ).rejects.toThrow("FORBIDDEN");

    // audit + timeline cover the whole journey
    const actions = (await prisma.auditLog.findMany({ where: { applicationId: app.id }, orderBy: { createdAt: "asc" } })).map(
      (a) => a.action
    );
    for (const expected of [
      "APPLICATION_CREATED",
      "STAGE_CHANGED",
      "DOCUMENT_VERIFIED",
      "FIELD_SUBMITTED",
      "RECOMMENDATION_SUBMITTED",
      "CERTIFICATE_GENERATED",
    ]) {
      expect(actions).toContain(expected);
    }
  });
});

describe("return + resubmission workflow", () => {
  it("returns from scrutiny, re-enters on resubmission, counts resubmissions", async () => {
    const { advanceStage, getApplicationOrThrow } = await svc();
    const app = await makeApplication();
    await advanceStage(users.inspector, app.id, STAGES.DOCUMENT_SCRUTINY);
    await advanceStage(users.inspector, app.id, STAGES.RETURNED, {
      remarks: "Income proof missing",
      explanationKn: "ಆದಾಯದ ಪುರಾವೆ ಸಲ್ಲಿಸಿ",
    });
    let state = await getApplicationOrThrow(users.inspector, app.id);
    expect(state?.currentStage).toBe(STAGES.RETURNED);

    const audits = await prisma.auditLog.findMany({ where: { applicationId: app.id, action: "RETURNED" } });
    expect(audits.length).toBe(1);
    expect(audits[0].remarks).toContain("Income proof");
    const returnedEntry = await prisma.applicationTimeline.findFirst({
      where: { applicationId: app.id, action: "RETURNED" },
    });
    expect(returnedEntry?.remarksKn).toContain("ಆದಾಯದ");

    await advanceStage(users.inspector, app.id, STAGES.DOCUMENT_SCRUTINY);
    state = await getApplicationOrThrow(users.inspector, app.id);
    expect(state?.currentStage).toBe(STAGES.DOCUMENT_SCRUTINY);
    expect(state?.resubmissionCount).toBe(1);
  });
});

describe("rejection workflow", () => {
  it("records a reasoned rejection in a terminal state", async () => {
    const { advanceStage, submitDecision, getApplicationOrThrow } = await svc();
    const app = await makeApplication();
    await advanceStage(users.inspector, app.id, STAGES.DOCUMENT_SCRUTINY);
    // direct path: scrutiny → FINAL_DECISION via reject recommendation
    await advanceStage(users.inspector, app.id, STAGES.FINAL_DECISION);
    await submitDecision(users.approver, app.id, {
      decision: DECISIONS.REJECTED,
      reason: "Documents submitted could not be verified",
      reasonKn: "ಸಲ್ಲಿಸಿದ ದಾಖಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಲಾಗಲಿಲ್ಲ",
    });
    const state = await getApplicationOrThrow(users.approver, app.id);
    expect(state?.currentStage).toBe(STAGES.REJECTED);
    expect(state?.decision?.reason).toContain("verified");
    expect(state?.decision?.certificateNumber).toBeNull();

    // rejection without reason is refused
    const app2 = await makeApplication();
    await advanceStage(users.inspector, app2.id, STAGES.DOCUMENT_SCRUTINY);
    await advanceStage(users.inspector, app2.id, STAGES.FINAL_DECISION);
    await expect(submitDecision(users.approver, app2.id, { decision: DECISIONS.REJECTED })).rejects.toThrow("FORBIDDEN");
  });
});

describe("field return-for-clarification", () => {
  it("RETURN_FOR_CLARIFICATION routes the application back to RETURNED", async () => {
    const { advanceStage, submitFieldVerification, getApplicationOrThrow } = await svc();
    const app = await makeApplication();
    await advanceStage(users.inspector, app.id, STAGES.DOCUMENT_SCRUTINY);
    await advanceStage(users.inspector, app.id, STAGES.FIELD_VERIFICATION);
    await submitFieldVerification(users.field, app.id, {
      visitedAt: new Date(),
      checklist: [{ key: "residenceConfirmed", label: "r", answer: null }],
      rawNotes: "Applicant not present; address partially matches.",
      observations: "Could not confirm residence.",
      outcome: FIELD_OUTCOMES.RETURN_FOR_CLARIFICATION,
      aiAssisted: false,
    });
    const state = await getApplicationOrThrow(users.inspector, app.id);
    expect(state?.currentStage).toBe(STAGES.RETURNED);
  });
});
