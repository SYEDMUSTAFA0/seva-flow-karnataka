import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface TimelineItem {
  id: string;
  action: string;
  actorName: string | null;
  previousStatus: string | null;
  newStatus: string | null;
  remarks: string | null;
  remarksKn: string | null;
  createdAt: string | Date;
}

export function Timeline({
  items,
  lang,
  actionLabels,
  emptyText,
}: {
  items: TimelineItem[];
  lang: string;
  actionLabels: Record<string, string>;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="px-5 py-6 text-center text-sm text-ink-3">{emptyText}</p>;
  }
  return (
    <ol className="relative space-y-0">
      {items.map((item, i) => (
        <li key={item.id} className="relative flex gap-3 pb-5 pl-5 last:pb-0">
          {/* rail */}
          {i < items.length - 1 && <span className="absolute left-[3px] top-4 h-full w-px bg-line-2" />}
          <span
            className={cn(
              "absolute left-0 top-1.5 h-2 w-2 rounded-full border-2 border-surface",
              i === 0 ? "bg-saffron-500" : "bg-line-2"
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium leading-snug text-ink">
              {actionLabels[item.action] ?? item.action}
              {item.newStatus && item.previousStatus !== item.newStatus && (
                <span className="ml-1.5 text-[11px] font-normal text-ink-3">→ {item.newStatus}</span>
              )}
            </p>
            {(lang === "kn" ? item.remarksKn ?? item.remarks : item.remarks) && (
              <p className="mt-0.5 text-xs leading-relaxed text-ink-3">
                {lang === "kn" ? item.remarksKn ?? item.remarks : item.remarks}
              </p>
            )}
            <p className="mt-1 text-[11px] text-ink-3/80">
              {item.actorName ?? "System"} · {formatDateTime(item.createdAt, lang)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
