import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileSearch,
  Files,
  MapPin,
  RotateCcw,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getDict, getLanguage } from "@/i18n";
import { ACTIVE_STAGES, STAGES } from "@/lib/constants";
import {
  buildChecklist,
  computePriorityScore,
  missingRequirementCount,
} from "@/lib/services/applications";
import { StatCard } from "@/components/stat-card";
import { StageDonut } from "@/components/stage-distribution";
import { StageBadge, PriorityBadge } from "@/components/stage-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/skeleton";
import { daysBetween, formatDateTime, formatINR } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const lang = await getLanguage();
  const t = await getDict();

  const canSeeAll = user.roleId !== "FIELD_OFFICER";
  const baseWhere = canSeeAll ? {} : { assignedOfficerId: user.id };

  const [stageCounts, pending, awaitingDocs, awaitingField, returned, approved, rejected, total, recentAudit, activeApps, requirements] =
    await Promise.all([
      prisma.application.groupBy({ by: ["currentStage"], where: baseWhere, _count: true }),
      prisma.application.count({ where: { ...baseWhere, currentStage: { in: ACTIVE_STAGES } } }),
      prisma.application.count({ where: { ...baseWhere, currentStage: STAGES.DOCUMENT_SCRUTINY } }),
      prisma.application.count({ where: { ...baseWhere, currentStage: STAGES.FIELD_VERIFICATION } }),
      prisma.application.count({ where: { ...baseWhere, currentStage: STAGES.RETURNED } }),
      prisma.application.count({ where: { ...baseWhere, currentStage: STAGES.APPROVED } }),
      prisma.application.count({ where: { ...baseWhere, currentStage: STAGES.REJECTED } }),
      prisma.application.count({ where: baseWhere }),
      prisma.auditLog.findMany({
        where: { applicationId: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { name: true, nameKn: true } }, application: { select: { id: true, referenceNumber: true } } },
      }),
      prisma.application.findMany({
        where: { ...baseWhere, currentStage: { in: ACTIVE_STAGES } },
        include: {
          applicant: { select: { fullName: true, fullNameKn: true, village: true, villageKn: true, district: true } },
          assignedOfficer: { select: { name: true, nameKn: true } },
          documents: { select: { documentType: true, verificationStatus: true } },
        },
      }),
      prisma.documentRequirement.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    ]);

  const counts = Object.fromEntries(stageCounts.map((s) => [s.currentStage, s._count]));
  const stageLabels = Object.fromEntries(
    Object.keys(t.stage).map((k) => [k, t.stage[k as keyof typeof t.stage]])
  );


  // priority queue — compute score incl. missing docs
  const queue = activeApps
    .map((app) => {
      const checklist = buildChecklist(
        requirements,
        app.documents.map((d) => ({
          id: "",
          documentType: d.documentType,
          originalFilename: "",
          mimeType: "",
          uploadedAt: new Date(0),
          verificationStatus: d.verificationStatus,
          extractedData: null,
          storageKey: "",
        }))
      );
      const missing = missingRequirementCount(checklist);
      const score = computePriorityScore({ ...app, missingDocs: missing });
      const overdue = app.internalTargetDate ? new Date() > app.internalTargetDate : false;
      return { app, missing, score, overdue };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const attention = queue.filter((q) => q.overdue || q.missing > 0).slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-ink-3">
            {t.dashboard.greeting}, {lang === "kn" && user.nameKn ? user.nameKn : user.name}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">{t.dashboard.title}</h1>
          <p className="mt-1 text-sm text-ink-3">{t.dashboard.subtitle}</p>
        </div>
        <p className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink-3">
          {t.common.demoNotice}
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
        <StatCard label={t.dashboard.totalApplications} value={total} icon={<Files className="h-5 w-5" />} tone="navy" />
        <StatCard label={t.dashboard.pendingApplications} value={pending} icon={<Clock3 className="h-5 w-5" />} tone="saffron" />
        <StatCard label={t.dashboard.awaitingDocs} value={awaitingDocs} icon={<FileSearch className="h-5 w-5" />} tone="amber" />
        <StatCard label={t.dashboard.awaitingField} value={awaitingField} icon={<MapPin className="h-5 w-5" />} tone="saffron" />
        <StatCard label={t.dashboard.returnedApplications} value={returned} icon={<RotateCcw className="h-5 w-5" />} tone="amber" />
        <StatCard label={t.dashboard.approvedApplications} value={approved} icon={<CheckCircle2 className="h-5 w-5" />} tone="green" />
        <StatCard label={t.dashboard.rejectedApplications} value={rejected} icon={<XCircle className="h-5 w-5" />} tone="rose" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Priority queue — 2/3 width */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <div>
              <CardTitle>{t.dashboard.priorityQueue}</CardTitle>
              <CardDescription>{t.dashboard.priorityQueueHint}</CardDescription>
            </div>
            <Link href="/applications" className="flex items-center gap-1 text-xs font-medium text-navy-600 hover:underline">
              {t.common.viewAll} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {queue.length === 0 ? (
              <EmptyState title={t.dashboard.emptyQueue} />
            ) : (
              <ul className="divide-y divide-line">
                {queue.map(({ app, missing, overdue }) => {
                  const age = daysBetween(app.submittedAt);
                  return (
                    <li key={app.id}>
                      <Link
                        href={`/applications/${app.id}`}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-canvas-2"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium text-ink">
                              {lang === "kn" && app.applicant.fullNameKn ? app.applicant.fullNameKn : app.applicant.fullName}
                            </span>
                            <span className="text-xs text-ink-3">{app.referenceNumber}</span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-ink-3">
                            {lang === "kn" && app.applicant.villageKn ? app.applicant.villageKn : app.applicant.village}
                            {" · "}
                            {formatINR(app.declaredAnnualIncome)}
                            {" · "}
                            {app.assignedOfficer ? (lang === "kn" && app.assignedOfficer.nameKn ? app.assignedOfficer.nameKn : app.assignedOfficer.name) : t.applications.unassigned}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <StageBadge stage={app.currentStage} label={t.stage[app.currentStage as keyof typeof t.stage]} />
                          <span className={`text-[11px] ${overdue ? "font-semibold text-rose" : "text-ink-3"}`}>
                            {age} {t.dashboard.daysOld}
                            {overdue ? ` · ${t.dashboard.overdue}` : ""}
                            {missing > 0 ? ` · ${missing} doc${missing > 1 ? "s" : ""} missing` : ""}
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Right column */}
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>{t.dashboard.stageDistribution}</CardTitle>
            </CardHeader>
            <CardContent>
              <StageDonut counts={counts} labels={stageLabels} />
              <p className="mt-3 text-[11px] text-ink-3">{t.dashboard.internalTargetNote}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5">
                <TriangleAlert className="h-4 w-4 text-saffron-500" />
                {t.dashboard.needsAttention}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {attention.length === 0 ? (
                <p className="px-5 py-4 text-sm text-ink-3">{t.dashboard.emptyQueue}</p>
              ) : (
                <ul className="divide-y divide-line">
                  {attention.map(({ app, missing, overdue }) => (
                    <li key={app.id}>
                      <Link href={`/applications/${app.id}`} className="flex items-center gap-2 px-5 py-2.5 hover:bg-canvas-2">
                        <PriorityBadge priority={app.priority} label={t.priority[app.priority as keyof typeof t.priority]} />
                        <span className="min-w-0 flex-1 truncate text-sm text-ink">
                          {app.referenceNumber}
                        </span>
                        <span className="text-[11px] text-ink-3">
                          {overdue ? t.dashboard.overdue : `${missing} missing`}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t.dashboard.recentActivity}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="max-h-72 divide-y divide-line overflow-y-auto">
                {recentAudit.map((a) => (
                  <li key={a.id} className="px-5 py-2.5">
                    <Link href={a.application ? `/applications/${a.application.id}` : "#"} className="block">
                      <p className="text-[13px] text-ink">
                        <span className="font-medium">{a.application?.referenceNumber}</span>{" "}
                        <span className="text-ink-3">
                          {t.timeline.action[a.action as keyof typeof t.timeline.action] ?? a.action}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-ink-3">
                        {a.actor ? (lang === "kn" && a.actor.nameKn ? a.actor.nameKn : a.actor.name) : "System"} ·{" "}
                        {formatDateTime(a.createdAt, lang)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
