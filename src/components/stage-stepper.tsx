import { STAGES, STAGE_ORDER } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export function StageStepper({
  currentStage,
  labels,
}: {
  currentStage: string;
  labels: Record<string, string>;
}) {
  const terminal = [STAGES.APPROVED, STAGES.REJECTED].includes(currentStage as never);
  const curIdx = STAGE_ORDER.indexOf(currentStage as never);

  return (
    <ol className="flex items-center">
      {STAGE_ORDER.map((s, i) => {
        const done = terminal || curIdx > i;
        const active = curIdx === i;
        return (
          <li key={s} className={cn("relative flex items-center", i < STAGE_ORDER.length - 1 && "flex-1")}>
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-colors",
                  done
                    ? "border-forest-500 bg-forest-500 text-white"
                    : active
                      ? "border-saffron-500 bg-saffron-50 text-saffron-600"
                      : "border-line-2 bg-surface text-ink-3"
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "absolute top-8 w-24 text-center text-[10px] leading-tight",
                  active ? "font-semibold text-ink" : done ? "text-ink-3" : "text-ink-3/70"
                )}
              >
                {labels[s]}
              </span>
            </div>
            {i < STAGE_ORDER.length - 1 && (
              <div className={cn("mx-1 mb-1 h-0.5 flex-1 rounded", curIdx > i || terminal ? "bg-forest-400" : "bg-line-2")} />
            )}
          </li>
        );
      })}
    </ol>
  );
}
