"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  FilePlus2,
  Files,
  LayoutDashboard,
  Languages,
  LogOut,
  MapPin,
  Menu,
  ScrollText,
  Search,
  Settings,
  UserCog,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { useI18n } from "@/i18n/client";
import type { AuthUser } from "@/lib/permissions";
import { logout } from "@/lib/actions/auth";
import { setLanguage } from "@/lib/actions/preferences";
import { markAllNotificationsRead } from "@/lib/actions/notifications";
import { cn, formatDateTime, initials } from "@/lib/utils";

export interface ShellNotification {
  id: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
  applicationId: string | null;
}

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, key: "dashboard" as const },
  { href: "/applications", icon: Files, key: "applications" as const },
  { href: "/applications/new", icon: FilePlus2, key: "newApplication" as const, perm: "app:create" },
  { href: "/applications?view=field", icon: MapPin, key: "fieldWork" as const, perm: "field:verify" },
  { href: "/audit", icon: ScrollText, key: "audit" as const, perm: "audit:view-all" },
  { href: "/admin", icon: UserCog, key: "admin" as const, perm: "users:manage" },
  { href: "/settings", icon: Settings, key: "settings" as const },
];

export function AppShell({
  user,
  permissions,
  notifications,
  children,
}: {
  user: AuthUser;
  permissions: string[];
  notifications: ShellNotification[];
  children: React.ReactNode;
}) {
  const { lang, t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [, startTransition] = useTransition();
  const bellRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.read).length;
  const visibleNav = NAV.filter((n) => !n.perm || permissions.includes(n.perm));

  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setDrawerOpen(false);
    setBellOpen(false);
    setUserOpen(false);
  }
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const isActive = (href: string) => {
    const base = href.split("?")[0];
    if (href.includes("view=field")) return pathname === "/applications" && false;
    return pathname === base || (base !== "/dashboard" && pathname.startsWith(base + "/"));
  };

  const renderNavLinks = (mobile?: boolean) => (
    <nav className={cn("flex flex-col gap-1", mobile ? "p-3" : "px-3 py-4")}>
      {visibleNav.map((item) => {
        const active = !item.href.includes("view=field") && isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "text-navy-800" : "text-ink-3 hover:bg-canvas-2 hover:text-ink"
            )}
          >
            {active && (
              <motion.span
                layoutId={mobile ? "nav-mobile" : "nav-desktop"}
                className="absolute inset-0 rounded-lg bg-navy-100"
                transition={{ type: "spring", damping: 30, stiffness: 400 }}
              />
            )}
            <Icon className="relative z-10 h-4.5 w-4.5 shrink-0" />
            <span className="relative z-10">{t.nav[item.key]}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 border-b border-line px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-saffron-500 text-sm font-bold text-white">
            ಸೇ
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-ink">{t.common.appName}</p>
            <p className="text-[11px] text-ink-3">Revenue Department</p>
          </div>
        </Link>
        <div className="flex-1 overflow-y-auto">
          {renderNavLinks()}
        </div>
        <div className="border-t border-line p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-700">
              {initials(user.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-ink">{lang === "kn" && user.nameKn ? user.nameKn : user.name}</p>
              <p className="truncate text-[11px] text-ink-3">
                {lang === "kn" ? user.roleNameKn : user.roleNameEn}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur lg:px-6">
          <button
            className="rounded-lg p-2 text-ink-2 hover:bg-canvas-2 lg:hidden"
            onClick={() => setDrawerOpen(true)}
            aria-label={t.nav.menu}
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Global search */}
          <form
            className="relative hidden max-w-md flex-1 sm:block"
            onSubmit={(e) => {
              e.preventDefault();
              const q = new FormData(e.currentTarget).get("q") as string;
              router.push(`/applications?q=${encodeURIComponent(q)}`);
            }}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <input
              name="q"
              placeholder={t.applications.searchPlaceholder}
              className="input-base h-9 pl-9 text-[13px]"
            />
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Language switcher */}
            <form action={setLanguage}>
              <input type="hidden" name="lang" value={lang === "kn" ? "en" : "kn"} />
              <button
                type="submit"
                className="btn-base h-9 gap-1.5 rounded-lg border border-line-2 px-2.5 text-xs text-ink-2 hover:bg-canvas-2"
                title={t.common.language}
              >
                <Languages className="h-4 w-4" />
                <span className="hidden sm:inline">{lang === "kn" ? "English" : "ಕನ್ನಡ"}</span>
              </button>
            </form>

            {/* Notifications */}
            <div className="relative" ref={bellRef}>
              <button
                className="relative rounded-lg p-2 text-ink-2 hover:bg-canvas-2"
                onClick={() => setBellOpen((v) => !v)}
                aria-label={t.nav.notifications}
              >
                <Bell className="h-4.5 w-4.5" />
                {unread > 0 && (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-saffron-500 px-1 text-[10px] font-semibold text-white">
                    {unread}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {bellOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-11 w-80 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-lift)]"
                  >
                    <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                      <p className="text-sm font-semibold">{t.nav.notifications}</p>
                      {unread > 0 && (
                        <button
                          className="text-xs text-navy-600 hover:underline"
                          onClick={() => startTransition(() => markAllNotificationsRead())}
                        >
                          {t.nav.markAllRead}
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="px-4 py-6 text-center text-sm text-ink-3">{t.nav.noNotifications}</p>
                      ) : (
                        notifications.slice(0, 12).map((n) => (
                          <Link
                            key={n.id}
                            href={n.applicationId ? `/applications/${n.applicationId}` : "#"}
                            onClick={() => setBellOpen(false)}
                            className={cn(
                              "block border-b border-line/60 px-4 py-3 last:border-0 hover:bg-canvas-2",
                              !n.read && "bg-saffron-50/50"
                            )}
                          >
                            <p className="text-[13px] font-medium text-ink">{n.title}</p>
                            {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-ink-3">{n.body}</p>}
                            <p className="mt-1 text-[11px] text-ink-3">{formatDateTime(n.createdAt, lang)}</p>
                          </Link>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* User menu */}
            <div className="relative" ref={userRef}>
              <button
                className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-canvas-2"
                onClick={() => setUserOpen((v) => !v)}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy-800 text-xs font-semibold text-white">
                  {initials(user.name)}
                </div>
              </button>
              <AnimatePresence>
                {userOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-11 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-lift)]"
                  >
                    <div className="border-b border-line px-4 py-3">
                      <p className="text-sm font-semibold text-ink">{lang === "kn" && user.nameKn ? user.nameKn : user.name}</p>
                      <p className="text-xs text-ink-3">{user.email}</p>
                      <p className="mt-1 inline-block rounded-md bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-700">
                        {lang === "kn" ? user.roleNameKn : user.roleNameEn}
                        {user.taluk ? ` · ${user.taluk}` : ""}
                      </p>
                    </div>
                    <form action={logout} className="p-2">
                      <button
                        type="submit"
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose hover:bg-rose-bg"
                      >
                        <LogOut className="h-4 w-4" />
                        {t.nav.signOut}
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      </div>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            className="fixed inset-0 z-50 bg-navy-900/45 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDrawerOpen(false)}
          >
            <motion.div
              className="h-full w-72 bg-surface shadow-[var(--shadow-lift)]"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 32, stiffness: 380 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-line px-4 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron-500 text-xs font-bold text-white">
                    ಸೇ
                  </div>
                  <p className="text-sm font-semibold">{t.common.appName}</p>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-1.5 hover:bg-canvas-2" aria-label="Close">
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
              {renderNavLinks(true)}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-line bg-surface lg:hidden">
        {visibleNav.slice(0, 5).map((item) => {
          const active = !item.href.includes("view=field") && isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                active ? "text-navy-700" : "text-ink-3"
              )}
            >
              <Icon className="h-5 w-5" />
              {t.nav[item.key]}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
