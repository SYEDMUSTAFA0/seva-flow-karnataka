import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getDict, getLanguage } from "@/i18n";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/permissions";
import { PERMISSIONS, ROLE_PERMISSIONS, type Permission, type RoleId } from "@/lib/constants";
import { UsersPanel, type UserRow } from "./users-panel";
import { DepartmentsPanel, type DepartmentRow } from "./departments-panel";
import { RequirementsPanel } from "./requirements-panel";
import { RolesPanel, type RoleRow } from "./roles-panel";
import { ApplicationsPanel, type AdminAppRow } from "./applications-panel";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const canManageUsers = hasPermission(user, PERMISSIONS.USERS_MANAGE);
  const canManageConfig = hasPermission(user, PERMISSIONS.CONFIG_MANAGE);
  const canEditApps = hasPermission(user, PERMISSIONS.APP_EDIT);
  if (!canManageUsers && !canManageConfig && !canEditApps) notFound();

  const lang = await getLanguage();
  const t = await getDict();

  const [users, roles, departments, requirements, applications, officers] = await Promise.all([
    prisma.user.findMany({
      include: { role: true, department: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.role.findMany({ orderBy: { id: "asc" } }),
    prisma.department.findMany({ orderBy: { code: "asc" }, include: { _count: { select: { users: true } } } }),
    prisma.documentRequirement.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.application.findMany({
      include: { applicant: true, assignedOfficer: { select: { id: true, name: true, nameKn: true } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    prisma.user.findMany({
      where: { active: true, roleId: { in: ["FIELD_OFFICER", "REVENUE_INSPECTOR"] } },
      select: { id: true, name: true, nameKn: true, roleId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const userRows: UserRow[] = users.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    nameKn: u.nameKn,
    phone: u.phone,
    roleId: u.roleId,
    roleName: lang === "kn" ? u.role.nameKn : u.role.nameEn,
    departmentId: u.departmentId,
    departmentName: u.department ? (lang === "kn" && u.department.nameKn ? u.department.nameKn : u.department.nameEn) : null,
    taluk: u.taluk,
    district: u.district,
    active: u.active,
  }));

  const roleRows: RoleRow[] = roles.map((r) => ({
    id: r.id,
    nameEn: r.nameEn,
    nameKn: r.nameKn,
    description: r.description,
    permissions: r.permissions.length ? r.permissions : (ROLE_PERMISSIONS[r.id as RoleId] ?? []),
  }));

  const deptRows: DepartmentRow[] = departments.map((d) => ({
    id: d.id,
    code: d.code,
    nameEn: d.nameEn,
    nameKn: d.nameKn,
    taluk: d.taluk,
    district: d.district,
    active: d.active,
    memberCount: d._count.users,
  }));

  const appRows: AdminAppRow[] = applications.map((a) => ({
    id: a.id,
    referenceNumber: a.referenceNumber,
    currentStage: a.currentStage,
    priority: a.priority,
    declaredAnnualIncome: a.declaredAnnualIncome,
    incomeSource: a.incomeSource,
    purpose: a.purpose,
    assignedOfficerId: a.assignedOfficerId,
    applicant: {
      fullName: a.applicant.fullName,
      fullNameKn: a.applicant.fullNameKn,
      fatherName: a.applicant.fatherName,
      phone: a.applicant.phone,
      addressLine1: a.applicant.addressLine1,
      village: a.applicant.village,
      taluk: a.applicant.taluk,
      district: a.applicant.district,
      pincode: a.applicant.pincode,
    },
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{t.admin.title}</h1>
        <p className="mt-0.5 text-sm text-ink-3">{t.admin.subtitle}</p>
      </div>

      <div className="space-y-5">
        <UsersPanel
          users={userRows}
          roles={roles.map((r) => ({ id: r.id, name: lang === "kn" ? r.nameKn : r.nameEn }))}
          departments={deptRows.map((d) => ({ id: d.id, name: lang === "kn" && d.nameKn ? d.nameKn : d.nameEn }))}
          selfId={user.id}
          canManage={canManageUsers}
        />
        <DepartmentsPanel departments={deptRows} canManage={canManageConfig} />
        <RequirementsPanel requirements={requirements} canManage={canManageConfig} />
        <RolesPanel
          roles={roleRows}
          allPermissions={Object.values(PERMISSIONS) as Permission[] as string[]}
          canManage={canManageConfig}
        />
        <ApplicationsPanel
          applications={appRows}
          officers={officers.map((o) => ({ id: o.id, name: lang === "kn" && o.nameKn ? o.nameKn : o.name }))}
          canEdit={canEditApps}
        />
      </div>
    </div>
  );
}
