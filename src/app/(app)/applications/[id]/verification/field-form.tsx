"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  Camera,
  CheckCircle2,
  ClipboardList,
  FileText,
  MapPin,
  MinusCircle,
  Phone,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useI18n } from "@/i18n/client";
import { submitFieldVerificationAction } from "@/lib/actions/workflow";
import { uploadDocumentAction } from "@/lib/actions/applications";
import { AiPanel } from "@/components/ai-panel";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ChecklistItem {
  key: string;
  label: string;
  answer: boolean | null;
}

const DEFAULT_CHECKLIST = (t: ReturnType<typeof useI18n>["t"]): ChecklistItem[] => [
  { key: "applicantPresent", label: t.verification.applicantPresent, answer: null },
  { key: "residenceConfirmed", label: t.verification.residenceConfirmed, answer: null },
  { key: "incomeConsistent", label: t.verification.incomeConsistent, answer: null },
  { key: "neighbourConfirmed", label: t.verification.neighbourConfirmed, answer: null },
];

export function FieldVerificationForm({
  applicationId,
  editable,
  submitted,
  applicant,
  initial,
}: {
  applicationId: string;
  editable: boolean;
  submitted: boolean;
  applicant: { name: string; address: string; phone: string };
  initial: {
    visitedAt: string;
    checklist: ChecklistItem[];
    rawNotes: string;
    observations: string;
    outcome: string;
    aiAssisted: boolean;
    supportingImages: string[];
    locationLat: number | null;
    locationLng: number | null;
  } | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [visitedAt, setVisitedAt] = useState(initial?.visitedAt ?? new Date().toISOString().slice(0, 10));
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    initial?.checklist?.length ? initial.checklist : DEFAULT_CHECKLIST(t)
  );
  const [rawNotes, setRawNotes] = useState(initial?.rawNotes ?? "");
  const [observations, setObservations] = useState(initial?.observations ?? "");
  const [outcome, setOutcome] = useState(initial?.outcome ?? "");
  const [aiAssisted, setAiAssisted] = useState(initial?.aiAssisted ?? false);
  const [interaction, setInteraction] = useState("");
  const [images, setImages] = useState<string[]>(initial?.supportingImages ?? []);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(
    initial?.locationLat != null && initial?.locationLng != null
      ? { lat: initial.locationLat, lng: initial.locationLng }
      : null
  );
  const [confirmOpen, setConfirmOpen] = useState(false);

  const unanswered = checklist.filter((c) => c.answer == null).length;

  const setAnswer = (key: string, answer: boolean) =>
    setChecklist((c) => c.map((x) => (x.key === key ? { ...x, answer: x.answer === answer ? null : answer } : x)));

  const captureGps = () => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setLoc({ lat: +p.coords.latitude.toFixed(5), lng: +p.coords.longitude.toFixed(5) }),
      () => toast.error("GPS unavailable"),
      { timeout: 8000 }
    );
  };

  const uploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("applicationId", applicationId);
    fd.set("documentType", "FIELD_PHOTO");
    fd.set("file", file);
    startTransition(async () => {
      const res = await uploadDocumentAction(fd);
      if (res.ok) {
        const doc = await res.data;
        // track storage key via returned id → fetch from server list; simpler: keep id marker
        setImages((s) => [...s, `doc:${doc!.id}`]);
        toast.success(t.documents.uploadSuccess);
      } else toast.error(res.error);
      e.target.value = "";
    });
  };

  const submit = () =>
    startTransition(async () => {
      const res = await submitFieldVerificationAction(applicationId, {
        visitedAt,
        checklist,
        rawNotes,
        observations,
        outcome,
        aiAssisted,
        applicantInteraction: interaction || undefined,
        locationLat: loc?.lat,
        locationLng: loc?.lng,
      });
      if (res.ok) {
        toast.success(t.verification.submittedBanner);
        router.push(`/applications/${applicationId}`);
      } else toast.error(res.error);
    });

  const outcomeOptions = [
    { value: "VERIFIED", label: t.verification.outcomes.VERIFIED, icon: CheckCircle2, cls: "border-forest-300 bg-forest-50 text-forest-700" },
    { value: "FURTHER_VERIFICATION", label: t.verification.outcomes.FURTHER_VERIFICATION, icon: ClipboardList, cls: "border-amber/30 bg-amber-bg text-amber" },
    { value: "UNABLE_TO_VERIFY", label: t.verification.outcomes.UNABLE_TO_VERIFY, icon: XCircle, cls: "border-rose/25 bg-rose-bg text-rose" },
    { value: "RETURN_FOR_CLARIFICATION", label: t.verification.outcomes.RETURN_FOR_CLARIFICATION, icon: MinusCircle, cls: "border-navy-300 bg-navy-50 text-navy-700" },
  ];

  return (
    <div className="space-y-4 pb-24 sm:pb-6">
      {/* Address card */}
      <div className="card p-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">
          <MapPin className="h-3.5 w-3.5" />
          {t.verification.addressLabel}
        </p>
        <p className="text-sm font-medium text-ink">{applicant.name}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{applicant.address}</p>
        <div className="mt-2 flex items-center gap-3">
          <a href={`tel:${applicant.phone}`} className="flex items-center gap-1 text-xs font-medium text-navy-600 hover:underline">
            <Phone className="h-3 w-3" />
            {applicant.phone}
          </a>
        </div>
      </div>

      {/* Visit details */}
      <div className="card p-4">
        <p className="mb-3 text-sm font-semibold text-ink">{t.verification.visitDetails}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-3">{t.verification.visitDate}</label>
            <input type="date" className="input-base" value={visitedAt} onChange={(e) => setVisitedAt(e.target.value)} disabled={!editable} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-3">{t.verification.location}</label>
            <button
              type="button"
              onClick={captureGps}
              disabled={!editable}
              className={cn(
                "btn-base w-full border px-3 py-2 text-sm",
                loc ? "border-forest-300 bg-forest-50 text-forest-700" : "border-line-2 text-ink-2 hover:bg-canvas-2"
              )}
            >
              <MapPin className="h-4 w-4" />
              {loc ? `${loc.lat}, ${loc.lng}` : t.verification.captureLocation}
            </button>
          </div>
        </div>
      </div>

      {/* Checklist — big touch targets */}
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">{t.verification.checklistTitle}</p>
          {unanswered > 0 && <span className="text-xs text-amber">{unanswered} {t.verification.unansweredChecklist}</span>}
        </div>
        <ul className="space-y-2.5">
          {checklist.map((item) => (
            <li key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3.5 py-3">
              <span className="text-sm text-ink-2">{item.label}</span>
              <div className="flex shrink-0 gap-1.5">
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => setAnswer(item.key, true)}
                  className={cn(
                    "btn-base h-9 rounded-lg border px-3.5 text-xs font-semibold",
                    item.answer === true
                      ? "border-forest-500 bg-forest-500 text-white"
                      : "border-line-2 text-ink-3 hover:border-forest-300"
                  )}
                >
                  {t.common.yes}
                </button>
                <button
                  type="button"
                  disabled={!editable}
                  onClick={() => setAnswer(item.key, false)}
                  className={cn(
                    "btn-base h-9 rounded-lg border px-3.5 text-xs font-semibold",
                    item.answer === false
                      ? "border-rose bg-rose text-white"
                      : "border-line-2 text-ink-3 hover:border-rose/40"
                  )}
                >
                  {t.common.no}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Notes */}
      <div className="card p-4">
        <label className="mb-1.5 block text-sm font-semibold text-ink">{t.verification.officerNotes}</label>
        <textarea
          value={rawNotes}
          onChange={(e) => setRawNotes(e.target.value)}
          placeholder={t.verification.notesPlaceholder}
          rows={4}
          disabled={!editable}
          className="input-base text-sm"
        />
        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-medium text-ink-3">{t.verification.applicantInteraction}</label>
          <textarea
            value={interaction}
            onChange={(e) => setInteraction(e.target.value)}
            rows={2}
            disabled={!editable}
            className="input-base text-sm"
          />
        </div>
      </div>

      {/* AI field report */}
      {editable && (
        <AiPanel
          applicationId={applicationId}
          taskType="FIELD_REPORT"
          title={t.verification.generateReport}
          icon={<Sparkles className="h-4 w-4" />}
          extraInput={() => ({ rawNotes, checklist, visitedAt })}
          onResult={(r) => {
            if (r.draftText) {
              setObservations(r.draftText);
              setAiAssisted(true);
            }
          }}
        />
      )}

      {/* Report — editable */}
      <div className="card p-4">
        <div className="mb-1.5 flex items-center justify-between">
          <label className="flex items-center gap-1.5 text-sm font-semibold text-ink">
            <FileText className="h-4 w-4 text-ink-3" />
            {t.verification.reportTitle}
          </label>
          {aiAssisted && <span className="chip border-navy-200 bg-navy-50 text-[10px] text-navy-600">AI-assisted</span>}
        </div>
        {editable && <p className="mb-2 text-xs text-ink-3">{t.verification.reportEditable}</p>}
        <textarea
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          rows={7}
          disabled={!editable}
          className="input-base font-mono text-xs leading-relaxed"
        />
      </div>

      {/* Photos */}
      <div className="card p-4">
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Camera className="h-4 w-4 text-ink-3" />
          {t.verification.supportingPhotos}
        </p>
        <div className="flex flex-wrap gap-2">
          {images.map((k) => (
            <div key={k} className="flex h-16 w-16 items-center justify-center rounded-lg border border-line bg-canvas-2">
              <Camera className="h-5 w-5 text-ink-3" />
            </div>
          ))}
          {editable && (
            <label className="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line-2 text-ink-3 hover:border-navy-300 hover:text-navy-600">
              <Camera className="h-5 w-5" />
              <span className="text-[9px]">{t.verification.addPhotos}</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={uploadPhoto} />
            </label>
          )}
        </div>
      </div>

      {/* Outcome */}
      <div className="card p-4">
        <p className="mb-3 text-sm font-semibold text-ink">{t.verification.outcome}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {outcomeOptions.map((o) => {
            const Icon = o.icon;
            const active = outcome === o.value;
            return (
              <button
                key={o.value}
                type="button"
                disabled={!editable}
                onClick={() => setOutcome(o.value)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3.5 py-3 text-left text-sm font-medium transition-all",
                  active ? o.cls + " ring-1 ring-current" : "border-line-2 text-ink-3 hover:border-line"
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" />
                {o.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sticky mobile submit bar */}
      {editable && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/95 p-3 backdrop-blur sm:static sm:rounded-xl sm:border sm:p-4 lg:bottom-auto lg:relative lg:z-auto">
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            disabled={!outcome || observations.trim().length < 10}
            loading={pending}
            onClick={() => setConfirmOpen(true)}
          >
            <Send className="h-4 w-4" />
            {t.verification.submitReport}
          </Button>
          {(!outcome || observations.trim().length < 10) && (
            <p className="mt-1.5 text-center text-[11px] text-ink-3">
              {t.verification.outcome} + {t.verification.reportTitle} — {t.common.required}
            </p>
          )}
        </div>
      )}

      {submitted && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-forest-200 bg-forest-50 px-4 py-3 text-sm text-forest-700">
          {t.verification.alreadySubmitted}
        </motion.p>
      )}

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t.verification.submitReport}>
        <p className="mb-4 text-sm text-ink-2">{t.common.confirmAction}?</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>{t.common.cancel}</Button>
          <Button variant="primary" loading={pending} onClick={() => { setConfirmOpen(false); submit(); }}>
            {t.common.confirm}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
