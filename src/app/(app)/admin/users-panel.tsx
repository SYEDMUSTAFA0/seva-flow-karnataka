"use client";

import { useState } from "react";
import { KeyRound, Pencil, Plus, UserX, UserCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/input";
import { useI18n } from "@/i18n/client";
import {
  adminCreateUserAction,
  adminResetPasswordAction,
  adminSetUserActiveAction,
  adminUpdateUserAction,
} from "@/lib/actions/admin";
import { formJson, useAdminAction, useDialog, ConfirmDialog, DialogActions } from "./shared";

export interface UserRow {
  id: string;
  email: string;
  name: string;
  nameKn: string | null;
  phone: string | null;
  roleId: string;
  roleName: string;
  departmentId: string | null;
  departmentName: string | null;
  taluk: string | null;
  district: string | null;
  active: boolean;
}

export function UsersPanel({
  users,
  roles,
  departments,
  selfId,
  canManage,
}: {
  users: UserRow[];
  roles: { id: string; name: string }[];
  departments: { id: string; name: string }[];
  selfId: string;
  canManage: boolean;
}) {
  const { lang, t } = useI18n();
  const { pending, run } = useAdminAction();
  const editDlg = useDialog<UserRow>();
  const pwDlg = useDialog<UserRow>();
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null);

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    const d = formJson(e);
    const input = {
      email: d.email,
      name: d.name,
      nameKn: d.nameKn,
      phone: d.phone,
      roleId: d.roleId,
      departmentId: d.departmentId || null,
      taluk: d.taluk,
      district: d.district,
      ...(d.password && { password: d.password }),
    };
    run(
      () => (editDlg.editing ? adminUpdateUserAction(editDlg.editing.id, input) : adminCreateUserAction(input)),
      { onOk: editDlg.close, okMsg: editDlg.editing ? t.admin.saved : t.admin.created }
    );
  };

  const resetPw = (e: React.FormEvent<HTMLFormElement>) => {
    const d = formJson(e);
    run(() => adminResetPasswordAction(pwDlg.editing!.id, { password: d.password }), { onOk: pwDlg.close });
  };

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>{t.admin.members}</CardTitle>
          <CardDescription>{t.admin.membersHint}</CardDescription>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => editDlg.openFor(null)}>
            <Plus className="h-4 w-4" />
            {t.admin.addMember}
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">
                  {lang === "kn" && u.nameKn ? u.nameKn : u.name}
                  {!u.active && <Badge tone="rose" className="ml-2">{t.admin.inactive}</Badge>}
                </p>
                <p className="truncate text-[11px] text-ink-3">
                  {u.email}
                  {u.taluk ? ` · ${u.taluk}` : ""}
                  {u.departmentName ? ` · ${u.departmentName}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge tone="navy">{u.roleName}</Badge>
                {canManage && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => editDlg.openFor(u)} title={t.admin.edit}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => pwDlg.openFor(u)} title={t.admin.resetPassword}>
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={u.id === selfId}
                      title={u.active ? t.admin.deactivate : t.admin.activate}
                      onClick={() => (u.active ? setDeactivateTarget(u) : run(() => adminSetUserActiveAction(u.id, true)))}
                    >
                      {u.active ? <UserX className="h-3.5 w-3.5 text-rose" /> : <UserCheck className="h-3.5 w-3.5 text-forest-600" />}
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>

      {/* Create / edit member */}
      <Dialog
        open={editDlg.open}
        onClose={editDlg.close}
        title={editDlg.editing ? t.admin.editMember : t.admin.addMember}
        wide
      >
        <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="u-name" required>{t.common.name}</Label>
            <Input id="u-name" name="name" required defaultValue={editDlg.editing?.name} />
          </div>
          <div>
            <Label htmlFor="u-nameKn">Name (Kannada)</Label>
            <Input id="u-nameKn" name="nameKn" defaultValue={editDlg.editing?.nameKn ?? ""} />
          </div>
          <div>
            <Label htmlFor="u-email" required>{t.auth.email}</Label>
            <Input id="u-email" name="email" type="email" required defaultValue={editDlg.editing?.email} disabled={!!editDlg.editing} />
          </div>
          <div>
            <Label htmlFor="u-phone">{t.common.phone}</Label>
            <Input id="u-phone" name="phone" defaultValue={editDlg.editing?.phone ?? ""} />
          </div>
          <div>
            <Label htmlFor="u-role" required>{t.settings.role}</Label>
            <Select id="u-role" name="roleId" required defaultValue={editDlg.editing?.roleId}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="u-dept">{t.admin.department}</Label>
            <Select id="u-dept" name="departmentId" defaultValue={editDlg.editing?.departmentId ?? ""}>
              <option value="">{t.admin.noDepartment}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="u-taluk">{t.settings.taluk}</Label>
            <Input id="u-taluk" name="taluk" defaultValue={editDlg.editing?.taluk ?? ""} />
          </div>
          <div>
            <Label htmlFor="u-district">{t.settings.district}</Label>
            <Input id="u-district" name="district" defaultValue={editDlg.editing?.district ?? ""} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="u-password" required={!editDlg.editing}>
              {editDlg.editing ? `${t.admin.newPassword} (${t.admin.none} = keep)` : t.auth.password}
            </Label>
            <Input id="u-password" name="password" type="password" minLength={6} required={!editDlg.editing} autoComplete="new-password" />
          </div>
          <div className="sm:col-span-2"><DialogActions pending={pending} /></div>
        </form>
      </Dialog>

      {/* Reset password */}
      <Dialog open={pwDlg.open} onClose={pwDlg.close} title={t.admin.resetPassword}>
        <form onSubmit={resetPw} className="space-y-3">
          <p className="text-sm text-ink-3">{pwDlg.editing?.email}</p>
          <div>
            <Label htmlFor="pw-new" required>{t.admin.newPassword}</Label>
            <Input id="pw-new" name="password" type="password" minLength={6} required autoComplete="new-password" />
          </div>
          <DialogActions pending={pending} />
        </form>
      </Dialog>

      {/* Deactivate confirm */}
      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        title={t.admin.deactivate}
        body={t.admin.deactivateConfirm}
        pending={pending}
        onConfirm={() =>
          run(() => adminSetUserActiveAction(deactivateTarget!.id, false), { onOk: () => setDeactivateTarget(null) })
        }
      />
    </Card>
  );
}
