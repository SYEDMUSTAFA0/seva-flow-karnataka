"use client";

import { useState, useTransition } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  History,
  Lightbulb,
  ListChecks,
  RefreshCw,
  Sparkles,
} from "lucide-react";

import { useI18n } from "@/i18n/client";
import { runAiAction, markAiOverrideAction } from "@/lib/actions/workflow";
import type { AiResult, AiTaskType } from "@/lib/ai/schemas";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AiHistoryEntry {
  id: string;
  taskType: string;
  model: string;
  provider: string;
  confidence: number | null;
  createdAt: string;
}

export function AiPanel({
  applicationId,
  taskType,
  title,
  description,
  icon,
  extraInput,
  onResult,
  className,
}: {
  applicationId: string;
  taskType: AiTaskType;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  /** Extra input sent to the task (e.g. officer notes for FIELD_REPORT). */
  extraInput?: () => Record<string, unknown>;
  /** Called with the parsed result — lets the parent consume draftText etc. */
  onResult?: (result: AiResult, meta: { interactionId: string }) => void;
  className?: string;
}) {
  const { t } = useI18n();
  const [result, setResult] = useState<AiResult | null>(null);
  const [meta, setMeta] = useState<{ interactionId: string; provider: string; model: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [draftEdited, setDraftEdited] = useState(false);
  const [pending, startTransition] = useTransition();

  const run = () => {
    setError(null);
    startTransition(async () => {
      const res = await runAiAction(applicationId, taskType, extraInput?.());
      if (!res.ok) {
        setError(res.error ?? t.ai.errorBody);
        return;
      }
      const r = res.data!.result as AiResult;
      setResult(r);
      setMeta({ interactionId: res.data!.interactionId, provider: res.data!.provider, model: res.data!.model });
      setDraft(r.draftText ?? "");
      setDraftEdited(false);
      onResult?.(r, { interactionId: res.data!.interactionId });
    });
  };

  const markEdited = (v: string) => {
    setDraft(v);
    if (!draftEdited && meta) {
      setDraftEdited(true);
      markAiOverrideAction(meta.interactionId);
    }
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border border-navy-200/70 bg-gradient-to-b from-navy-50/60 to-surface", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-navy-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy-800 text-white">
            {icon ?? <Bot className="h-4 w-4" />}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">{title}</p>
            {description && <p className="text-[11px] text-ink-3">{description}</p>}
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={run} loading={pending}>
          {pending ? t.ai.analyzing : result ? t.ai.regenerate : t.ai.generate}
          {!pending && <Sparkles className="h-3.5 w-3.5" />}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {pending && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-2.5 px-4 py-4"
          >
            {[92, 76, 64].map((w, i) => (
              <motion.div
                key={i}
                className="h-3.5 rounded bg-navy-100"
                style={{ width: `${w}%` }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.15 }}
              />
            ))}
          </motion.div>
        )}

        {error && !pending && (
          <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="px-4 py-4">
            <div className="flex items-start gap-2.5 rounded-lg border border-rose/20 bg-rose-bg px-3 py-2.5">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose" />
              <div className="flex-1">
                <p className="text-sm font-medium text-rose">{t.ai.errorTitle}</p>
                <p className="text-xs text-rose/80">{error}</p>
              </div>
              <button onClick={run} className="flex items-center gap-1 text-xs font-medium text-rose hover:underline">
                <RefreshCw className="h-3 w-3" /> {t.common.retry}
              </button>
            </div>
          </motion.div>
        )}

        {result && !pending && (
          <motion.div key="result" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 px-4 py-4">
            {meta?.provider === "demo" && (
              <p className="flex items-start gap-1.5 rounded-md bg-amber-bg px-2.5 py-1.5 text-[11px] leading-snug text-amber">
                <FlaskConical className="mt-0.5 h-3 w-3 shrink-0" />
                {t.ai.demoMode}
              </p>
            )}

            {/* Summary */}
            <p className="text-sm leading-relaxed text-ink">{result.summary}</p>

            {/* Findings */}
            {result.findings.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">{t.ai.findings}</p>
                <ul className="space-y-1">
                  {result.findings.map((f, i) => (
                    <li
                      key={i}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-[13px]",
                        f.severity === "critical"
                          ? "border-rose/20 bg-rose-bg/60"
                          : f.severity === "warning"
                            ? "border-amber/20 bg-amber-bg/60"
                            : "border-line bg-surface-2"
                      )}
                    >
                      {f.severity === "info" ? (
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-forest-500" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber" />
                      )}
                      <div className="min-w-0">
                        <span className="font-medium text-ink">{f.label}</span>
                        {f.value && <span className="text-ink-3"> — {f.value}</span>}
                        {f.evidence && <p className="text-[11px] text-ink-3">{t.ai.evidence}: {f.evidence}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Inconsistencies */}
            {result.inconsistencies.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-rose">{t.ai.inconsistencies}</p>
                <ul className="space-y-1.5">
                  {result.inconsistencies.map((inc, i) => (
                    <li key={i} className="rounded-lg border border-rose/25 bg-rose-bg px-3 py-2 text-[13px]">
                      <p className="font-medium text-rose">{inc.field}</p>
                      <p className="mt-0.5 text-ink-2">
                        {inc.sourceA}: <span className="font-medium">{inc.valueA}</span>
                        {" ↔ "}
                        {inc.sourceB}: <span className="font-medium">{inc.valueB}</span>
                      </p>
                      {inc.note && <p className="mt-0.5 text-xs text-ink-3">{inc.note}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Missing info */}
            {result.missingInfo.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-amber">{t.ai.missingInfo}</p>
                <ul className="list-inside list-disc space-y-0.5 text-[13px] text-ink-2">
                  {result.missingInfo.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Extracted fields */}
            {result.extractedFields && Object.keys(result.extractedFields).length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-3">{t.ai.extractedFields}</p>
                <div className="overflow-hidden rounded-lg border border-line">
                  <table className="w-full text-xs">
                    <tbody className="divide-y divide-line">
                      {Object.entries(result.extractedFields).map(([k, v]) => (
                        <tr key={k}>
                          <td className="bg-canvas-2/60 px-2.5 py-1.5 font-medium text-ink-2">{k}</td>
                          <td className="px-2.5 py-1.5 text-ink">{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Editable draft */}
            {result.draftText != null && result.draftText !== "" && (
              <div>
                <p className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-ink-3">
                  {t.ai.usedAsBasis}
                  {draftEdited && <span className="normal-case text-saffron-600">{t.ai.edited}</span>}
                </p>
                <textarea
                  value={draft}
                  onChange={(e) => markEdited(e.target.value)}
                  rows={8}
                  className="input-base font-mono text-xs leading-relaxed"
                />
              </div>
            )}

            {/* Suggested action + questions */}
            {result.suggestedNextAction && (
              <div className="flex items-start gap-2 rounded-lg bg-navy-50 px-3 py-2">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-navy-600" />
                <div>
                  <p className="text-xs font-semibold text-navy-700">{t.ai.suggestedNextAction}</p>
                  <p className="text-[13px] text-ink-2">{result.suggestedNextAction}</p>
                </div>
              </div>
            )}
            {result.questions.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-3">{t.ai.questionsToAsk}</p>
                <ul className="list-inside list-disc space-y-0.5 text-[13px] text-ink-2">
                  {result.questions.map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Footer: confidence + human verification + disclaimer */}
            <div className="space-y-2 border-t border-line pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-3">{t.ai.confidence}</span>
                <div className="h-1.5 w-28 overflow-hidden rounded-full bg-canvas-2">
                  <div className="h-full rounded-full bg-navy-500" style={{ width: `${Math.round(result.confidence * 100)}%` }} />
                </div>
                <span className="text-xs font-medium text-ink-2">{Math.round(result.confidence * 100)}%</span>
              </div>
              {result.requiresHumanVerification.length > 0 && (
                <p className="flex items-start gap-1.5 text-[11px] text-ink-3">
                  <ListChecks className="mt-0.5 h-3.5 w-3.5 shrink-0 text-saffron-500" />
                  <span>
                    <span className="font-medium text-ink-2">{t.ai.humanCheck}:</span>{" "}
                    {result.requiresHumanVerification.join(" · ")}
                  </span>
                </p>
              )}
              <p className="text-[11px] italic text-ink-3">{t.ai.disclaimer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Compact "AI history" chip list shown under panels. */
export function AiHistory({ entries }: { entries: AiHistoryEntry[] }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;
  return (
    <div className="mt-2">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
        <History className="h-3.5 w-3.5" />
        {t.ai.history} ({entries.length})
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1">
          {entries.map((e) => (
            <li key={e.id} className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-[11px] text-ink-3">
              {t.ai.task[e.taskType as keyof typeof t.ai.task] ?? e.taskType} · {e.provider}/{e.model}
              {e.confidence != null && ` · ${Math.round(e.confidence * 100)}%`} ·{" "}
              {new Date(e.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
