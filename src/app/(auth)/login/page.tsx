import { getCurrentUser } from "@/lib/auth";
import { getLanguage, dictFor } from "@/i18n";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const lang = await getLanguage();
  const t = dictFor(lang);

  const demoUsers = await prisma.user.findMany({
    where: { active: true },
    include: { role: true },
    orderBy: { createdAt: "asc" },
    take: 6,
  });

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden w-[46%] flex-col justify-between bg-navy-900 p-10 text-white lg:flex">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-saffron-500 font-bold text-white">
              ಸೇ
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight">{t.common.appName}</p>
              <p className="text-xs text-navy-200">Revenue Department · Karnataka</p>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <p className="max-w-md text-3xl font-semibold leading-snug text-white/95">
            {t.common.tagline}
          </p>
          <p className="max-w-md text-sm leading-relaxed text-navy-200">
            {t.dashboard.subtitle}
          </p>
          <div className="flex gap-2">
            {["ಅರ್ಜಿ ಸ್ವೀಕರಿಸಲಾಗಿದೆ", "ದಾಖಲೆ ಪರಿಶೀಲನೆ", "ಸ್ಥಳ ಪರಿಶೀಲನೆ", "ಅಂತಿಮ ನಿರ್ಧಾರ"].map(
              (s, i) => (
                <span
                  key={s}
                  className="rounded-full border border-navy-600 bg-navy-800 px-3 py-1 text-xs text-navy-100"
                >
                  {i + 1} · {s}
                </span>
              )
            )}
          </div>
        </div>
        <p className="text-xs text-navy-300">{t.common.demoNotice}</p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <LoginForm
          demoUsers={demoUsers.map((u) => ({
            email: u.email,
            name: u.name,
            nameKn: u.nameKn,
            roleEn: u.role.nameEn,
            roleKn: u.role.nameKn,
          }))}
        />
      </div>
    </div>
  );
}
