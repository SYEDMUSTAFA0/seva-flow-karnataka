"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/client";
import { Button } from "@/components/ui/button";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useI18n();
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-20 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-bg text-rose">
        <ShieldAlert className="h-7 w-7" />
      </div>
      <h1 className="mt-4 text-xl font-semibold text-ink">{t.errors.generic}</h1>
      <p className="mt-1.5 text-sm text-ink-3">{error?.message?.includes("FORBIDDEN") ? t.errors.forbidden : t.errors.generic}</p>
      <div className="mt-5 flex gap-2">
        <Button variant="primary" onClick={reset}>{t.common.retry}</Button>
        <Link href="/dashboard"><Button variant="secondary">{t.errors.goDashboard}</Button></Link>
      </div>
    </div>
  );
}
