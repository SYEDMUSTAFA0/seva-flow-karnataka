import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "navy",
}: {
  label: string;
  value: number | string;
  sub?: string;
  icon?: React.ReactNode;
  tone?: "navy" | "saffron" | "green" | "rose" | "amber" | "neutral";
}) {
  const tones: Record<string, string> = {
    navy: "bg-navy-50 text-navy-700",
    saffron: "bg-saffron-50 text-saffron-600",
    green: "bg-forest-50 text-forest-600",
    rose: "bg-rose-bg text-rose",
    amber: "bg-amber-bg text-amber",
    neutral: "bg-canvas-2 text-ink-3",
  };
  return (
    <div className="card card-hover flex items-center gap-3.5 px-4 py-4">
      {icon && (
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-ink-3">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold leading-tight tracking-tight text-ink">{value}</p>
        {sub && <p className="mt-0.5 truncate text-[11px] text-ink-3">{sub}</p>}
      </div>
    </div>
  );
}
