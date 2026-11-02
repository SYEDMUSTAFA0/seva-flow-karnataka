import "server-only";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { AuthError } from "@/lib/auth";
import { hasPermission, type AuthUser } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { PERMISSIONS } from "@/lib/constants";
import type { Prisma } from "@prisma/client";

function forbidden(): never {
  throw new AuthError("FORBIDDEN");
}

// ─── Users ──────────────────────────────────────────────────────────────────

export interface UserInput {
  email: string;
  name: string;
  nameKn?: string;
  phone?: string;
  roleId: string;
  departmentId?: string | null;
  taluk?: string;
  district?: string;
  password?: string; // required on create, optional on update (blank = keep)
}

export async function adminCreateUser(actor: AuthUser, input: UserInput) {
  if (!hasPermission(actor, PERMISSIONS.USERS_MANAGE)) forbidden();
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new AuthError("FORBIDDEN", "A user with this email already exists");
  const role = await prisma.role.findUnique({ where: { id: input.roleId } });
  if (!role) throw new AuthError("FORBIDDEN", "Unknown role");

  const user = await prisma.user.create({
    data: {
      email: input.email,
      name: input.name,
      nameKn: input.nameKn || null,
      phone: input.phone || null,
      roleId: input.roleId,
      departmentId: input.departmentId || null,
      taluk: input.taluk || null,
      district: input.district || null,
      passwordHash: await hashPassword(input.password!),
    },
  });
  await logAudit({ actorId: actor.id, action: "USER_CREATED", entityType: "User", entityId: user.id, remarks: `${input.email} (${input.roleId})` });
  return user;
}

export async function adminUpdateUser(actor: AuthUser, userId: string, input: Partial<UserInput>) {
  if (!hasPermission(actor, PERMISSIONS.USERS_MANAGE)) forbidden();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) throw new AuthError("FORBIDDEN", "User not found");
  if (input.roleId) {
    const role = await prisma.role.findUnique({ where: { id: input.roleId } });
    if (!role) throw new AuthError("FORBIDDEN", "Unknown role");
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.nameKn !== undefined && { nameKn: input.nameKn || null }),
      ...(input.phone !== undefined && { phone: input.phone || null }),
      ...(input.roleId && { roleId: input.roleId }),
      ...(input.departmentId !== undefined && { departmentId: input.departmentId || null }),
      ...(input.taluk !== undefined && { taluk: input.taluk || null }),
      ...(input.district !== undefined && { district: input.district || null }),
    },
  });
  await logAudit({ actorId: actor.id, action: "USER_UPDATED", entityType: "User", entityId: userId, remarks: target.email });
  return user;
}

export async function adminSetUserActive(actor: AuthUser, userId: string, active: boolean) {
  if (!hasPermission(actor, PERMISSIONS.USERS_MANAGE)) forbidden();
  if (userId === actor.id && !active) {
    throw new AuthError("FORBIDDEN", "You cannot deactivate your own account");
  }
  await prisma.user.update({ where: { id: userId }, data: { active } });
  if (!active) await prisma.session.deleteMany({ where: { userId } }); // revoke sessions
  await logAudit({ actorId: actor.id, action: active ? "USER_ACTIVATED" : "USER_DEACTIVATED", entityType: "User", entityId: userId });
}

export async function adminResetPassword(actor: AuthUser, userId: string, newPassword: string) {
  if (!hasPermission(actor, PERMISSIONS.USERS_MANAGE)) forbidden();
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await prisma.session.deleteMany({ where: { userId } }); // force re-login
  await logAudit({ actorId: actor.id, action: "USER_PASSWORD_RESET", entityType: "User", entityId: userId });
}

// ─── Departments ────────────────────────────────────────────────────────────

export interface DepartmentInput {
  code: string;
  nameEn: string;
  nameKn?: string;
  taluk: string;
  district: string;
}

export async function adminCreateDepartment(actor: AuthUser, input: DepartmentInput) {
  if (!hasPermission(actor, PERMISSIONS.CONFIG_MANAGE)) forbidden();
  const dept = await prisma.department.create({
    data: { ...input, nameKn: input.nameKn || null },
  });
  await logAudit({ actorId: actor.id, action: "DEPARTMENT_CREATED", entityType: "Department", entityId: dept.id, remarks: input.code });
  return dept;
}

