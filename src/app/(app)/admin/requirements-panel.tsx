"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import {
  adminCreateRequirementAction,
  adminDeleteRequirementAction,
  adminUpdateRequirementAction,
} from "@/lib/actions/admin";
import { formJson, useAdminAction, useDialog, ConfirmDialog, DialogActions } from "./shared";

export interface RequirementRow {
  id: string;
  documentType: string;
  labelEn: string;
  labelKn: string;
  required: boolean;
  alternativeOf: string | null;
  sortOrder: number;
  active: boolean;
}

export function RequirementsPanel({ requirements, canManage }: { requirements: RequirementRow[]; canManage: boolean }) {
  const { lang, t } = useI18n();
  const { pending, run } = useAdminAction();
  const editDlg = useDialog<RequirementRow>();
  const [deleteTarget, setDeleteTarget] = useState<RequirementRow | null>(null);

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    const d = formJson(e);
    const input = {
      documentType: d.documentType,
      labelEn: d.labelEn,
      labelKn: d.labelKn,
      required: (e.currentTarget.elements.namedItem("required") as HTMLInputElement)?.checked ?? false,
      alternativeOf: d.alternativeOf,
      sortOrder: d.sortOrder ? Number(d.sortOrder) : undefined,
    };
    run(
      () =>
        editDlg.editing
          ? adminUpdateRequirementAction(editDlg.editing.id, input)
          : adminCreateRequirementAction(input),
      { onOk: editDlg.close, okMsg: editDlg.editing ? t.admin.saved : t.admin.created }
    );
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{t.admin.checklist}</CardTitle>
          <CardDescription>{t.admin.checklistHint}</CardDescription>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => editDlg.openFor(null)}>
            <Plus className="h-4 w-4" />
            {t.admin.addRequirement}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-line">
          {requirements.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {lang === "kn" ? r.labelKn : r.labelEn}
                  {!r.active && <Badge tone="rose" className="ml-2">{t.admin.inactive}</Badge>}
                </p>
                <p className="text-[11px] text-ink-3">
                  {r.documentType}
                  {r.alternativeOf && ` · ${t.admin.alternativeOf}: ${r.alternativeOf}`}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge tone={r.required ? "saffron" : "neutral"}>{r.required ? t.settings.requiredDoc : t.settings.optionalDoc}</Badge>
                {canManage && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => editDlg.openFor(r)} title={t.admin.edit}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(r)} title={t.admin.delete}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      <Dialog open={editDlg.open} onClose={editDlg.close} title={editDlg.editing ? t.admin.editRequirement : t.admin.addRequirement}>
        <form onSubmit={save} className="space-y-3">
          <div>
            <Label htmlFor="r-type" required>{t.admin.docType}</Label>
            <Input id="r-type" name="documentType" required pattern="[A-Z0-9_]+" title={t.admin.docTypeHint}
              defaultValue={editDlg.editing?.documentType} disabled={!!editDlg.editing} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="r-labelEn" required>{t.admin.labelEn}</Label>
              <Input id="r-labelEn" name="labelEn" required defaultValue={editDlg.editing?.labelEn} />
            </div>
            <div>
              <Label htmlFor="r-labelKn" required>{t.admin.labelKn}</Label>
              <Input id="r-labelKn" name="labelKn" required defaultValue={editDlg.editing?.labelKn} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="r-alt">{t.admin.alternativeOf}</Label>
              <Input id="r-alt" name="alternativeOf" title={t.admin.alternativeOfHint} defaultValue={editDlg.editing?.alternativeOf ?? ""} />
            </div>
            <div>
              <Label htmlFor="r-sort">{t.admin.sortOrder}</Label>
              <Input id="r-sort" name="sortOrder" type="number" min={0} defaultValue={editDlg.editing?.sortOrder ?? 99} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink-2">
            <input type="checkbox" name="required" defaultChecked={editDlg.editing?.required ?? true} className="h-4 w-4 accent-navy-700" />
            {t.settings.requiredDoc}
          </label>
          <DialogActions pending={pending} />
        </form>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t.admin.delete}
        body={t.admin.deleteConfirmReq}
        pending={pending}
        onConfirm={() =>
          run(() => adminDeleteRequirementAction(deleteTarget!.id), { onOk: () => setDeleteTarget(null), okMsg: t.admin.deleted })
        }
      />
    </Card>
  );
}
