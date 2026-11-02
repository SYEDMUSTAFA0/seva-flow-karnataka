"use client";

import { useActionState, useState } from "react";
import { motion } from "framer-motion";
import { LogIn, ShieldCheck, Languages } from "lucide-react";
import { login, type LoginState } from "@/lib/actions/auth";
import { setLanguage } from "@/lib/actions/preferences";
import { useI18n } from "@/i18n/client";

interface DemoUser {
  email: string;
  name: string;
  nameKn: string | null;
  roleEn: string;
  roleKn: string;
}

export function LoginForm({ demoUsers }: { demoUsers: DemoUser[] }) {
  const { lang, t } = useI18n();
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div className="fade-in-up w-full max-w-md">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-saffron-500 font-bold text-white">
            ಸೇ
          </div>
          <p className="font-semibold">{t.common.appName}</p>
        </div>
        <form action={setLanguage}>
          <input type="hidden" name="lang" value={lang === "kn" ? "en" : "kn"} />
          <button
            type="submit"
            className="btn-base border border-line-2 px-3 py-1.5 text-xs text-ink-2 hover:bg-canvas-2"
          >
            <Languages className="h-3.5 w-3.5" />
            {lang === "kn" ? "English" : "ಕನ್ನಡ"}
          </button>
        </form>
      </div>

      <div className="card p-7">
        <h1 className="text-xl font-semibold text-ink">{t.auth.signIn}</h1>
        <p className="mt-1 text-sm text-ink-3">{t.auth.signInSubtitle}</p>

        <form action={action} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink-2">
              {t.auth.email}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-base"
              placeholder="officer@sevaflow.kar"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink-2">
              {t.auth.password}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-base"
              placeholder="••••••••"
            />
          </div>

          {state.error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="rounded-lg border border-rose/20 bg-rose-bg px-3 py-2 text-sm text-rose"
            >
              {state.error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="btn-base w-full bg-navy-800 px-4 py-2.5 text-white hover:bg-navy-700"
          >
            <LogIn className="h-4 w-4" />
            {pending ? t.auth.signingIn : t.auth.signIn}
          </button>
        </form>
      </div>

      <div className="mt-5">
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-3">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t.auth.demoAccounts}
        </p>
        <p className="mb-3 text-xs text-ink-3">{t.auth.demoAccountsHint}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {demoUsers.map((u) => (
            <button
              key={u.email}
              type="button"
              onClick={() => {
                setEmail(u.email);
                setPassword("seva@123");
              }}
              className="rounded-lg border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-navy-300 hover:bg-navy-50"
            >
              <p className="text-sm font-medium text-ink">{lang === "kn" && u.nameKn ? u.nameKn : u.name}</p>
              <p className="truncate text-xs text-ink-3">{u.email}</p>
              <p className="mt-0.5 text-[11px] font-medium text-saffron-600">
                {lang === "kn" ? u.roleKn : u.roleEn}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