export async function adminUpdateDepartment(actor: AuthUser, id: string, input: Partial<DepartmentInput>) {
  if (!hasPermission(actor, PERMISSIONS.CONFIG_MANAGE)) forbidden();
  const dept = await prisma.department.update({
    where: { id },
    data: {
      ...(input.nameEn !== undefined && { nameEn: input.nameEn }),
      ...(input.nameKn !== undefined && { nameKn: input.nameKn || null }),
      ...(input.taluk !== undefined && { taluk: input.taluk }),
      ...(input.district !== undefined && { district: input.district }),
    },
  });
  await logAudit({ actorId: actor.id, action: "DEPARTMENT_UPDATED", entityType: "Department", entityId: id, remarks: dept.code });
  return dept;
}

export async function adminSetDepartmentActive(actor: AuthUser, id: string, active: boolean) {
  if (!hasPermission(actor, PERMISSIONS.CONFIG_MANAGE)) forbidden();
  await prisma.department.update({ where: { id }, data: { active } });
  await logAudit({ actorId: actor.id, action: active ? "DEPARTMENT_ACTIVATED" : "DEPARTMENT_DEACTIVATED", entityType: "Department", entityId: id });
}

/** Hard delete only when no users are attached; otherwise must be deactivated. */
export async function adminDeleteDepartment(actor: AuthUser, id: string) {
  if (!hasPermission(actor, PERMISSIONS.CONFIG_MANAGE)) forbidden();
  const count = await prisma.user.count({ where: { departmentId: id } });
  if (count > 0) {
    throw new AuthError("FORBIDDEN", `${count} user(s) still belong to this department — deactivate it instead`);
  }
  await prisma.department.delete({ where: { id } });
  await logAudit({ actorId: actor.id, action: "DEPARTMENT_DELETED", entityType: "Department", entityId: id });
}

// ─── Document requirements ─────────────────────────────────────────────────

export interface RequirementInput {
  documentType: string;
  labelEn: string;
  labelKn: string;
  required: boolean;
  alternativeOf?: string;
  sortOrder?: number;
}

export async function adminCreateRequirement(actor: AuthUser, input: RequirementInput) {
  if (!hasPermission(actor, PERMISSIONS.CONFIG_MANAGE)) forbidden();
  const req = await prisma.documentRequirement.create({
    data: { ...input, alternativeOf: input.alternativeOf || null, sortOrder: input.sortOrder ?? 99 },
  });
  await logAudit({ actorId: actor.id, action: "REQUIREMENT_CREATED", entityType: "DocumentRequirement", entityId: req.id, remarks: input.documentType });
  return req;
}

export async function adminUpdateRequirement(actor: AuthUser, id: string, input: Partial<RequirementInput> & { active?: boolean }) {
  if (!hasPermission(actor, PERMISSIONS.CONFIG_MANAGE)) forbidden();
  const req = await prisma.documentRequirement.update({
    where: { id },
    data: {
      ...(input.documentType !== undefined && { documentType: input.documentType }),
      ...(input.labelEn !== undefined && { labelEn: input.labelEn }),
      ...(input.labelKn !== undefined && { labelKn: input.labelKn }),
      ...(input.required !== undefined && { required: input.required }),
      ...(input.alternativeOf !== undefined && { alternativeOf: input.alternativeOf || null }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.active !== undefined && { active: input.active }),
    },
  });
  await logAudit({ actorId: actor.id, action: "REQUIREMENT_UPDATED", entityType: "DocumentRequirement", entityId: id, remarks: req.documentType });
  return req;
}

export async function adminDeleteRequirement(actor: AuthUser, id: string) {
  if (!hasPermission(actor, PERMISSIONS.CONFIG_MANAGE)) forbidden();
  await prisma.documentRequirement.delete({ where: { id } });
  await logAudit({ actorId: actor.id, action: "REQUIREMENT_DELETED", entityType: "DocumentRequirement", entityId: id });
}

