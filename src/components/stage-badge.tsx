import { type Stage } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  ClipboardCheck,
  FileSearch,
  Inbox,
  MapPin,
  RotateCcw,
  Scale,
  Send,
  XCircle,
} from "lucide-react";

const STAGE_STYLE: Record<Stage, { icon: React.ElementType; cls: string }> = {
  RECEIVED: { icon: Inbox, cls: "border-navy-200 bg-navy-50 text-navy-700" },
  DOCUMENT_SCRUTINY: { icon: FileSearch, cls: "border-saffron-200 bg-saffron-50 text-saffron-700" },
  FIELD_VERIFICATION: { icon: MapPin, cls: "border-saffron-300 bg-saffron-100 text-saffron-700" },
  OFFICER_RECOMMENDATION: { icon: Send, cls: "border-navy-300 bg-navy-100 text-navy-800" },
  FINAL_DECISION: { icon: Scale, cls: "border-navy-400 bg-navy-100 text-navy-800" },
  APPROVED: { icon: CheckCircle2, cls: "border-forest-200 bg-forest-50 text-forest-700" },
  REJECTED: { icon: XCircle, cls: "border-rose/20 bg-rose-bg text-rose" },
  RETURNED: { icon: RotateCcw, cls: "border-amber/25 bg-amber-bg text-amber" },
};

export function StageBadge({ stage, label }: { stage: string; label: string }) {
  const s = (STAGE_STYLE[stage as Stage] ? stage : "RECEIVED") as Stage;
  const Icon = STAGE_STYLE[s].icon;
  return (
    <span className={cn("chip whitespace-nowrap", STAGE_STYLE[s].cls)}>
      <Icon className="h-3 w-3 shrink-0" />
      {label}
    </span>
  );
}

const PRIORITY_STYLE: Record<string, string> = {
  LOW: "border-line-2 bg-canvas-2 text-ink-3",
  NORMAL: "border-navy-200 bg-navy-50 text-navy-700",
  HIGH: "border-saffron-200 bg-saffron-50 text-saffron-700",
  URGENT: "border-rose/25 bg-rose-bg text-rose",
};

export function PriorityBadge({ priority, label }: { priority: string; label: string }) {
  return (
    <span className={cn("chip whitespace-nowrap", PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.NORMAL)}>
      {label}
    </span>
  );
}

const DOC_STATUS_STYLE: Record<string, string> = {
  PENDING: "border-line-2 bg-canvas-2 text-ink-3",
  VERIFIED: "border-forest-200 bg-forest-50 text-forest-700",
  INVALID: "border-rose/25 bg-rose-bg text-rose",
  MISSING: "border-rose/25 bg-rose-bg text-rose",
  NEEDS_CLARIFICATION: "border-amber/25 bg-amber-bg text-amber",
};

export function DocStatusBadge({ status, label }: { status: string; label: string }) {
  return (
    <span className={cn("chip whitespace-nowrap", DOC_STATUS_STYLE[status] ?? DOC_STATUS_STYLE.PENDING)}>
      <ClipboardCheck className="h-3 w-3" />
      {label}
    </span>
  );
}
