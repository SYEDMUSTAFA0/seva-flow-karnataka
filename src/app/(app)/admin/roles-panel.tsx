"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { adminSetRolePermissionsAction, adminUpdateRoleAction } from "@/lib/actions/admin";
import { formJson, useAdminAction, useDialog, DialogActions } from "./shared";

export interface RoleRow {
  id: string;
  nameEn: string;
  nameKn: string;
  description: string | null;
  /** Effective permission set (DB override or code defaults resolved server-side). */
  permissions: string[];
}

export function RolesPanel({
  roles,
  allPermissions,
  canManage,
}: {
  roles: RoleRow[];
  allPermissions: string[];
  canManage: boolean;
}) {
  const { lang, t } = useI18n();
  const { pending, run } = useAdminAction();
  const editDlg = useDialog<RoleRow>();
  const [permState, setPermState] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(roles.map((r) => [r.id, r.permissions]))
  );

  const toggle = (role: RoleRow, permission: string) => {
    const current = permState[role.id] ?? [];
    const next = current.includes(permission) ? current.filter((p) => p !== permission) : [...current, permission];
    setPermState((s) => ({ ...s, [role.id]: next })); // optimistic
    run(() => adminSetRolePermissionsAction(role.id, next), { okMsg: t.admin.saved });
  };

  const saveRole = (e: React.FormEvent<HTMLFormElement>) => {
    const d = formJson(e);
    run(
      () => adminUpdateRoleAction(editDlg.editing!.id, { nameEn: d.nameEn, nameKn: d.nameKn, description: d.description }),
      { onOk: editDlg.close }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.admin.roles}</CardTitle>
        <CardDescription>{t.admin.rolesHint}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0 px-5 pb-5">
        <table className="w-full min-w-[560px] text-xs">
          <thead>
            <tr className="border-b border-line text-left text-ink-3">
              <th className="py-2 pr-3 font-medium">Permission</th>
              {roles.map((r) => (
                <th key={r.id} className="px-2 py-2 font-medium">
                  <span className="inline-flex items-center gap-1">
                    {lang === "kn" ? r.nameKn : r.nameEn}
                    {canManage && (
                      <button onClick={() => editDlg.openFor(r)} className="text-ink-3 hover:text-navy-700" title={t.admin.editRole}>
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {allPermissions.map((p) => (
              <tr key={p}>
                <td className="py-1.5 pr-3 font-mono text-[11px] text-ink-2">{p}</td>
                {roles.map((r) => {
                  const granted = (permState[r.id] ?? []).includes(p);
                  return (
                    <td key={r.id} className="px-2 py-1.5 text-center">
                      {canManage ? (
                        <button
                          onClick={() => toggle(r, p)}
                          disabled={pending}
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                            granted ? "border-forest-300 bg-forest-50 text-forest-600" : "border-line-2 text-line-2 hover:border-navy-300"
                          }`}
                          aria-label={`${r.id} ${p}`}
                        >
                          {granted ? "✓" : ""}
                        </button>
                      ) : granted ? (
                        <span className="text-forest-600">●</span>
                      ) : (
                        <span className="text-line-2">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>

      <Dialog open={editDlg.open} onClose={editDlg.close} title={t.admin.editRole}>
        <form onSubmit={saveRole} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ro-nameEn" required>{t.admin.labelEn}</Label>
              <Input id="ro-nameEn" name="nameEn" required defaultValue={editDlg.editing?.nameEn} />
            </div>
            <div>
              <Label htmlFor="ro-nameKn" required>{t.admin.labelKn}</Label>
              <Input id="ro-nameKn" name="nameKn" required defaultValue={editDlg.editing?.nameKn} />
            </div>
          </div>
          <div>
            <Label htmlFor="ro-desc">{t.admin.description}</Label>
            <Textarea id="ro-desc" name="description" rows={2} defaultValue={editDlg.editing?.description ?? ""} />
          </div>
          <DialogActions pending={pending} />
        </form>
      </Dialog>
    </Card>
  );
}
