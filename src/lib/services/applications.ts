import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AuthError } from "@/lib/auth";
import {
  canTransition,
  canViewApplication,
  hasPermission,
  type AuthUser,
} from "@/lib/permissions";
import { notify, recordChange } from "@/lib/audit";
import {
  DECISIONS,
  FIELD_OUTCOMES,
  PERMISSIONS,
  RECOMMENDATIONS,
  STAGES,
  type Stage,
  INTERNAL_TARGET_DAYS,
} from "@/lib/constants";
import { daysBetween, formatCertificate, formatReference } from "@/lib/utils";

export interface DocChecklistRow {
  documentType: string;
  labelEn: string;
  labelKn: string;
  required: boolean;
  alternativeOf: string | null;
  groupSatisfied?: boolean;
  document: {
    id: string;
    originalFilename: string;
    mimeType: string;
    uploadedAt: Date;
    verificationStatus: string;
    extractedData: string | null;
    storageKey: string;
  } | null;
}

/** Merge configured requirements with uploaded docs → checklist view model. */
export function buildChecklist(
  requirements: Array<{
    documentType: string;
    labelEn: string;
    labelKn: string;
    required: boolean;
    alternativeOf: string | null;
    sortOrder: number;
  }>,
  documents: Array<{
    id: string;
    documentType: string;
    originalFilename: string;
    mimeType: string;
    uploadedAt: Date;
    verificationStatus: string;
    extractedData: string | null;
    storageKey: string;
  }>
): DocChecklistRow[] {
  const byType = new Map<string, typeof documents>();
  for (const d of documents) {
    const list = byType.get(d.documentType) ?? [];
    list.push(d);
    byType.set(d.documentType, list);
  }

  const rows: DocChecklistRow[] = requirements.map((r) => {
    const candidates = byType.get(r.documentType) ?? [];
    const doc =
      candidates.find((c) => c.verificationStatus === "VERIFIED") ??
      candidates.find((c) => c.verificationStatus !== "INVALID") ??
      candidates[0] ??
      null;
    return { ...r, document: doc };
  });

  // group satisfaction: e.g. INCOME_EVIDENCE satisfied by any of its types
  const groups = new Map<string, boolean>();
  for (const r of requirements.filter((x) => x.alternativeOf)) {
    const key = r.alternativeOf!;
    const satisfied =
      groups.get(key) ||
      documents.some(
        (d) =>
          requirements.find((x) => x.documentType === d.documentType)?.alternativeOf === key &&
          d.verificationStatus !== "INVALID"
      );
    groups.set(key, satisfied);
  }
  for (const row of rows) {
    if (row.alternativeOf) row.groupSatisfied = groups.get(row.alternativeOf) ?? false;
  }
  return rows;
}

export function missingRequirementCount(rows: DocChecklistRow[]): number {
  let missing = 0;
  const groupDone = new Set<string>();
  for (const r of rows) {
    if (!r.required) continue;
    if (r.alternativeOf) {
      if (groupDone.has(r.alternativeOf)) continue;
      groupDone.add(r.alternativeOf);
      if (!r.groupSatisfied) missing++;
    } else if (!r.document) {
      missing++;
    }
  }
  return missing;
}

export function computePriorityScore(app: {
  submittedAt: Date;
  currentStage: string;
  internalTargetDate: Date | null;
  missingDocs?: number;
}): number {
  const age = daysBetween(app.submittedAt);
  const stageW: Record<string, number> = {
    [STAGES.FINAL_DECISION]: 40,
    [STAGES.OFFICER_RECOMMENDATION]: 30,
    [STAGES.FIELD_VERIFICATION]: 25,
    [STAGES.DOCUMENT_SCRUTINY]: 15,
    [STAGES.RECEIVED]: 10,
    [STAGES.RETURNED]: 5,
  };
  const overdue = app.internalTargetDate && new Date() > app.internalTargetDate ? 25 : 0;
  return age * 10 + (stageW[app.currentStage] ?? 0) + (app.missingDocs ?? 0) * 15 + overdue;
}

