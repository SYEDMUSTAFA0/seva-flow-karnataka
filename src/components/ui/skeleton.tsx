import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-canvas-2", className)} />;
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-xl bg-canvas-2 text-ink-3">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {body && <p className="max-w-sm text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
