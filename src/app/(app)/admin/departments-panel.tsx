"use client";

import { useState } from "react";
import { Building2, Pencil, Plus, Power, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import {
  adminCreateDepartmentAction,
  adminDeleteDepartmentAction,
  adminSetDepartmentActiveAction,
  adminUpdateDepartmentAction,
} from "@/lib/actions/admin";
import { formJson, useAdminAction, useDialog, ConfirmDialog, DialogActions } from "./shared";

export interface DepartmentRow {
  id: string;
  code: string;
  nameEn: string;
  nameKn: string | null;
  taluk: string;
  district: string;
  active: boolean;
  memberCount: number;
}

export function DepartmentsPanel({ departments, canManage }: { departments: DepartmentRow[]; canManage: boolean }) {
  const { lang, t } = useI18n();
  const { pending, run } = useAdminAction();
  const editDlg = useDialog<DepartmentRow>();
  const [deleteTarget, setDeleteTarget] = useState<DepartmentRow | null>(null);

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    const d = formJson(e);
    const input = { code: d.code, nameEn: d.nameEn, nameKn: d.nameKn, taluk: d.taluk, district: d.district };
    run(
      () =>
        editDlg.editing
          ? adminUpdateDepartmentAction(editDlg.editing.id, input)
          : adminCreateDepartmentAction(input),
      { onOk: editDlg.close, okMsg: editDlg.editing ? t.admin.saved : t.admin.created }
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{t.admin.departments}</CardTitle>
          <CardDescription>{t.admin.departmentsHint}</CardDescription>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => editDlg.openFor(null)}>
            <Plus className="h-4 w-4" />
            {t.admin.addDepartment}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-line">
          {departments.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <Building2 className="h-4 w-4 shrink-0 text-ink-3" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {lang === "kn" && d.nameKn ? d.nameKn : d.nameEn}
                    {!d.active && <Badge tone="rose" className="ml-2">{t.admin.inactive}</Badge>}
                  </p>
                  <p className="text-[11px] text-ink-3">
                    {d.code} · {d.taluk}, {d.district} · {d.memberCount} {t.admin.memberCount.toLowerCase()}
                  </p>
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="ghost" onClick={() => editDlg.openFor(d)} title={t.admin.edit}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title={d.active ? t.admin.deactivate : t.admin.activate}
                    onClick={() => run(() => adminSetDepartmentActiveAction(d.id, !d.active))}
                  >
                    <Power className={`h-3.5 w-3.5 ${d.active ? "text-rose" : "text-forest-600"}`} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title={t.admin.delete}
                    disabled={d.memberCount > 0}
                    onClick={() => setDeleteTarget(d)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </CardContent>

      <Dialog open={editDlg.open} onClose={editDlg.close} title={editDlg.editing ? t.admin.editDepartment : t.admin.addDepartment}>
        <form onSubmit={save} className="space-y-3">
          <div>
            <Label htmlFor="d-code" required>{t.admin.code}</Label>
            <Input id="d-code" name="code" required pattern="[A-Z0-9-]+" placeholder="TALUK-NAME"
              title={t.admin.codeHint} defaultValue={editDlg.editing?.code} disabled={!!editDlg.editing} />
          </div>
          <div>
            <Label htmlFor="d-nameEn" required>{t.admin.labelEn}</Label>
            <Input id="d-nameEn" name="nameEn" required defaultValue={editDlg.editing?.nameEn} />
          </div>
          <div>
            <Label htmlFor="d-nameKn">{t.admin.labelKn}</Label>
            <Input id="d-nameKn" name="nameKn" defaultValue={editDlg.editing?.nameKn ?? ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="d-taluk" required>{t.settings.taluk}</Label>
              <Input id="d-taluk" name="taluk" required defaultValue={editDlg.editing?.taluk} />
            </div>
            <div>
              <Label htmlFor="d-district" required>{t.settings.district}</Label>
              <Input id="d-district" name="district" required defaultValue={editDlg.editing?.district} />
            </div>
          </div>
          <DialogActions pending={pending} />
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t.admin.delete}
        body={t.admin.deleteConfirmDept}
        pending={pending}
        onConfirm={() =>
          run(() => adminDeleteDepartmentAction(deleteTarget!.id), { onOk: () => setDeleteTarget(null), okMsg: t.admin.deleted })
        }
      />
    </Card>
  );
}
