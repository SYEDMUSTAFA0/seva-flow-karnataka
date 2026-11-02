"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
import type { ActionResult } from "@/lib/actions/applications";

/** Run a server action inside a transition; toast on result. */
export function useAdminAction() {
  const [pending, startTransition] = useTransition();
  const { t } = useI18n();

  const run = (fn: () => Promise<ActionResult>, opts?: { onOk?: () => void; okMsg?: string }) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(opts?.okMsg ?? t.admin.saved);
        opts?.onOk?.();
      } else {
        toast.error(res.error ?? t.errors.generic);
      }
    });

  return { pending, run };
}

/** Collect an uncontrolled <form> into a plain JSON object. */
export function formJson(e: React.FormEvent<HTMLFormElement>): Record<string, string> {
  e.preventDefault();
  const fd = new FormData(e.currentTarget);
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string") out[k] = v.trim();
  return out;
}

/** Confirmation dialog for destructive actions. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body?: string;
  pending?: boolean;
}) {
  const { t } = useI18n();
  return (
    <Dialog open={open} onClose={onClose} title={title} description={body}>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {t.admin.cancel}
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={pending}>
          {t.admin.delete}
        </Button>
      </div>
    </Dialog>
  );
}

/** Inline busy-state submit row shared by the edit/create dialogs. */
export function DialogActions({ pending }: { pending: boolean }) {
  const { t } = useI18n();
  return (
    <div className="mt-5 flex justify-end gap-2">
      <Button type="submit" loading={pending}>
        {t.admin.save}
      </Button>
    </div>
  );
}

export function useDialog<T>() {
  const [editing, setEditing] = useState<T | null>(null);
  const [open, setOpen] = useState(false);
  return {
    editing,
    open,
    openFor: (v: T | null) => {
      setEditing(v);
      setOpen(true);
    },
    close: () => setOpen(false),
  };
}
