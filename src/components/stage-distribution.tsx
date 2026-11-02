import { STAGES, STAGE_ORDER } from "@/lib/constants";

const STAGE_COLORS: Record<string, string> = {
  RECEIVED: "#9db0cf",
  DOCUMENT_SCRUTINY: "#e58543",
  FIELD_VERIFICATION: "#d96f2b",
  OFFICER_RECOMMENDATION: "#48669a",
  FINAL_DECISION: "#355082",
  APPROVED: "#318d60",
  REJECTED: "#b91c1c",
  RETURNED: "#b45309",
};

/** Server-rendered SVG donut — no client JS needed. */
export function StageDonut({
  counts,
  labels,
}: {
  counts: Record<string, number>;
  labels: Record<string, string>;
}) {
  const order = [...STAGE_ORDER, STAGES.APPROVED, STAGES.REJECTED, STAGES.RETURNED];
  const total = order.reduce((s, k) => s + (counts[k] ?? 0), 0);
  const R = 56;
  const C = 2 * Math.PI * R;
  let offset = 0;

  const segments = order
    .filter((k) => (counts[k] ?? 0) > 0)
    .map((k) => {
      const frac = total ? counts[k] / total : 0;
      const seg = { key: k, frac, start: offset, color: STAGE_COLORS[k] };
      offset += frac;
      return seg;
    });

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0">
        <svg width="150" height="150" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={R} fill="none" stroke="#eceae3" strokeWidth="18" />
          {segments.map((s) => (
            <circle
              key={s.key}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={s.color}
              strokeWidth="18"
              strokeDasharray={`${s.frac * C} ${C - s.frac * C}`}
              strokeDashoffset={-s.start * C + C / 4}
              strokeLinecap="butt"
            />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-ink">{total}</span>
        </div>
      </div>
      <ul className="grid flex-1 grid-cols-1 gap-1.5 sm:grid-cols-2">
        {order.map((k) => (
          <li key={k} className="flex items-center gap-2 text-xs">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: STAGE_COLORS[k] }} />
            <span className="min-w-0 flex-1 truncate text-ink-2">{labels[k]}</span>
            <span className="font-semibold text-ink">{counts[k] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
