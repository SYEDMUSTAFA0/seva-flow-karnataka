"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, FileCheck2, RotateCcw, XCircle } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { submitDecisionAction } from "@/lib/actions/workflow";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DecisionKind = "APPROVED" | "REJECTED" | "RETURNED";

export function DecisionPanel({
  applicationId,
  declaredIncome,
}: {
  applicationId: string;
  declaredIncome: number;
  applicantName: string;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<DecisionKind | null>(null);
  const [reason, setReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [explanationKn, setExplanationKn] = useState("");
  const [approvedIncome, setApprovedIncome] = useState(String(declaredIncome));
  const [checks, setChecks] = useState<boolean[]>([false, false, false]);
  const [done, setDone] = useState<{ certificateNumber?: string | null } | null>(null);

  const reasonOptions = [
    "INCOME_NOT_SUBSTANTIATED",
    "DOCUMENTS_INVALID",
    "INFORMATION_MISMATCH",
    "NOT_RESIDENT",
    "INCOMPLETE_DOCUMENTS",
    "OTHER",
  ] as const;

  const approveReady = kind === "APPROVED" && checks.every(Boolean) && /^\d+$/.test(approvedIncome);
  const rejectReady = (kind === "REJECTED" || kind === "RETURNED") && !!reason && (kind === "REJECTED" || explanationKn.trim().length > 0);
  const ready = approveReady || rejectReady;

  const submit = () =>
    startTransition(async () => {
      const res = await submitDecisionAction(applicationId, {
        decision: kind,
        reason: kind === "APPROVED" ? undefined : reason ? t.decision.reasons[reason as keyof typeof t.decision.reasons] : undefined,
        reasonKn: reason ? t.decision.reasons[reason as keyof typeof t.decision.reasons] : undefined,
        remarks: remarks || undefined,
        applicantExplanationKn: explanationKn || undefined,
        approvedIncome: kind === "APPROVED" ? parseInt(approvedIncome, 10) : undefined,
      });
      if (res.ok) {
        setDone(res.data ?? {});
        toast.success(t.decision.decisionRecorded);
        router.refresh();
      } else toast.error(res.error);
    });

  const cards = [
    { kind: "APPROVED" as const, label: t.decision.approve, icon: CheckCircle2, cls: "border-forest-300 bg-forest-50 text-forest-700", ring: "ring-forest-300" },
    { kind: "REJECTED" as const, label: t.decision.reject, icon: XCircle, cls: "border-rose/30 bg-rose-bg text-rose", ring: "ring-rose/40" },
    { kind: "RETURNED" as const, label: t.decision.returnForInfo, icon: RotateCcw, cls: "border-amber/30 bg-amber-bg text-amber", ring: "ring-amber/40" },
  ];

  if (done) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="card border-forest-200 p-6 text-center">
        <FileCheck2 className="mx-auto h-10 w-10 text-forest-500" />
        <p className="mt-3 text-lg font-semibold text-ink">{t.decision.decisionRecorded}</p>
        {done.certificateNumber && (
          <>
            <p className="mt-1 text-sm text-ink-3">
              {t.decision.certificateNumber}: <span className="font-mono font-semibold text-ink">{done.certificateNumber}</span>
            </p>
            <Button variant="success" className="mt-4" onClick={() => router.push(`/applications/${applicationId}/certificate`)}>
              {t.decision.certificatePreview}
            </Button>
          </>
        )}
        <div className="mt-3">
          <Button variant="secondary" onClick={() => router.push(`/applications/${applicationId}`)}>
            {t.applications.title}
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="card p-5">
      <p className="mb-1 text-sm font-semibold text-ink">{t.decision.title}</p>
      <p className="mb-4 text-xs text-ink-3">{t.decision.restrictedTo}</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          const active = kind === c.kind;
          return (
            <button
              key={c.kind}
              onClick={() => setKind(c.kind)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-4 text-center text-[13px] font-medium transition-all",
                active ? c.cls + " ring-2 " + c.ring : "border-line-2 text-ink-3 hover:border-line"
              )}
            >
              <Icon className="h-6 w-6" />
              {c.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {kind === "APPROVED" && (
          <motion.div key="approve" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-5 space-y-3">
              <p className="text-xs font-semibold text-ink-3">{t.decision.approveChecklist}</p>
              {[t.decision.approvePoint1, t.decision.approvePoint2, t.decision.approvePoint3].map((pt, i) => (
                <label key={i} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-[13px] text-ink-2">
                  <input
                    type="checkbox"
                    checked={checks[i]}
                    onChange={(e) => setChecks((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
                    className="mt-0.5 h-4 w-4 rounded border-line-2 accent-forest-600"
                  />
                  {pt}
                </label>
              ))}
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-3">{t.decision.approvedIncome}</label>
                <input
                  type="number"
                  min={0}
                  className="input-base"
                  value={approvedIncome}
                  onChange={(e) => setApprovedIncome(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-ink-3">{t.decision.approvedIncomeHint}</p>
              </div>
            </div>
          </motion.div>
        )}

        {(kind === "REJECTED" || kind === "RETURNED") && (
          <motion.div key="reject" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-5 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-3">{t.decision.selectReason} <span className="text-rose">*</span></label>
                <select className="input-base" value={reason} onChange={(e) => setReason(e.target.value)}>
                  <option value="">—</option>
                  {reasonOptions.map((r) => (
                    <option key={r} value={r}>{t.decision.reasons[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-3">{t.common.remarks}</label>
                <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} className="input-base text-sm" />
              </div>
              {kind === "RETURNED" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-ink-3">
                    {t.decision.applicantExplanationKn} <span className="text-rose">*</span>
                  </label>
                  <textarea
                    value={explanationKn}
                    onChange={(e) => setExplanationKn(e.target.value)}
                    rows={3}
                    className="input-base lang-kn text-sm"
                    placeholder="ಅರ್ಜಿದಾರರಿಗೆ ಕನ್ನಡದಲ್ಲಿ ವಿವರಿಸಿ…"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        variant={kind === "REJECTED" ? "danger" : kind === "APPROVED" ? "success" : "primary"}
        size="lg"
        className="mt-5 w-full"
        disabled={!ready}
        loading={pending}
        onClick={submit}
      >
        {kind ? cards.find((c) => c.kind === kind)?.label : t.decision.title}
      </Button>
    </div>
  );
}
