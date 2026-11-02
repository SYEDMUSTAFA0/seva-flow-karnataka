"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import { adminUpdateApplicationAction } from "@/lib/actions/admin";
import { formJson, useAdminAction, useDialog, DialogActions } from "./shared";
import { INCOME_SOURCES, PRIORITIES, PURPOSES } from "@/lib/constants";

export interface AdminAppRow {
  id: string;
  referenceNumber: string;
  currentStage: string;
  priority: string;
  declaredAnnualIncome: number;
  incomeSource: string;
  purpose: string;
  assignedOfficerId: string | null;
  applicant: {
    fullName: string;
    fullNameKn: string | null;
    fatherName: string | null;
    phone: string;
    addressLine1: string;
    village: string;
    taluk: string;
    district: string;
    pincode: string;
  };
}

export function ApplicationsPanel({
  applications,
  officers,
  canEdit,
}: {
  applications: AdminAppRow[];
  officers: { id: string; name: string }[];
  canEdit: boolean;
}) {
  const { t } = useI18n();
  const { pending, run } = useAdminAction();
  const editDlg = useDialog<AdminAppRow>();

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    const d = formJson(e);
    run(
      () =>
        adminUpdateApplicationAction(editDlg.editing!.id, {
          fullName: d.fullName,
          fullNameKn: d.fullNameKn,
          fatherName: d.fatherName,
          phone: d.phone,
          addressLine1: d.addressLine1,
          village: d.village,
          taluk: d.taluk,
          district: d.district,
          pincode: d.pincode,
          declaredAnnualIncome: d.declaredAnnualIncome ? Number(d.declaredAnnualIncome) : undefined,
          incomeSource: d.incomeSource,
          purpose: d.purpose,
          priority: d.priority,
          assignedOfficerId: d.assignedOfficerId || null,
        }),
      { onOk: editDlg.close }
    );
  };

  const a = editDlg.editing?.applicant;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.admin.applications}</CardTitle>
        <CardDescription>{t.admin.applicationsHint}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-line">
          {applications.map((app) => (
            <li key={app.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <div className="min-w-0">
                <Link href={`/applications/${app.id}`} className="text-sm font-medium text-navy-700 hover:underline">
                  {app.referenceNumber}
                </Link>
                <p className="truncate text-[11px] text-ink-3">
                  {app.applicant.fullName} · {app.applicant.village}, {app.applicant.taluk}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge tone="neutral">{(t.stage as Record<string, string>)[app.currentStage] ?? app.currentStage}</Badge>
                {canEdit && (
                  <Button size="sm" variant="ghost" onClick={() => editDlg.openFor(app)} title={t.admin.edit}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      <Dialog open={editDlg.open} onClose={editDlg.close} title={`${t.admin.editApplication} — ${editDlg.editing?.referenceNumber ?? ""}`} wide>
        <form onSubmit={save}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-3">{t.admin.applicantDetails}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ap-fullName" required>{t.common.name}</Label>
              <Input id="ap-fullName" name="fullName" required defaultValue={a?.fullName} />
            </div>
            <div>
              <Label htmlFor="ap-fullNameKn">Name (Kannada)</Label>
              <Input id="ap-fullNameKn" name="fullNameKn" defaultValue={a?.fullNameKn ?? ""} />
            </div>
            <div>
              <Label htmlFor="ap-fatherName">{t.admin.fatherName}</Label>
              <Input id="ap-fatherName" name="fatherName" defaultValue={a?.fatherName ?? ""} />
            </div>
            <div>
              <Label htmlFor="ap-phone" required>{t.common.phone}</Label>
              <Input id="ap-phone" name="phone" required pattern="[0-9]{10,15}" defaultValue={a?.phone} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ap-address" required>{t.common.address}</Label>
              <Input id="ap-address" name="addressLine1" required defaultValue={a?.addressLine1} />
            </div>
            <div>
              <Label htmlFor="ap-village" required>{t.admin.village}</Label>
              <Input id="ap-village" name="village" required defaultValue={a?.village} />
            </div>
            <div>
              <Label htmlFor="ap-taluk" required>{t.settings.taluk}</Label>
              <Input id="ap-taluk" name="taluk" required defaultValue={a?.taluk} />
            </div>
            <div>
              <Label htmlFor="ap-district" required>{t.settings.district}</Label>
              <Input id="ap-district" name="district" required defaultValue={a?.district} />
            </div>
            <div>
              <Label htmlFor="ap-pincode" required>{t.admin.pincode}</Label>
              <Input id="ap-pincode" name="pincode" required pattern="\d{6}" defaultValue={a?.pincode} />
            </div>
          </div>

          <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-ink-3">{t.admin.applicationDetails}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="ap-income">{t.admin.declaredIncome}</Label>
              <Input id="ap-income" name="declaredAnnualIncome" type="number" min={0} defaultValue={editDlg.editing?.declaredAnnualIncome} />
            </div>
            <div>
              <Label htmlFor="ap-source">{t.admin.incomeSource}</Label>
              <Select id="ap-source" name="incomeSource" defaultValue={editDlg.editing?.incomeSource}>
                {Object.values(INCOME_SOURCES).map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="ap-purpose">{t.admin.purpose}</Label>
              <Select id="ap-purpose" name="purpose" defaultValue={editDlg.editing?.purpose}>
                {Object.values(PURPOSES).map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="ap-priority">{t.admin.priority}</Label>
              <Select id="ap-priority" name="priority" defaultValue={editDlg.editing?.priority}>
                {Object.values(PRIORITIES).map((p) => <option key={p} value={p}>{p}</option>)}
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="ap-officer">{t.admin.assignedOfficer}</Label>
              <Select id="ap-officer" name="assignedOfficerId" defaultValue={editDlg.editing?.assignedOfficerId ?? ""}>
                <option value="">{t.admin.unassigned}</option>
                {officers.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </div>
          </div>
          <DialogActions pending={pending} />
        </form>
      </Dialog>
    </Card>
  );
}
