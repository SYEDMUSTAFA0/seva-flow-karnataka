import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDict, getLanguage } from "@/i18n";
import { getApplicationOrThrow } from "@/lib/services/applications";
import { hasPermission } from "@/lib/permissions";
import { PERMISSIONS, STAGES } from "@/lib/constants";
import { StageBadge } from "@/components/stage-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AiPanel, AiHistory } from "@/components/ai-panel";
import { RecommendationForm } from "./recommendation-form";
import { ArrowLeft, FileText, MapPin, Scale } from "lucide-react";
import { formatDateTime, formatINR } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function RecommendationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const lang = await getLanguage();
  const t = await getDict();

  const app = await getApplicationOrThrow(user, id);
  if (!app) notFound();

  const canRecommend = hasPermission(user, PERMISSIONS.RECOMMEND) && app.currentStage === STAGES.OFFICER_RECOMMENDATION;
  const fv = app.fieldVerification;
  const verifiedDocs = app.documents.filter((d) => d.verificationStatus === "VERIFIED").length;
  const applicant = app.applicant;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-4 flex items-center gap-2 text-xs text-ink-3">
        <Link href="/applications" className="hover:text-ink hover:underline">{t.applications.title}</Link>
        <span>/</span>
        <Link href={`/applications/${app.id}`} className="hover:text-ink hover:underline">{app.referenceNumber}</Link>
        <span>/</span>
        <span className="text-ink-2">{t.recommendation.title}</span>
      </div>

      <div className="mb-5 flex items-center gap-3">
        <Link href={`/applications/${app.id}`} className="rounded-lg border border-line-2 p-2 text-ink-2 hover:bg-canvas-2">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{t.recommendation.title}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-3">
            {lang === "kn" && applicant.fullNameKn ? applicant.fullNameKn : applicant.fullName} · {app.referenceNumber}
            <StageBadge stage={app.currentStage} label={t.stageShort[app.currentStage as keyof typeof t.stageShort]} />
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* File summary */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-1.5 text-[13px]">
                <FileText className="h-4 w-4 text-ink-3" />
                {t.recommendation.docSummary}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-3">{t.applications.declaredIncome}</span>
                <span className="font-semibold text-ink">{formatINR(app.declaredAnnualIncome)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-3">{t.documents.verifiedLegend}</span>
                <span className="font-medium text-ink">{verifiedDocs}/{app.documents.length}</span>
              </div>
              <ul className="mt-2 space-y-1">
                {app.documents.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate text-ink-2">{t.docType[d.documentType as keyof typeof t.docType] ?? d.documentType}</span>
                    <Badge tone={d.verificationStatus === "VERIFIED" ? "green" : d.verificationStatus === "INVALID" ? "rose" : "neutral"}>
                      {t.docStatus[d.verificationStatus as keyof typeof t.docStatus]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {fv?.submittedAt && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-1.5 text-[13px]">
                  <MapPin className="h-4 w-4 text-ink-3" />
                  {t.recommendation.fieldReport}
                </CardTitle>
                <Badge tone={fv.outcome === "VERIFIED" ? "green" : "amber"}>
                  {fv.outcome ? t.verification.outcomes[fv.outcome as keyof typeof t.verification.outcomes] : "—"}
                </Badge>
              </CardHeader>
              <CardContent className="pt-1">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">
                  {lang === "kn" && fv.observationsKn ? fv.observationsKn : fv.observations}
                </p>
                <p className="mt-2 text-xs text-ink-3">
                  {fv.officer.name} · {formatDateTime(fv.visitedAt, lang)}
                  {fv.aiAssisted && " · AI-assisted"}
                </p>
              </CardContent>
            </Card>
          )}

          <AiPanel
            applicationId={app.id}
            taskType="DECISION_SUPPORT"
            title={t.decision.aiSupport}
            description={t.recommendation.evidenceNote}
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

        {/* Recommendation form */}
        <div>
          {canRecommend ? (
            <RecommendationForm applicationId={app.id} aiSuggested={null} />
          ) : app.recommendations[0] ? (
            <Card>
              <CardHeader>
                <CardTitle>{t.recommendation.existingRecommendation}</CardTitle>
                <Badge tone="navy">
                  {t.recommendation.option[app.recommendations[0].recommendation as keyof typeof t.recommendation.option]}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-ink-2">{app.recommendations[0].remarks}</p>
                <p className="text-xs text-ink-3">
                  {app.recommendations[0].officer.name} · {formatDateTime(app.recommendations[0].createdAt, lang)}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-sm text-ink-3">{t.stageHint[app.currentStage as keyof typeof t.stageHint]}</CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
