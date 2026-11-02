import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDict } from "@/i18n";
import { hasPermission } from "@/lib/permissions";
import { PERMISSIONS } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import { NewApplicationForm } from "./form";

export default async function NewApplicationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const t = await getDict();
  if (!hasPermission(user, PERMISSIONS.APP_CREATE)) redirect("/applications");

  const officers = await prisma.user.findMany({
    where: { active: true, roleId: "REVENUE_INSPECTOR" },
    select: { id: true, name: true, nameKn: true, taluk: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
      <div className="mb-5 flex items-center gap-3">
        <Link href="/applications" className="rounded-lg border border-line-2 p-2 text-ink-2 hover:bg-canvas-2">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{t.applications.newApplication}</h1>
          <p className="mt-0.5 text-sm text-ink-3">{t.applications.subtitle}</p>
        </div>
      </div>
      <NewApplicationForm officers={officers} />
    </div>
  );
}
