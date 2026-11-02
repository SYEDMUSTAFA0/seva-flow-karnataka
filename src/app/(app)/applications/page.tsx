import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDict, getLanguage } from "@/i18n";
import { listApplications } from "@/lib/services/applications";
import { hasPermission } from "@/lib/permissions";
import { PERMISSIONS, STAGES } from "@/lib/constants";
import { StageBadge } from "@/components/stage-badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, FilePlus2, Files } from "lucide-react";
import { daysBetween, formatINR } from "@/lib/utils";
import { ApplicationsFilterBar } from "./filter-bar";

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const lang = await getLanguage();
  const t = await getDict();
  const sp = await searchParams;

  const filters = {
    q: sp.q || undefined,
    stage: sp.stage || undefined,
    district: sp.district || undefined,
    mine: sp.mine === "1",
    sort: sp.sort || "newest",
    page: sp.page ? parseInt(sp.page, 10) : 1,
    view: sp.view || undefined,
  };

  const [{ total, rows, page, pages }, districts] = await Promise.all([
    listApplications(user, filters),
    prisma.applicant.findMany({ select: { district: true }, distinct: ["district"] }),
  ]);

  const canCreate = hasPermission(user, PERMISSIONS.APP_CREATE);
  const mkQuery = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { ...filters, page, ...over } as Record<string, string | number | boolean | undefined>;
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === "" || v === false) continue;
      p.set(k, String(v === true ? 1 : v));
    }
    return `/applications?${p.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{t.applications.title}</h1>
          <p className="mt-0.5 text-sm text-ink-3">{t.applications.subtitle}</p>
        </div>
        {canCreate && (
          <Link href="/applications/new">
            <Button variant="accent">
              <FilePlus2 className="h-4 w-4" />
              {t.applications.newApplication}
            </Button>
          </Link>
        )}
      </div>

      <ApplicationsFilterBar
        filters={filters}
        districts={districts.map((d) => d.district)}
        stageOptions={Object.values(STAGES).map((s) => ({ value: s, label: t.stage[s as keyof typeof t.stage] }))}
        labels={{
          searchPlaceholder: t.applications.searchPlaceholder,
          allStages: t.applications.allStages,
          allDistricts: t.applications.allDistricts,
          onlyMine: t.applications.onlyMine,
          sortNewest: t.applications.sortNewest,
          sortOldest: t.applications.sortOldest,
          sortPriority: t.applications.sortPriority,
          sortIncome: t.applications.sortIncome,
          filter: t.common.filter,
          clear: t.common.clearFilters,
          showMine: hasPermission(user, PERMISSIONS.APP_VIEW_ALL),
        }}
      />

      <Card className="mt-4 overflow-hidden">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={<Files className="h-5 w-5" />}
              title={t.applications.emptyTitle}
              body={t.applications.emptyBody}
              action={
                canCreate ? (
                  <Link href="/applications/new">
                    <Button variant="secondary" size="sm">
                      {t.applications.newApplication}
                    </Button>
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line bg-canvas-2/60 text-left text-xs text-ink-3">
                      <th className="px-4 py-3 font-medium">{t.applications.referenceNo}</th>
                      <th className="px-4 py-3 font-medium">{t.applications.applicant}</th>
                      <th className="px-4 py-3 font-medium">{t.applications.declaredIncome}</th>
                      <th className="px-4 py-3 font-medium">{t.applications.stage}</th>
                      <th className="px-4 py-3 font-medium">{t.applications.assignedTo}</th>
                      <th className="px-4 py-3 font-medium">{t.applications.submittedAt}</th>
                      <th className="px-4 py-3 font-medium">{t.dashboard.age}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {rows.map((app) => (
                      <tr key={app.id} className="transition-colors hover:bg-canvas-2/60">
                        <td className="px-4 py-3">
                          <Link href={`/applications/${app.id}`} className="font-medium text-navy-700 hover:underline">
                            {app.referenceNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-ink">
                            {lang === "kn" && app.applicant.fullNameKn ? app.applicant.fullNameKn : app.applicant.fullName}
                          </p>
                          <p className="text-xs text-ink-3">
                            {lang === "kn" && app.applicant.villageKn ? app.applicant.villageKn : app.applicant.village},{" "}
                            {app.applicant.district}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-ink-2">{formatINR(app.declaredAnnualIncome)}</td>
                        <td className="px-4 py-3">
                          <StageBadge stage={app.currentStage} label={t.stage[app.currentStage as keyof typeof t.stage]} />
                        </td>
                        <td className="px-4 py-3 text-ink-2">
                          {app.assignedOfficer
                            ? lang === "kn" && app.assignedOfficer.nameKn
                              ? app.assignedOfficer.nameKn
                              : app.assignedOfficer.name
                            : t.applications.unassigned}
                        </td>
                        <td className="px-4 py-3 text-ink-3">{new Date(app.submittedAt).toLocaleDateString(lang === "kn" ? "kn-IN" : "en-IN")}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs ${daysBetween(app.submittedAt) > 21 ? "font-semibold text-rose" : "text-ink-3"}`}>
                            {daysBetween(app.submittedAt)}d
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y divide-line md:hidden">
                {rows.map((app) => (
                  <li key={app.id}>
                    <Link href={`/applications/${app.id}`} className="block px-4 py-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-ink">
                          {lang === "kn" && app.applicant.fullNameKn ? app.applicant.fullNameKn : app.applicant.fullName}
                        </p>
                        <StageBadge stage={app.currentStage} label={t.stageShort[app.currentStage as keyof typeof t.stageShort]} />
                      </div>
                      <p className="mt-1 text-xs text-ink-3">
                        {app.referenceNumber} · {lang === "kn" && app.applicant.villageKn ? app.applicant.villageKn : app.applicant.village}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-3">
                        {formatINR(app.declaredAnnualIncome)} · {daysBetween(app.submittedAt)} {t.dashboard.daysOld}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {pages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-ink-3">
            {t.common.showing} {rows.length} {t.common.of} {total} {t.common.results}
          </p>
          <div className="flex items-center gap-2">
            <Link href={mkQuery({ page: page - 1 })} aria-disabled={page <= 1}>
              <Button variant="secondary" size="sm" disabled={page <= 1}>
                <ChevronLeft className="h-4 w-4" />
                {t.common.previous}
              </Button>
            </Link>
            <span className="text-xs text-ink-3">
              {t.common.page} {page} / {pages}
            </span>
            <Link href={mkQuery({ page: page + 1 })} aria-disabled={page >= pages}>
              <Button variant="secondary" size="sm" disabled={page >= pages}>
                {t.common.next}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
