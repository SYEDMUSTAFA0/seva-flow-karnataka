"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, Send, XCircle } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { submitRecommendationAction } from "@/lib/actions/workflow";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function RecommendationForm({ applicationId }: { applicationId: string; aiSuggested?: string | null }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string>("");
  const [remarks, setRemarks] = useState("");
  const [aiAssisted, setAiAssisted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const options = [
    { value: "RECOMMEND_APPROVAL", label: t.recommendation.option.RECOMMEND_APPROVAL, icon: CheckCircle2, cls: "border-forest-300 bg-forest-50 text-forest-700" },
    { value: "RECOMMEND_REJECTION", label: t.recommendation.option.RECOMMEND_REJECTION, icon: XCircle, cls: "border-rose/25 bg-rose-bg text-rose" },
    { value: "RETURN_FOR_VERIFICATION", label: t.recommendation.option.RETURN_FOR_VERIFICATION, icon: RotateCcw, cls: "border-amber/30 bg-amber-bg text-amber" },
  ];

  const submit = () =>
    startTransition(async () => {
      const res = await submitRecommendationAction(applicationId, {
        recommendation: selected,
        remarks,
        aiAssisted,
      });
      if (res.ok) {
        toast.success(t.recommendation.submittedBanner);
        router.push(`/applications/${applicationId}`);
      } else toast.error(res.error);
    });

  return (
    <div className="card p-5">
      <p className="mb-1 text-sm font-semibold text-ink">{t.recommendation.draftRecommendation}</p>
      <p className="mb-4 text-xs text-ink-3">{t.recommendation.evidenceNote}</p>

      <div className="space-y-2">
        {options.map((o) => {
          const Icon = o.icon;
          const active = selected === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setSelected(o.value)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-all",
                active ? o.cls + " ring-1 ring-current" : "border-line-2 text-ink-3 hover:border-line"
              )}
            >
              <Icon className="h-4.5 w-4.5 shrink-0" />
              {o.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <label className="mb-1.5 block text-xs font-medium text-ink-3">
          {t.common.remarks} <span className="text-rose">*</span>
        </label>
        <textarea
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          rows={4}
          className="input-base text-sm"
          placeholder={t.common.remarksPlaceholder}
        />
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-ink-3">
        <input
          type="checkbox"
          checked={aiAssisted}
          onChange={(e) => setAiAssisted(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-line-2 accent-navy-700"
        />
        {t.ai.assistant} — {t.recommendation.caseSummary}
      </label>

      <Button
        variant="primary"
        size="lg"
        className="mt-5 w-full"
        disabled={!selected || remarks.trim().length < 5}
        loading={pending}
        onClick={() => setConfirmOpen(true)}
      >
        <Send className="h-4 w-4" />
        {t.recommendation.submitRecommendation}
      </Button>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title={t.recommendation.submitRecommendation}>
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
