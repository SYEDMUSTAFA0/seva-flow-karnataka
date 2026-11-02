import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDict, getLanguage } from "@/i18n";
import { hasPermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { StageBadge } from "@/components/stage-badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/skeleton";
import { ScrollText, ShieldCheck } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

const ACTION_FILTERS = [
  "all",
  "APPLICATION_CREATED",
  "STAGE_CHANGED",
  "DOCUMENT_UPLOADED",
  "DOCUMENT_VERIFIED",
  "AI_ASSISTANCE",
  "FIELD_SUBMITTED",
  "RECOMMENDATION_SUBMITTED",
  "DECISION_MADE",
  "RETURNED",
  "USER_LOGIN",
];

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasPermission(user, PERMISSIONS.AUDIT_VIEW_ALL)) redirect("/dashboard");
  const lang = await getLanguage();
  const t = await getDict();
  const sp = await searchParams;

  const action = sp.action && sp.action !== "all" ? sp.action : undefined;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10));
  const pageSize = 25;

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where: action ? { action } : {} }),
    prisma.auditLog.findMany({
      where: action ? { action } : {},
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (page - 1) * pageSize,
      include: {
        actor: { select: { name: true, nameKn: true, role: { select: { nameEn: true, nameKn: true } } } },
        application: { select: { id: true, referenceNumber: true } },
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{t.audit.title}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t.audit.subtitle} — {t.audit.immutable}
          </p>
        </div>
      </div>

      {/* Action filter */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {ACTION_FILTERS.map((a) => (
          <Link
            key={a}
            href={a === "all" ? "/audit" : `/audit?action=${a}`}
            className={`chip transition-colors ${
              (action ?? "all") === a ? "border-navy-400 bg-navy-100 text-navy-800" : "border-line-2 text-ink-3 hover:border-line"
            }`}
          >
            {a === "all" ? t.audit.filterAll : (t.timeline.action[a as keyof typeof t.timeline.action] ?? a)}
          </Link>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState icon={<ScrollText className="h-5 w-5" />} title={t.audit.empty} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-canvas-2/60 text-left text-xs text-ink-3">
                    <th className="px-4 py-3 font-medium">{t.audit.timestamp}</th>
                    <th className="px-4 py-3 font-medium">{t.audit.actor}</th>
                    <th className="px-4 py-3 font-medium">{t.audit.action}</th>
                    <th className="px-4 py-3 font-medium">{t.audit.application}</th>
                    <th className="px-4 py-3 font-medium">{t.audit.previousStatus} → {t.audit.newStatus}</th>
                    <th className="px-4 py-3 font-medium">{t.common.remarks}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-canvas-2/50">
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-ink-3">{formatDateTime(r.createdAt, lang)}</td>
                      <td className="px-4 py-2.5">
                        {r.actor ? (
                          <>
                            <span className="text-[13px] text-ink-2">
                              {lang === "kn" && r.actor.nameKn ? r.actor.nameKn : r.actor.name}
                            </span>
                            <span className="block text-[11px] text-ink-3">
                              {lang === "kn" ? r.actor.role.nameKn : r.actor.role.nameEn}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-ink-3">System</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[13px] font-medium text-ink-2">
                        {t.timeline.action[r.action as keyof typeof t.timeline.action] ?? r.action}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.application ? (
                          <Link href={`/applications/${r.application.id}`} className="text-xs font-medium text-navy-600 hover:underline">
                            {r.application.referenceNumber}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.previousStatus || r.newStatus ? (
                          <div className="flex items-center gap-1">
                            {r.previousStatus && <StageBadge stage={r.previousStatus} label={t.stageShort[r.previousStatus as keyof typeof t.stageShort] ?? r.previousStatus} />}
                            {r.newStatus && <StageBadge stage={r.newStatus} label={t.stageShort[r.newStatus as keyof typeof t.stageShort] ?? r.newStatus} />}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="max-w-56 truncate px-4 py-2.5 text-xs text-ink-3" title={r.remarks ?? undefined}>
                        {r.remarks ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-ink-3">
          <span>{t.common.showing} {rows.length} {t.common.of} {total}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={`/audit?action=${action ?? "all"}&page=${page - 1}`} className="btn-base border border-line-2 px-3 py-1.5">{t.common.previous}</Link>}
            {page < pages && <Link href={`/audit?action=${action ?? "all"}&page=${page + 1}`} className="btn-base border border-line-2 px-3 py-1.5">{t.common.next}</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
