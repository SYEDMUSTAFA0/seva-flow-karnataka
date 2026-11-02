"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function ApplicationsFilterBar({
  filters,
  districts,
  stageOptions,
  labels,
}: {
  filters: { q?: string; stage?: string; district?: string; mine?: boolean; sort?: string };
  districts: string[];
  stageOptions: { value: string; label: string }[];
  labels: {
    searchPlaceholder: string;
    allStages: string;
    allDistricts: string;
    onlyMine: string;
    sortNewest: string;
    sortOldest: string;
    sortPriority: string;
    sortIncome: string;
    filter: string;
    clear: string;
    showMine: boolean;
  };
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [q, setQ] = useState(filters.q ?? "");
  const [open, setOpen] = useState(false);

  const push = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(over)) {
      if (v === undefined || v === "" || v === "all") p.delete(k);
      else p.set(k, v);
    }
    p.delete("page");
    router.push(`/applications?${p.toString()}`);
  };

  const active = [filters.stage, filters.district, filters.mine ? "1" : "", filters.q].filter(Boolean).length;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <form
          className="relative flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            push({ q: q || undefined });
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className="input-base h-10 pl-9"
          />
        </form>
        <button
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "btn-base h-10 gap-2 rounded-lg border px-3.5 text-sm",
            active ? "border-navy-300 bg-navy-50 text-navy-700" : "border-line-2 text-ink-2 hover:bg-canvas-2"
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {labels.filter}
          {active > 0 && (
            <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-navy-700 px-1 text-[10px] text-white">
              {active}
            </span>
          )}
        </button>
        {active > 0 && (
          <button onClick={() => router.push("/applications")} className="btn-base h-10 rounded-lg border border-line-2 px-3 text-sm text-ink-3 hover:bg-canvas-2">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="card grid grid-cols-1 gap-3 p-4 sm:grid-cols-4">
          <div>
            <p className="mb-1 text-xs font-medium text-ink-3">{labels.allStages}</p>
            <select className="input-base" value={filters.stage ?? "all"} onChange={(e) => push({ stage: e.target.value === "all" ? undefined : e.target.value })}>
              <option value="all">{labels.allStages}</option>
              {stageOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-ink-3">{labels.allDistricts}</p>
            <select className="input-base" value={filters.district ?? "all"} onChange={(e) => push({ district: e.target.value === "all" ? undefined : e.target.value })}>
              <option value="all">{labels.allDistricts}</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-ink-3">Sort</p>
            <select className="input-base" value={filters.sort ?? "newest"} onChange={(e) => push({ sort: e.target.value === "newest" ? undefined : e.target.value })}>
              <option value="newest">{labels.sortNewest}</option>
              <option value="oldest">{labels.sortOldest}</option>
              <option value="priority">{labels.sortPriority}</option>
              <option value="income">{labels.sortIncome}</option>
            </select>
          </div>
          {labels.showMine && (
            <label className="flex items-end gap-2 pb-2 text-sm text-ink-2">
              <input
                type="checkbox"
                checked={!!filters.mine}
                onChange={(e) => push({ mine: e.target.checked ? "1" : undefined })}
                className="h-4 w-4 rounded border-line-2 accent-navy-700"
              />
              {labels.onlyMine}
            </label>
          )}
        </div>
      )}
    </div>
  );
}
