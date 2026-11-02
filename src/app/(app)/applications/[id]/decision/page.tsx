import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDict, getLanguage } from "@/i18n";
import { getApplicationOrThrow } from "@/lib/services/applications";
import { canDecide } from "@/lib/permissions";

import { StageBadge } from "@/components/stage-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiPanel, AiHistory } from "@/components/ai-panel";
import { DecisionPanel } from "./decision-panel";
import { ArrowLeft, FileText, Lock, Scale } from "lucide-react";
import { formatDateTime, formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function DecisionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const lang = await getLanguage();
  const t = await getDict();

  const app = await getApplicationOrThrow(user, id);
  if (!app) notFound();

  const allowed = canDecide(user, app);
  const applicant = app.applicant;
  const fv = app.fieldVerification;
  const reco = app.recommendations[0];
  const verifiedDocs = app.documents.filter((d) => d.verificationStatus === "VERIFIED").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-4 flex items-center gap-2 text-xs text-ink-3">
        <Link href="/applications" className="hover:text-ink hover:underline">{t.applications.title}</Link>
        <span>/</span>
        <Link href={`/applications/${app.id}`} className="hover:text-ink hover:underline">{app.referenceNumber}</Link>
        <span>/</span>
        <span className="text-ink-2">{t.decision.title}</span>
      </div>

      <div className="mb-5 flex items-center gap-3">
        <Link href={`/applications/${app.id}`} className="rounded-lg border border-line-2 p-2 text-ink-2 hover:bg-canvas-2">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{t.decision.title}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-3">
            {lang === "kn" && applicant.fullNameKn ? applicant.fullNameKn : applicant.fullName} · {app.referenceNumber}
            <StageBadge stage={app.currentStage} label={t.stageShort[app.currentStage as keyof typeof t.stageShort]} />
          </p>
        </div>
      </div>

      {!allowed && !app.decision && (
        <div className="card flex items-center gap-2.5 border-amber/30 bg-amber-bg/50 px-4 py-3 text-sm text-amber">
          <Lock className="h-4 w-4 shrink-0" />
          {t.decision.restrictedTo}
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Complete file */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-1.5 text-[13px]">
                <FileText className="h-4 w-4 text-ink-3" />
                {t.applications.applicationDetails}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-1 text-sm">
              <Line label={t.applications.declaredIncome} value={formatINR(app.declaredAnnualIncome)} />
              <Line label={t.applications.incomeSource} value={t.incomeSource[app.incomeSource as keyof typeof t.incomeSource] ?? app.incomeSource} />
              <Line label={t.applications.purpose} value={t.purpose[app.purpose as keyof typeof t.purpose] ?? app.purpose} />
              <Line label={t.documents.verifiedLegend} value={`${verifiedDocs}/${app.documents.length}`} />
              <Line
                label={t.recommendation.fieldReport}
                value={fv?.outcome ? t.verification.outcomes[fv.outcome as keyof typeof t.verification.outcomes] : "—"}
              />
              {reco && (
                <Line
                  label={t.recommendation.title}
                  value={t.recommendation.option[reco.recommendation as keyof typeof t.recommendation.option]}
                />
              )}
            </CardContent>
          </Card>

          {reco && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-[13px]">{t.recommendation.existingRecommendation}</CardTitle>
                <Badge tone="navy">{t.recommendation.option[reco.recommendation as keyof typeof t.recommendation.option]}</Badge>
              </CardHeader>
              <CardContent className="pt-1">
                <p className="text-[13px] text-ink-2">{reco.remarks}</p>
                <p className="mt-1.5 text-xs text-ink-3">
                  {reco.officer.name} · {formatDateTime(reco.createdAt, lang)}
                </p>
              </CardContent>
            </Card>
          )}

          <AiPanel
            applicationId={app.id}
            taskType="DECISION_SUPPORT"
            title={t.decision.aiSupport}
            description={t.decision.whyThis}
            icon={<Scale className="h-4 w-4" />}
          />
          <AiHistory
            entries={app.aiInteractions.map((i) => ({
              id: i.id,
              taskType: i.taskType,
              model: i.model,
              provider: i.provider,
              confidence: i.confidence,
              createdAt: i.createdAt.toISOString(),
            }))}
          />
        </div>

        {/* Decision panel */}
        <div>
          {allowed && !app.decision ? (
            <DecisionPanel
              applicationId={app.id}
              declaredIncome={app.declaredAnnualIncome}
              applicantName={lang === "kn" && applicant.fullNameKn ? applicant.fullNameKn : applicant.fullName}
            />
          ) : app.decision ? (
            <Card className={app.decision.decision === "APPROVED" ? "border-forest-200" : app.decision.decision === "REJECTED" ? "border-rose/30" : "border-amber/30"}>
              <CardHeader>
                <CardTitle>{t.applications.decisionSummary}</CardTitle>
                <StageBadge stage={app.decision.decision} label={t.stage[app.decision.decision as keyof typeof t.stage]} />
              </CardHeader>
              <CardContent className="space-y-2">
                {app.decision.reason && <Line label={t.decision.selectReason} value={lang === "kn" && app.decision.reasonKn ? app.decision.reasonKn : app.decision.reason} />}
                {app.decision.approvedIncome != null && <Line label={t.decision.approvedIncome} value={formatINR(app.decision.approvedIncome)} />}
                {app.decision.certificateNumber && <Line label={t.decision.certificateNumber} value={app.decision.certificateNumber} />}
                {app.decision.remarks && <Line label={t.common.remarks} value={app.decision.remarks} />}
                <p className="pt-1 text-xs text-ink-3">
                  {t.decision.decidedBy}: {app.decision.officer.name} · {formatDateTime(app.decision.decidedAt, lang)}
                </p>
                {app.decision.certificateNumber && (
                  <Link
                    href={`/applications/${app.id}/certificate`}
                    className="inline-flex items-center gap-1.5 pt-1 text-sm font-medium text-forest-600 hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    {t.decision.certificatePreview} →
                  </Link>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-ink-3">
                {t.stageHint[app.currentStage as keyof typeof t.stageHint]}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-xs text-ink-3">{label}</span>
      <span className="text-right text-[13px] font-medium text-ink-2">{value}</span>
    </div>
  );
}
