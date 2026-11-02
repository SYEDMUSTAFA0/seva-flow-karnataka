import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { prisma } from "@/lib/db";
import { getLanguage } from "@/i18n";
import { ROLE_PERMISSIONS } from "@/lib/constants";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const lang = await getLanguage();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 15,
  });

  return (
    <AppShell
      user={user}
      permissions={ROLE_PERMISSIONS[user.roleId] ?? []}
      notifications={notifications.map((n) => ({
        id: n.id,
        title: lang === "kn" ? n.titleKn : n.titleEn,
        body: lang === "kn" ? (n.bodyKn ?? n.bodyEn) : (n.bodyEn ?? n.bodyKn),
        read: n.read,
        createdAt: n.createdAt.toISOString(),
        applicationId: n.applicationId,
      }))}
    >
      {children}
    </AppShell>
  );
}