export function nextActionKey(stage: string): string {
  switch (stage) {
    case STAGES.RECEIVED: return "beginScrutiny";
    case STAGES.DOCUMENT_SCRUTINY: return "verifyDocuments";
    case STAGES.FIELD_VERIFICATION: return "conductVisit";
    case STAGES.OFFICER_RECOMMENDATION: return "submitRecommendation";
    case STAGES.FINAL_DECISION: return "recordDecision";
    case STAGES.RETURNED: return "awaitResubmission";
    default: return "closed";
  }
}

// ─── Queries ─────────────────────────────────────────────────────────────────

const listInclude = {
  applicant: true,
  assignedOfficer: { select: { id: true, name: true, nameKn: true } },
} satisfies Prisma.ApplicationInclude;

export type ListFilters = {
  q?: string;
  stage?: string;
  district?: string;
  mine?: boolean;
  sort?: string;
  page?: number;
  pageSize?: number;
  view?: string;
};

export async function listApplications(user: AuthUser, f: ListFilters) {
  const where: Prisma.ApplicationWhereInput = {};
  if (!hasPermission(user, PERMISSIONS.APP_VIEW_ALL)) {
    where.assignedOfficerId = user.id;
  } else if (f.mine) {
    where.assignedOfficerId = user.id;
  }
  if (f.stage && f.stage !== "all") where.currentStage = f.stage;
  if (f.view === "field") {
    where.currentStage = STAGES.FIELD_VERIFICATION;
    where.assignedOfficerId = hasPermission(user, PERMISSIONS.APP_VIEW_ALL) ? undefined : user.id;
    if (hasPermission(user, PERMISSIONS.APP_VIEW_ALL)) delete where.assignedOfficerId;
    else where.assignedOfficerId = user.id;
  }
  if (f.district && f.district !== "all") where.applicant = { district: f.district };
  if (f.q) {
    where.OR = [
      { referenceNumber: { contains: f.q, mode: "insensitive" } },
      { applicant: { fullName: { contains: f.q, mode: "insensitive" } } },
      { applicant: { fullNameKn: { contains: f.q } } },
      { applicant: { village: { contains: f.q, mode: "insensitive" } } },
      { applicant: { villageKn: { contains: f.q } } },
    ];
  }

  const page = Math.max(1, f.page ?? 1);
  const pageSize = f.pageSize ?? 12;

  const orderBy: Prisma.ApplicationOrderByWithRelationInput[] =
    f.sort === "oldest" ? [{ submittedAt: "asc" }]
    : f.sort === "priority" ? [{ priorityScore: "desc" }, { submittedAt: "asc" }]
    : f.sort === "income" ? [{ declaredAnnualIncome: "desc" }]
    : [{ submittedAt: "desc" }];

  const [total, rows] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({ where, include: listInclude, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { total, rows, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getApplicationOrThrow(user: AuthUser, id: string) {
  const app = await prisma.application.findUnique({
    where: { id },
    include: {
      applicant: true,
      assignedOfficer: { select: { id: true, name: true, nameKn: true, email: true } },
      documents: {
        include: { verifications: { include: { officer: { select: { name: true, nameKn: true } } } } },
        orderBy: { uploadedAt: "asc" },
      },
      fieldVerification: { include: { officer: { select: { name: true, nameKn: true } } } },
      recommendations: { include: { officer: { select: { name: true, nameKn: true } } }, orderBy: { createdAt: "desc" } },
      decision: { include: { officer: { select: { name: true, nameKn: true } } } },
      timeline: { include: { actor: { select: { name: true, nameKn: true } } }, orderBy: { createdAt: "desc" } },
      aiInteractions: { orderBy: { createdAt: "desc" }, take: 25 },
    },
  });
  if (!app) return null;
  if (!canViewApplication(user, app)) throw new AuthError("FORBIDDEN");
  return app;
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export async function createApplication(
  user: AuthUser,
  data: {
    applicant: {
      fullName: string;
      fullNameKn?: string;
      fatherName?: string;
      phone: string;
      alternatePhone?: string;
      addressLine1: string;
      addressLine2?: string;
      village: string;
      hobli?: string;
      taluk: string;
      district: string;
      districtKn?: string;
      pincode: string;
      aadhaarLast4?: string;
    };
    declaredAnnualIncome: number;
    incomeSource: string;
    purpose: string;
    purposeDetails?: string;
    assignedOfficerId?: string;
  }
) {
  if (!hasPermission(user, PERMISSIONS.APP_CREATE)) throw new AuthError("FORBIDDEN");

  const lastRef = await prisma.application.findFirst({
    where: { referenceNumber: { startsWith: `SF/INC/${new Date().getFullYear()}/` } },
    orderBy: { referenceNumber: "desc" },
    select: { referenceNumber: true },
  });
  const seq = lastRef ? parseInt(lastRef.referenceNumber.split("/").pop()!, 10) + 1 : 1;

  const assignee =
    data.assignedOfficerId ??
    (await prisma.user.findFirst({ where: { roleId: "REVENUE_INSPECTOR", active: true }, select: { id: true } }))?.id ??
    null;

  return prisma.$transaction(async (tx) => {
    const applicant = await tx.applicant.create({
      data: data.applicant as Prisma.ApplicantCreateInput,
    });
    const app = await tx.application.create({
      data: {
        referenceNumber: formatReference(seq),
        applicationType: "INCOME_CERTIFICATE",
        applicantId: applicant.id,
        assignedOfficerId: assignee,
        declaredAnnualIncome: data.declaredAnnualIncome,
        incomeSource: data.incomeSource,
        purpose: data.purpose,
        purposeDetails: data.purposeDetails ?? null,
        currentStage: STAGES.RECEIVED,
        status: STAGES.RECEIVED,
        priority: "NORMAL",
        priorityScore: 10,
        submittedAt: new Date(),
        internalTargetDate: new Date(Date.now() + INTERNAL_TARGET_DAYS * 86_400_000),
      },
    });
    await recordChange(
      {
        applicationId: app.id,
        actorId: user.id,
        action: "APPLICATION_CREATED",
        newStatus: STAGES.RECEIVED,
        remarks: `Application created for ${data.applicant.fullName}`,
      },
      tx
    );
    if (assignee) {
      await notify(
        {
          userId: assignee,
          applicationId: app.id,
          titleEn: `New application — ${app.referenceNumber}`,
          titleKn: `ಹೊಸ ಅರ್ಜಿ — ${app.referenceNumber}`,
          bodyEn: `${data.applicant.fullName} — income certificate`,
          bodyKn: `${data.applicant.fullName} — ಆದಾಯ ಪ್ರಮಾಣಪತ್ರ`,
        },
        tx
      );
    }
    return app;
  });
}

/** Move an application to a new stage with all side-effects. */
export async function advanceStage(
  user: AuthUser,
  applicationId: string,
  to: Stage,
  opts: { remarks?: string; remarksKn?: string; explanationKn?: string } = {}
) {
  const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { applicant: true } });
  if (!app) throw new AuthError("FORBIDDEN");
  if (!canViewApplication(user, app)) throw new AuthError("FORBIDDEN");
  if (!canTransition(user, app.currentStage as Stage, to)) throw new AuthError("FORBIDDEN");

  const nextAssignee = await pickAssigneeForStage(to, app.applicant.district);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.application.update({
      where: { id: applicationId },
      data: {
        currentStage: to,
        status: to,
        assignedOfficerId: nextAssignee ?? app.assignedOfficerId,
        resubmissionCount: app.currentStage === STAGES.RETURNED ? { increment: 1 } : app.resubmissionCount,
      },
    });
    await recordChange(
      {
        applicationId,
        actorId: user.id,
        action: app.currentStage === STAGES.RETURNED ? "RESUBMITTED" : to === STAGES.RETURNED ? "RETURNED" : "STAGE_CHANGED",
        previousStatus: app.currentStage,
        newStatus: to,
        remarks: opts.remarks ?? null,
        remarksKn: opts.remarksKn ?? opts.explanationKn ?? null,
      },
      tx
    );
    if (nextAssignee && nextAssignee !== app.assignedOfficerId) {
      await notify(
        {
          userId: nextAssignee,
          applicationId,
          titleEn: `Application ${app.referenceNumber} — ${to}`,
          titleKn: `ಅರ್ಜಿ ${app.referenceNumber} — ${to}`,
          bodyEn: "Assigned to your queue",
          bodyKn: "ನಿಮ್ಮ ಸರದಿಗೆ ನಿಯೋಜಿಸಲಾಗಿದೆ",
        },
        tx
      );
    }
    return updated;
  });
}

async function pickAssigneeForStage(stage: Stage, district?: string | null): Promise<string | null> {
  const roleFor: Partial<Record<Stage, string>> = {
    [STAGES.RECEIVED]: "REVENUE_INSPECTOR",
    [STAGES.DOCUMENT_SCRUTINY]: "REVENUE_INSPECTOR",
    [STAGES.FIELD_VERIFICATION]: "FIELD_OFFICER",
    [STAGES.OFFICER_RECOMMENDATION]: "REVENUE_INSPECTOR",
    [STAGES.FINAL_DECISION]: "APPROVING_OFFICER",
    [STAGES.RETURNED]: "REVENUE_INSPECTOR",
  };
  const roleId = roleFor[stage];
  if (!roleId) return null;
  // prefer an officer whose district matches the applicant's
  const officer = await prisma.user.findFirst({
    where: { roleId, active: true, ...(district ? { district } : {}) },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (officer) return officer.id;
  const anyOfficer = await prisma.user.findFirst({
    where: { roleId, active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return anyOfficer?.id ?? null;
}

export async function verifyDocument(
  user: AuthUser,
  documentId: string,
  status: "VERIFIED" | "INVALID" | "NEEDS_CLARIFICATION",
  remarks?: string
) {
  if (!hasPermission(user, PERMISSIONS.DOC_VERIFY)) throw new AuthError("FORBIDDEN");
  const doc = await prisma.applicationDocument.findUnique({
    where: { id: documentId },
    include: { application: true },
  });
  if (!doc || !canViewApplication(user, doc.application)) throw new AuthError("FORBIDDEN");
  if (!([STAGES.RECEIVED, STAGES.DOCUMENT_SCRUTINY, STAGES.RETURNED] as Stage[]).includes(doc.application.currentStage as Stage)) {
    throw new AuthError("FORBIDDEN");
  }

  return prisma.$transaction(async (tx) => {
    await tx.applicationDocument.update({ where: { id: documentId }, data: { verificationStatus: status } });
    const rec = await tx.documentVerification.create({
      data: { documentId, officerId: user.id, status, remarks: remarks ?? null },
    });
    await recordChange(
      {
        applicationId: doc.applicationId,
        actorId: user.id,
        action:
          status === "VERIFIED"
            ? "DOCUMENT_VERIFIED"
            : status === "INVALID"
              ? "DOCUMENT_MARKED_INVALID"
              : "DOCUMENT_CLARIFICATION",
        entityType: "ApplicationDocument",
        entityId: documentId,
        remarks,
      },
      tx
    );
    return rec;
  });
}

export async function submitFieldVerification(
  user: AuthUser,
  applicationId: string,
  data: {
    visitedAt: Date;
    checklist: { key: string; label: string; answer: boolean | null }[];
    rawNotes: string;
    observations: string;
    outcome: string;
    aiAssisted: boolean;
    applicantInteraction?: string;
    supportingImages?: string[];
    locationLat?: number;
    locationLng?: number;
  }
) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new AuthError("FORBIDDEN");
  const isAssigned = app.assignedOfficerId === user.id;
  const may =
    hasPermission(user, PERMISSIONS.FIELD_VERIFY) &&
    app.currentStage === STAGES.FIELD_VERIFICATION &&
    (isAssigned || hasPermission(user, PERMISSIONS.APP_VIEW_ALL));
  if (!may) throw new AuthError("FORBIDDEN");

  const nextStage =
    data.outcome === FIELD_OUTCOMES.RETURN_FOR_CLARIFICATION ? STAGES.RETURNED : STAGES.OFFICER_RECOMMENDATION;
  const nextAssignee = await pickAssigneeForStage(nextStage, null);

  return prisma.$transaction(async (tx) => {
    const fv = await tx.fieldVerification.upsert({
      where: { applicationId },
      update: {
        visitedAt: data.visitedAt,
        checklistJson: JSON.stringify(data.checklist),
        rawNotes: data.rawNotes,
        observations: data.observations,
        outcome: data.outcome,
        aiAssisted: data.aiAssisted,
        applicantPresent: data.checklist.find((c) => c.key === "applicantPresent")?.answer ?? null,
        residenceConfirmed: data.checklist.find((c) => c.key === "residenceConfirmed")?.answer ?? null,
        incomeConsistent: data.checklist.find((c) => c.key === "incomeConsistent")?.answer ?? null,
        neighbourConfirmed: data.checklist.find((c) => c.key === "neighbourConfirmed")?.answer ?? null,
        documentsShown: data.applicantInteraction ?? null,
        supportingImages: data.supportingImages ? JSON.stringify(data.supportingImages) : null,
        locationLat: data.locationLat ?? null,
        locationLng: data.locationLng ?? null,
        submittedAt: new Date(),
      },
      create: {
        applicationId,
        officerId: user.id,
        visitedAt: data.visitedAt,
        checklistJson: JSON.stringify(data.checklist),
        rawNotes: data.rawNotes,
        observations: data.observations,
        outcome: data.outcome,
        aiAssisted: data.aiAssisted,
        applicantPresent: data.checklist.find((c) => c.key === "applicantPresent")?.answer ?? null,
        residenceConfirmed: data.checklist.find((c) => c.key === "residenceConfirmed")?.answer ?? null,
        incomeConsistent: data.checklist.find((c) => c.key === "incomeConsistent")?.answer ?? null,
        neighbourConfirmed: data.checklist.find((c) => c.key === "neighbourConfirmed")?.answer ?? null,
        documentsShown: data.applicantInteraction ?? null,
        supportingImages: data.supportingImages ? JSON.stringify(data.supportingImages) : null,
        locationLat: data.locationLat ?? null,
        locationLng: data.locationLng ?? null,
        submittedAt: new Date(),
      },
    });

    await tx.application.update({
      where: { id: applicationId },
      data: { currentStage: nextStage, status: nextStage, assignedOfficerId: nextAssignee ?? app.assignedOfficerId },
    });
    await recordChange(
      {
        applicationId,
        actorId: user.id,
        action: nextStage === STAGES.RETURNED ? "RETURNED" : "FIELD_SUBMITTED",
        entityType: "FieldVerification",
        entityId: fv.id,
        previousStatus: app.currentStage,
        newStatus: nextStage,
        remarks: `Outcome: ${data.outcome}`,
        metadata: { aiAssisted: data.aiAssisted },
      },
      tx
    );
    return fv;
  });
}

export async function submitRecommendation(
  user: AuthUser,
  applicationId: string,
  data: { recommendation: string; remarks: string; aiAssisted: boolean; aiSummary?: string }
) {
  if (!hasPermission(user, PERMISSIONS.RECOMMEND)) throw new AuthError("FORBIDDEN");
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app || app.currentStage !== STAGES.OFFICER_RECOMMENDATION) throw new AuthError("FORBIDDEN");
  if (!Object.values(RECOMMENDATIONS).includes(data.recommendation as never)) throw new AuthError("FORBIDDEN");

  const nextStage =
    data.recommendation === RECOMMENDATIONS.RETURN_FOR_VERIFICATION
      ? STAGES.RETURNED
      : STAGES.FINAL_DECISION;
  const nextAssignee = await pickAssigneeForStage(nextStage, null);

  return prisma.$transaction(async (tx) => {
    const rec = await tx.officerRecommendation.create({
      data: {
        applicationId,
        officerId: user.id,
        recommendation: data.recommendation,
        remarks: data.remarks,
        aiAssisted: data.aiAssisted,
        aiSummary: data.aiSummary ?? null,
      },
    });
    await tx.application.update({
      where: { id: applicationId },
      data: { currentStage: nextStage, status: nextStage, assignedOfficerId: nextAssignee ?? app.assignedOfficerId },
    });
    await recordChange(
      {
        applicationId,
        actorId: user.id,
        action: nextStage === STAGES.RETURNED ? "RETURNED" : "RECOMMENDATION_SUBMITTED",
        entityType: "OfficerRecommendation",
        entityId: rec.id,
        previousStatus: app.currentStage,
        newStatus: nextStage,
        remarks: data.remarks,
        metadata: { recommendation: data.recommendation, aiAssisted: data.aiAssisted },
      },
      tx
    );
    if (nextAssignee) {
      await notify(
        {
          userId: nextAssignee,
          applicationId,
          titleEn: `${app.referenceNumber} ready for decision`,
          titleKn: `${app.referenceNumber} ನಿರ್ಧಾರಕ್ಕೆ ಸಿದ್ಧ`,
          bodyEn: `Recommendation: ${data.recommendation}`,
          bodyKn: "ಶಿಫಾರಸು ಸಲ್ಲಿಸಲಾಗಿದೆ",
        },
        tx
      );
    }
    return rec;
  });
}

export async function submitDecision(
  user: AuthUser,
  applicationId: string,
  data: {
    decision: string;
    reason?: string;
    reasonKn?: string;
    remarks?: string;
    approvedIncome?: number;
    applicantExplanationKn?: string;
  }
) {
  if (!hasPermission(user, PERMISSIONS.DECIDE)) throw new AuthError("FORBIDDEN");
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { applicant: true, decision: true },
  });
  if (!app || app.currentStage !== STAGES.FINAL_DECISION || app.decision) throw new AuthError("FORBIDDEN");
  if (!Object.values(DECISIONS).includes(data.decision as never)) throw new AuthError("FORBIDDEN");
  if (data.decision !== DECISIONS.APPROVED && !data.reason) throw new AuthError("FORBIDDEN");

  const certNumber =
    data.decision === DECISIONS.APPROVED
      ? formatCertificate(app.applicant.district, await nextCertSeq())
      : null;
  const returnAssignee =
    data.decision === DECISIONS.RETURNED ? await pickAssigneeForStage(STAGES.RETURNED, null) : null;

  return prisma.$transaction(async (tx) => {
    const dec = await tx.applicationDecision.create({
      data: {
        applicationId,
        officerId: user.id,
        decision: data.decision,
        reason: data.reason ?? null,
        reasonKn: data.applicantExplanationKn ?? data.reasonKn ?? null,
        remarks: data.remarks ?? null,
        approvedIncome: data.decision === DECISIONS.APPROVED ? (data.approvedIncome ?? null) : null,
        certificateNumber: certNumber,
      },
    });
    await tx.application.update({
      where: { id: applicationId },
      data: { currentStage: data.decision, status: data.decision, assignedOfficerId: returnAssignee ?? app.assignedOfficerId },
    });
    await recordChange(
      {
        applicationId,
        actorId: user.id,
        action:
          data.decision === DECISIONS.APPROVED
            ? "CERTIFICATE_GENERATED"
            : data.decision === DECISIONS.RETURNED
              ? "RETURNED"
              : "DECISION_MADE",
        entityType: "ApplicationDecision",
        entityId: dec.id,
        previousStatus: app.currentStage,
        newStatus: data.decision,
        remarks: data.reason ?? data.remarks ?? null,
        remarksKn: data.applicantExplanationKn ?? data.reasonKn ?? null,
        metadata: { certificateNumber: certNumber, approvedIncome: data.approvedIncome },
      },
      tx
    );
    return dec;
  });
}

async function nextCertSeq(): Promise<number> {
  const count = await prisma.applicationDecision.count({ where: { decision: DECISIONS.APPROVED } });
  return 1000 + count + 1;
}