// ─── Roles & permissions ────────────────────────────────────────────────────

export async function adminUpdateRole(actor: AuthUser, roleId: string, input: { nameEn?: string; nameKn?: string; description?: string }) {
  if (!hasPermission(actor, PERMISSIONS.CONFIG_MANAGE)) forbidden();
  const role = await prisma.role.update({
    where: { id: roleId },
    data: {
      ...(input.nameEn !== undefined && { nameEn: input.nameEn }),
      ...(input.nameKn !== undefined && { nameKn: input.nameKn }),
      ...(input.description !== undefined && { description: input.description || null }),
    },
  });
  await logAudit({ actorId: actor.id, action: "ROLE_UPDATED", entityType: "Role", entityId: roleId });
  return role;
}

const ALL_PERMISSIONS = new Set<string>(Object.values(PERMISSIONS));

/**
 * Replace a role's permission set. An empty set means "use code defaults"
 * (ROLE_PERMISSIONS) — the UI sends the visible set, never truly empty.
 */
export async function adminSetRolePermissions(actor: AuthUser, roleId: string, permissions: string[]) {
  if (!hasPermission(actor, PERMISSIONS.CONFIG_MANAGE)) forbidden();
  const clean = [...new Set(permissions)].filter((p) => ALL_PERMISSIONS.has(p));
  await prisma.role.update({ where: { id: roleId }, data: { permissions: clean } });
  await logAudit({
    actorId: actor.id,
    action: "ROLE_PERMISSIONS_UPDATED",
    entityType: "Role",
    entityId: roleId,
    metadata: { permissions: clean },
  });
}

// ─── Application admin edit ─────────────────────────────────────────────────

export interface AdminApplicationEdit {
  fullName?: string;
  fullNameKn?: string;
  fatherName?: string;
  phone?: string;
  addressLine1?: string;
  village?: string;
  taluk?: string;
  district?: string;
  pincode?: string;
  declaredAnnualIncome?: number;
  incomeSource?: string;
  purpose?: string;
  priority?: string;
  assignedOfficerId?: string | null;
}

export async function adminUpdateApplication(actor: AuthUser, applicationId: string, input: AdminApplicationEdit) {
  if (!hasPermission(actor, PERMISSIONS.APP_EDIT)) forbidden();
  const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { applicant: true } });
  if (!app) throw new AuthError("FORBIDDEN", "Application not found");
  if (input.assignedOfficerId) {
    const officer = await prisma.user.findUnique({ where: { id: input.assignedOfficerId } });
    if (!officer) throw new AuthError("FORBIDDEN", "Assignee not found");
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.application.update({
      where: { id: applicationId },
      data: {
        ...(input.declaredAnnualIncome !== undefined && { declaredAnnualIncome: input.declaredAnnualIncome }),
        ...(input.incomeSource && { incomeSource: input.incomeSource }),
        ...(input.purpose && { purpose: input.purpose }),
        ...(input.priority && { priority: input.priority }),
        ...(input.assignedOfficerId !== undefined && { assignedOfficerId: input.assignedOfficerId || null }),
      },
    });
    await tx.applicant.update({
      where: { id: app.applicantId },
      data: {
        ...(input.fullName !== undefined && { fullName: input.fullName }),
        ...(input.fullNameKn !== undefined && { fullNameKn: input.fullNameKn || null }),
        ...(input.fatherName !== undefined && { fatherName: input.fatherName || null }),
        ...(input.phone !== undefined && { phone: input.phone }),
        ...(input.addressLine1 !== undefined && { addressLine1: input.addressLine1 }),
        ...(input.village !== undefined && { village: input.village }),
        ...(input.taluk !== undefined && { taluk: input.taluk }),
        ...(input.district !== undefined && { district: input.district }),
        ...(input.pincode !== undefined && { pincode: input.pincode }),
      },
    });
    await logAudit(
      { applicationId, actorId: actor.id, action: "APPLICATION_ADMIN_EDITED", entityType: "Application", entityId: applicationId, remarks: app.referenceNumber },
      tx
    );
  });
}
