import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser, AuthError } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDict, getLanguage } from "@/i18n";
import { getApplicationOrThrow, buildChecklist, missingRequirementCount } from "@/lib/services/applications";
import { allowedTransitions, canDecide, canFieldVerify, hasPermission } from "@/lib/permissions";
import { PERMISSIONS, STAGES, type Stage } from "@/lib/constants";
import { StageBadge, PriorityBadge, DocStatusBadge } from "@/components/stage-badge";
import { StageStepper } from "@/components/stage-stepper";
import { Timeline } from "@/components/timeline";
import { AiPanel, AiHistory } from "@/components/ai-panel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailActions } from "./actions";
import {
  CalendarDays,
  FileText,
  IndianRupee,
  Landmark,
  MapPin,
  Phone,
  Scale,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { daysBetween, formatDate, formatDateTime, formatINR } from "@/lib/utils";

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const lang = await getLanguage();
  const t = await getDict();

  let app;
  try {
    app = await getApplicationOrThrow(user, id);
  } catch (e) {
    if (e instanceof AuthError) throw e;
    throw e;
  }
  if (!app) notFound();

  const requirements = await prisma.documentRequirement.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  const checklist = buildChecklist(requirements, app.documents);
  const missing = missingRequirementCount(checklist);
  const verifiedDocs = app.documents.filter((d) => d.verificationStatus === "VERIFIED").length;
  const stage = app.currentStage as Stage;
  const transitions = allowedTransitions(user, stage);
  const applicant = app.applicant;
  const isTerminal = ([STAGES.APPROVED, STAGES.REJECTED] as Stage[]).includes(stage);
  const aiHistory = app.aiInteractions.map((i) => ({
    id: i.id,
    taskType: i.taskType,
    model: i.model,
    provider: i.provider,
    confidence: i.confidence,
    createdAt: i.createdAt.toISOString(),
  }));

  const allowed = {
    beginScrutiny: stage === STAGES.RECEIVED && transitions.includes(STAGES.DOCUMENT_SCRUTINY),
    documents: stage === STAGES.DOCUMENT_SCRUTINY && hasPermission(user, PERMISSIONS.DOC_VERIFY),
    field: stage === STAGES.FIELD_VERIFICATION && canFieldVerify(user, app),
    recommendation: stage === STAGES.OFFICER_RECOMMENDATION && hasPermission(user, PERMISSIONS.RECOMMEND),
    decision: stage === STAGES.FINAL_DECISION && canDecide(user, app),
    resubmit: stage === STAGES.RETURNED && transitions.includes(STAGES.DOCUMENT_SCRUTINY),
  };

  const name = lang === "kn" && applicant.fullNameKn ? applicant.fullNameKn : applicant.fullName;
  const village = lang === "kn" && applicant.villageKn ? applicant.villageKn : applicant.village;
  const stageLabels = Object.fromEntries(Object.entries(t.stageShort)) as Record<string, string>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      {/* Breadcrumb + header */}
      <div className="mb-4 flex items-center gap-2 text-xs text-ink-3">
        <Link href="/applications" className="hover:text-ink hover:underline">{t.applications.title}</Link>
        <span>/</span>
        <span className="text-ink-2">{app.referenceNumber}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-2xl">{name}</h1>
            <StageBadge stage={stage} label={t.stage[stage as keyof typeof t.stage]} />
            <PriorityBadge priority={app.priority} label={t.priority[app.priority as keyof typeof t.priority]} />
            <Badge tone="neutral">{t.common.fictionalDataBadge}</Badge>
          </div>
          <p className="mt-1.5 text-sm text-ink-3">
            {app.referenceNumber} · {t.applications.submittedAt} {formatDate(app.submittedAt, lang)} · {daysBetween(app.submittedAt)}{" "}
            {t.dashboard.daysOld}
            {app.resubmissionCount > 0 && ` · resubmitted ×${app.resubmissionCount}`}
          </p>
        </div>
        <DetailActions applicationId={app.id} allowed={allowed} />
      </div>

      {/* Stepper */}
      <Card className="mb-5">
        <CardContent className="overflow-x-auto pb-10 pt-4">
          <StageStepper currentStage={stage} labels={stageLabels} />
        </CardContent>
      </Card>

      <p className="mb-4 rounded-lg border border-navy-100 bg-navy-50/50 px-3.5 py-2 text-[13px] text-navy-700">
        {t.stageHint[stage as keyof typeof t.stageHint]}
      </p>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Left column — facts */}
        <div className="space-y-5 xl:col-span-2">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-1.5 text-[13px]">
                  <User className="h-4 w-4 text-ink-3" />
                  {t.applications.applicantDetails}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-1 text-sm">
                <Row label={t.form.fullName} value={name} />
                {applicant.fatherName && <Row label={t.form.fatherName} value={applicant.fatherName} />}
                <Row label={t.form.phone} value={applicant.phone} icon={<Phone className="h-3 w-3" />} />
                <Row
                  label={t.form.addressLine1}
                  value={`${applicant.addressLine1}${applicant.addressLine2 ? ", " + applicant.addressLine2 : ""}, ${village}, ${applicant.taluk}, ${lang === "kn" && applicant.districtKn ? applicant.districtKn : applicant.district} — ${applicant.pincode}`}
                  icon={<MapPin className="h-3 w-3" />}
                />
                {applicant.aadhaarLast4 && <Row label="Aadhaar" value={`XXXX XXXX ${applicant.aadhaarLast4}`} />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-1.5 text-[13px]">
                  <Landmark className="h-4 w-4 text-ink-3" />
                  {t.applications.applicationDetails}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 pt-1 text-sm">
                <Row label={t.applications.declaredIncome} value={formatINR(app.declaredAnnualIncome)} icon={<IndianRupee className="h-3 w-3" />} strong />
                <Row label={t.applications.incomeSource} value={t.incomeSource[app.incomeSource as keyof typeof t.incomeSource] ?? app.incomeSource} />
                <Row label={t.applications.purpose} value={`${t.purpose[app.purpose as keyof typeof t.purpose] ?? app.purpose}${app.purposeDetails ? ` — ${app.purposeDetails}` : ""}`} />
                <Row label={t.applications.assignedTo} value={app.assignedOfficer ? (lang === "kn" && app.assignedOfficer.nameKn ? app.assignedOfficer.nameKn : app.assignedOfficer.name) : t.applications.unassigned} />
                <Row label={t.dashboard.targetDate} value={`${formatDate(app.internalTargetDate, lang)}${app.internalTargetDate && new Date() > app.internalTargetDate && !isTerminal ? ` (${t.dashboard.overdue})` : ""}`} icon={<CalendarDays className="h-3 w-3" />} />
              </CardContent>
            </Card>
          </div>

          {/* Documents summary */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-1.5 text-[13px]">
                <FileText className="h-4 w-4 text-ink-3" />
                {t.documents.title}
                <span className="ml-1 text-xs font-normal text-ink-3">
                  {verifiedDocs}/{app.documents.length} {t.docStatus.VERIFIED}
                  {missing > 0 && ` · ${missing} ${t.docStatus.MISSING}`}
                </span>
              </CardTitle>
              <Link href={`/applications/${app.id}/documents`} className="text-xs font-medium text-navy-600 hover:underline">
                {t.documents.title} →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-line">
                {checklist.map((row) => (
                  <li key={row.documentType} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-ink">
                        {lang === "kn" ? row.labelKn : row.labelEn}
                        {!row.required && <span className="ml-1.5 text-[11px] font-normal text-ink-3">({t.common.optional})</span>}
                      </p>
                      {row.document && (
                        <p className="truncate text-[11px] text-ink-3">
                          {row.document.originalFilename} · {formatDate(row.document.uploadedAt, lang)}
                        </p>
                      )}
                    </div>
                    {row.document ? (
                      <DocStatusBadge status={row.document.verificationStatus} label={t.docStatus[row.document.verificationStatus as keyof typeof t.docStatus]} />
                    ) : (
                      <DocStatusBadge
                        status="MISSING"
                        label={row.alternativeOf && row.groupSatisfied ? t.docStatus.PENDING : t.docStatus.MISSING}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Field verification */}
          {app.fieldVerification?.submittedAt && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-1.5 text-[13px]">
                  <MapPin className="h-4 w-4 text-ink-3" />
                  {t.recommendation.fieldReport}
                </CardTitle>
                <Badge tone={app.fieldVerification.outcome === "VERIFIED" ? "green" : "amber"}>
                  {app.fieldVerification.outcome
                    ? t.verification.outcomes[app.fieldVerification.outcome as keyof typeof t.verification.outcomes]
                    : "—"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2 pt-1 text-sm">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">
                  {lang === "kn" && app.fieldVerification.observationsKn
                    ? app.fieldVerification.observationsKn
                    : app.fieldVerification.observations}
                </p>
                <p className="text-xs text-ink-3">
                  {lang === "kn" && app.fieldVerification.officer.nameKn
                    ? app.fieldVerification.officer.nameKn
                    : app.fieldVerification.officer.name}{" "}
                  · {formatDateTime(app.fieldVerification.visitedAt, lang)}
                  {app.fieldVerification.aiAssisted && " · AI-assisted"}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Recommendation + decision */}
          {app.recommendations[0] && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-1.5 text-[13px]">
                  <Send className="h-4 w-4 text-ink-3" />
                  {t.recommendation.existingRecommendation}
                </CardTitle>
                <Badge tone="navy">{t.recommendation.option[app.recommendations[0].recommendation as keyof typeof t.recommendation.option]}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 pt-1 text-sm">
                <p className="text-[13px] text-ink-2">{app.recommendations[0].remarks}</p>
                <p className="text-xs text-ink-3">
                  {lang === "kn" && app.recommendations[0].officer.nameKn ? app.recommendations[0].officer.nameKn : app.recommendations[0].officer.name}
                  {" · "}
                  {formatDateTime(app.recommendations[0].createdAt, lang)}
                  {app.recommendations[0].aiAssisted && " · AI-assisted"}
                </p>
              </CardContent>
            </Card>
          )}

          {app.decision && (
            <Card className={app.decision.decision === "APPROVED" ? "border-forest-200" : app.decision.decision === "REJECTED" ? "border-rose/30" : "border-amber/30"}>
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-1.5 text-[13px]">
                  <Scale className="h-4 w-4 text-ink-3" />
                  {t.applications.decisionSummary}
                </CardTitle>
                <StageBadge stage={app.decision.decision} label={t.stage[app.decision.decision as keyof typeof t.stage]} />
              </CardHeader>
              <CardContent className="space-y-2 pt-1 text-sm">
                {app.decision.reason && <Row label={t.decision.selectReason} value={lang === "kn" && app.decision.reasonKn ? app.decision.reasonKn : app.decision.reason} />}
                {app.decision.approvedIncome != null && <Row label={t.decision.approvedIncome} value={formatINR(app.decision.approvedIncome)} strong />}
                {app.decision.remarks && <Row label={t.common.remarks} value={app.decision.remarks} />}
                {app.decision.certificateNumber && (
                  <Row label={t.decision.certificateNumber} value={app.decision.certificateNumber} strong />
                )}
                <p className="text-xs text-ink-3">
                  {t.decision.decidedBy}: {lang === "kn" && app.decision.officer.nameKn ? app.decision.officer.nameKn : app.decision.officer.name} ·{" "}
                  {formatDateTime(app.decision.decidedAt, lang)}
                </p>
                {app.decision.certificateNumber && (
                  <Link
                    href={`/applications/${app.id}/certificate`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-forest-600 hover:underline"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {t.decision.certificatePreview} →
                  </Link>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column — AI + timeline */}
        <div className="space-y-5">
          <AiPanel
            applicationId={app.id}
            taskType="CASE_SUMMARY"
            title={t.recommendation.caseSummary}
            description={t.ai.task.CASE_SUMMARY}
            icon={<Sparkles className="h-4 w-4" />}
          />
          <AiHistory entries={aiHistory} />

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-[13px]">{t.timeline.title}</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[560px] overflow-y-auto pt-1">
              <Timeline
                lang={lang}
                emptyText={t.timeline.empty}
                actionLabels={t.timeline.action}
                items={app.timeline.map((x) => ({
                  id: x.id,
                  action: x.action,
                  actorName: x.actor ? (lang === "kn" && x.actor.nameKn ? x.actor.nameKn : x.actor.name) : null,
                  previousStatus: x.previousStatus,
                  newStatus: x.newStatus,
                  remarks: x.remarks,
                  remarksKn: x.remarksKn,
                  createdAt: x.createdAt,
                }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, icon, strong }: { label: string; value: string; icon?: React.ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="flex shrink-0 items-center gap-1.5 text-xs text-ink-3">{icon}{label}</span>
      <span className={`text-right text-[13px] ${strong ? "font-semibold text-ink" : "text-ink-2"}`}>{value}</span>
    </div>
  );
}
