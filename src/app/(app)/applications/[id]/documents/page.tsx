import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getDict } from "@/i18n";
import { buildChecklist, getApplicationOrThrow, missingRequirementCount } from "@/lib/services/applications";
import { allowedTransitions, hasPermission } from "@/lib/permissions";
import { PERMISSIONS, STAGES, type Stage } from "@/lib/constants";
import { StageBadge } from "@/components/stage-badge";

import { AiPanel, AiHistory } from "@/components/ai-panel";
import { DocumentsClient } from "./documents-client";
import { ArrowLeft, GitCompareArrows, ScanSearch, FileQuestion, CheckCircle2, AlertCircle } from "lucide-react";

export default async function DocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const t = await getDict();

  const app = await getApplicationOrThrow(user, id);
  if (!app) notFound();

  const requirements = await prisma.documentRequirement.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
  });
  const checklist = buildChecklist(requirements, app.documents);
  const missing = missingRequirementCount(checklist);
  const stage = app.currentStage as Stage;
  const transitions = allowedTransitions(user, stage);
  const canVerify = hasPermission(user, PERMISSIONS.DOC_VERIFY);
  const canUpload = hasPermission(user, PERMISSIONS.DOC_UPLOAD);
  const canAdvance = transitions.includes(STAGES.FIELD_VERIFICATION);
  const canReturn = transitions.includes(STAGES.RETURNED);
  const allRequiredVerified =
    missing === 0 &&
    checklist.every((r) => !r.required || r.alternativeOf || r.document?.verificationStatus === "VERIFIED");

  const extraDocs = app.documents.filter(
    (d) => !requirements.some((r) => r.documentType === d.documentType)
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-4 flex items-center gap-2 text-xs text-ink-3">
        <Link href="/applications" className="hover:text-ink hover:underline">{t.applications.title}</Link>
        <span>/</span>
        <Link href={`/applications/${app.id}`} className="hover:text-ink hover:underline">{app.referenceNumber}</Link>
        <span>/</span>
        <span className="text-ink-2">{t.documents.title}</span>
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/applications/${app.id}`} className="rounded-lg border border-line-2 p-2 text-ink-2 hover:bg-canvas-2">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-ink">{t.documents.title}</h1>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-ink-3">
              {app.applicant.fullName} · {app.referenceNumber}
              <StageBadge stage={stage} label={t.stageShort[stage as keyof typeof t.stageShort]} />
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {allRequiredVerified && app.documents.length > 0 && (
            <span className="chip border-forest-200 bg-forest-50 text-forest-700">
              <CheckCircle2 className="h-3 w-3" />
              {t.documents.allDocsVerified}
            </span>
          )}
          {missing > 0 && (
            <span className="chip border-amber/25 bg-amber-bg text-amber">
              <AlertCircle className="h-3 w-3" />
              {missing} {t.documents.docsPendingCount}
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface px-4 py-2.5 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-forest-500" />{t.documents.verifiedLegend}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-navy-400" />{t.documents.aiLegend}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber" />{t.documents.manualLegend}</span>
      </div>

      <DocumentsClient
        applicationId={app.id}
        stage={stage}
        canVerify={canVerify}
        canUpload={canUpload}
        canAdvance={canAdvance}
        canReturn={canReturn}
        checklist={checklist.map((row) => ({
          ...row,
          document: row.document
            ? { ...row.document, uploadedAt: row.document.uploadedAt.toISOString() }
            : null,
        }))}
        extraDocs={extraDocs.map((d) => ({
          id: d.id,
          documentType: d.documentType,
          originalFilename: d.originalFilename,
          mimeType: d.mimeType,
          uploadedAt: d.uploadedAt.toISOString(),
          verificationStatus: d.verificationStatus,
          storageKey: d.storageKey,
          extractedData: d.extractedData,
        }))}
        docTypeOptions={Object.keys(t.docType).map((k) => ({
          value: k,
          label: t.docType[k as keyof typeof t.docType],
        }))}
      />

      {/* AI assistants */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <AiPanel
          applicationId={app.id}
          taskType="DOCUMENT_EXTRACTION"
          title={t.documents.docReviewTitle}
          description={t.ai.task.DOCUMENT_EXTRACTION}
          icon={<ScanSearch className="h-4 w-4" />}
        />
        <AiPanel
          applicationId={app.id}
          taskType="DOCUMENT_COMPARISON"
          title={t.documents.comparisonTitle}
          description={t.documents.compareAcross}
          icon={<GitCompareArrows className="h-4 w-4" />}
        />
        <AiPanel
          applicationId={app.id}
          taskType="MISSING_INFO"
          title={t.ai.task.MISSING_INFO}
          icon={<FileQuestion className="h-4 w-4" />}
        />
      </div>
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
  );
}
