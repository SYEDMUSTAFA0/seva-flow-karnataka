import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDict, getLanguage } from "@/i18n";
import { prisma } from "@/lib/db";

import { PERMISSIONS, ROLE_PERMISSIONS, type Permission, type RoleId } from "@/lib/constants";
import { providerInfo } from "@/lib/ai/provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { setLanguage } from "@/lib/actions/preferences";
import { Languages } from "lucide-react";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const lang = await getLanguage();
  const t = await getDict();

  const [requirements, users, roles] = await Promise.all([
    prisma.documentRequirement.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.user.findMany({ include: { role: true }, orderBy: { createdAt: "asc" } }),
    prisma.role.findMany(),
  ]);
  const ai = providerInfo();



  return (
    <div className="mx-auto max-w-4xl px-4 py-6 lg:px-8">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t.settings.title}</h1>
        <p className="mt-0.5 text-sm text-ink-3">{t.settings.subtitle}</p>
      </div>

      <div className="space-y-5">
        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.profile}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Line label={t.common.name} value={lang === "kn" && user.nameKn ? user.nameKn : user.name} />
            <Line label={t.auth.email} value={user.email} />
            <Line label={t.settings.role} value={lang === "kn" ? user.roleNameKn : user.roleNameEn} />
            <Line label={t.settings.taluk} value={user.taluk ?? "—"} />
            <Line label={t.settings.district} value={user.district ?? "—"} />
            <Line label={t.settings.aiProvider} value={`${ai.provider} · ${ai.model}${ai.demo ? " (demo)" : ""}`} />
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.languageSection}</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            {(["kn", "en"] as const).map((l) => (
              <form key={l} action={setLanguage}>
                <input type="hidden" name="lang" value={l} />
                <button
                  type="submit"
                  className={`btn-base gap-2 rounded-lg border px-4 py-2.5 text-sm ${
                    lang === l ? "border-navy-400 bg-navy-50 font-semibold text-navy-800" : "border-line-2 text-ink-2 hover:bg-canvas-2"
                  }`}
                >
                  <Languages className="h-4 w-4" />
                  {l === "kn" ? "ಕನ್ನಡ" : "English"}
                </button>
              </form>
            ))}
          </CardContent>
        </Card>

        {/* Document requirements */}
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.docRequirements}</CardTitle>
            <CardDescription>{t.settings.docRequirementsHint}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-line">
              {requirements.map((r) => (
                <li key={r.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-ink">{lang === "kn" ? r.labelKn : r.labelEn}</p>
                    <p className="text-[11px] text-ink-3">
                      {r.documentType}
                      {r.alternativeOf && ` · or-group: ${r.alternativeOf}`}
                    </p>
                  </div>
                  <Badge tone={r.required ? "saffron" : "neutral"}>{r.required ? t.settings.requiredDoc : t.settings.optionalDoc}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Users */}
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.users}</CardTitle>
            <CardDescription>{t.settings.usersHint}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-line">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between px-5 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-ink">{lang === "kn" && u.nameKn ? u.nameKn : u.name}</p>
                    <p className="text-[11px] text-ink-3">{u.email}{u.taluk ? ` · ${u.taluk}` : ""}</p>
                  </div>
                  <Badge tone="navy">{lang === "kn" ? u.role.nameKn : u.role.nameEn}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Permission matrix */}
        <Card>
          <CardHeader>
            <CardTitle>{t.settings.permissions}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line text-left text-ink-3">
                  <th className="py-2 pr-3 font-medium">Permission</th>
                  {roles.map((r) => (
                    <th key={r.id} className="px-2 py-2 font-medium">{lang === "kn" ? r.nameKn : r.nameEn}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60">
                {Object.values(PERMISSIONS).map((p) => (
                  <tr key={p}>
                    <td className="py-1.5 pr-3 font-mono text-[11px] text-ink-2">{p}</td>
                    {roles.map((r) => (
                      <td key={r.id} className="px-2 py-1.5 text-center">
                        {ROLE_PERMISSIONS[r.id as RoleId]?.includes(p as Permission) ? (
                          <span className="text-forest-600">●</span>
                        ) : (
                          <span className="text-line-2">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{value}</p>
    </div>
  );
}
