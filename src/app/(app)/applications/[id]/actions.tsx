"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { ArrowRight, FileSearch, MapPin, RefreshCcw, Scale, Send } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { advanceStageAction, recordResubmissionAction } from "@/lib/actions/applications";
import { Button } from "@/components/ui/button";
import { STAGES } from "@/lib/constants";

/**
 * Contextual action buttons rendered on the detail page.
 * Which actions appear is decided server-side via `allowed` — this component
 * only wires them up.
 */
export function DetailActions({
  applicationId,
  allowed,
}: {
  applicationId: string;
  allowed: {
    beginScrutiny: boolean;
    documents: boolean;
    field: boolean;
    recommendation: boolean;
    decision: boolean;
    resubmit: boolean;
  };
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const beginScrutiny = () =>
    startTransition(async () => {
      const res = await advanceStageAction(applicationId, STAGES.DOCUMENT_SCRUTINY);
      if (res.ok) {
        toast.success(t.stage.DOCUMENT_SCRUTINY);
        router.push(`/applications/${applicationId}/documents`);
      } else toast.error(res.error);
    });

  const resubmit = () =>
    startTransition(async () => {
      const res = await recordResubmissionAction(applicationId);
      if (res.ok) {
        toast.success(t.applications.resubmit);
        router.push(`/applications/${applicationId}/documents`);
      } else toast.error(res.error);
    });

  if (!Object.values(allowed).some(Boolean)) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {allowed.beginScrutiny && (
        <Button variant="primary" onClick={beginScrutiny} loading={pending}>
          <FileSearch className="h-4 w-4" />
          {t.stage.DOCUMENT_SCRUTINY}
        </Button>
      )}
      {allowed.documents && (
        <Link href={`/applications/${applicationId}/documents`}>
          <Button variant="primary">
            <FileSearch className="h-4 w-4" />
            {t.documents.title}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
      {allowed.field && (
        <Link href={`/applications/${applicationId}/verification`}>
          <Button variant="primary">
            <MapPin className="h-4 w-4" />
            {t.verification.title}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
      {allowed.recommendation && (
        <Link href={`/applications/${applicationId}/recommendation`}>
          <Button variant="primary">
            <Send className="h-4 w-4" />
            {t.recommendation.title}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
      {allowed.decision && (
        <Link href={`/applications/${applicationId}/decision`}>
          <Button variant="primary">
            <Scale className="h-4 w-4" />
            {t.decision.title}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      )}
      {allowed.resubmit && (
        <Button variant="accent" onClick={resubmit} loading={pending}>
          <RefreshCcw className="h-4 w-4" />
          {t.applications.resubmit}
        </Button>
      )}
    </div>
  );
}
