import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getDict, getLanguage } from "@/i18n";
import { getApplicationOrThrow } from "@/lib/services/applications";
import { canFieldVerify } from "@/lib/permissions";

import { StageBadge } from "@/components/stage-badge";
import { ArrowLeft } from "lucide-react";
import { FieldVerificationForm } from "./field-form";
import { safeJson } from "@/lib/utils";

export default async function VerificationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const lang = await getLanguage();
  const t = await getDict();

  const app = await getApplicationOrThrow(user, id);
  if (!app) notFound();

  const fv = app.fieldVerification;
  const editable = canFieldVerify(user, app) && !fv?.submittedAt;
  const mayView =
    editable ||
    user.roleId !== "FIELD_OFFICER" ||
    app.assignedOfficerId === user.id;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
      <div className="mb-4 flex items-center gap-2 text-xs text-ink-3">
        <Link href="/applications" className="hover:text-ink hover:underline">{t.applications.title}</Link>
        <span>/</span>
        <Link href={`/applications/${app.id}`} className="hover:text-ink hover:underline">{app.referenceNumber}</Link>
        <span>/</span>
        <span className="text-ink-2">{t.verification.title}</span>
      </div>

      <div className="mb-5 flex items-center gap-3">
        <Link href={`/applications/${app.id}`} className="rounded-lg border border-line-2 p-2 text-ink-2 hover:bg-canvas-2">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{t.verification.title}</h1>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-3">
            {app.applicant.fullName} · {app.referenceNumber}
            <StageBadge stage={app.currentStage} label={t.stageShort[app.currentStage as keyof typeof t.stageShort]} />
          </p>
        </div>
      </div>

      {!mayView && (
        <div className="card border-amber/30 bg-amber-bg/50 px-4 py-3 text-sm text-amber">
          {t.verification.notAssigned}
        </div>
      )}

      {mayView && (
        <FieldVerificationForm
          applicationId={app.id}
          editable={editable}
          submitted={!!fv?.submittedAt}
          applicant={{
            name: lang === "kn" && app.applicant.fullNameKn ? app.applicant.fullNameKn : app.applicant.fullName,
            address: `${app.applicant.addressLine1}${app.applicant.addressLine2 ? ", " + app.applicant.addressLine2 : ""}, ${lang === "kn" && app.applicant.villageKn ? app.applicant.villageKn : app.applicant.village}, ${app.applicant.taluk}, ${app.applicant.district} — ${app.applicant.pincode}`,
            phone: app.applicant.phone,
          }}
          initial={
            fv
              ? {
                  visitedAt: fv.visitedAt ? fv.visitedAt.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
                  checklist: safeJson<{ key: string; label: string; answer: boolean | null }[]>(fv.checklistJson, []),
                  rawNotes: fv.rawNotes ?? "",
                  observations: fv.observations ?? "",
                  outcome: fv.outcome ?? "",
                  aiAssisted: fv.aiAssisted,
                  supportingImages: safeJson<string[]>(fv.supportingImages, []),
                  locationLat: fv.locationLat,
                  locationLng: fv.locationLng,
                }
              : null
          }
        />
      )}
    </div>
  );
}
