"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, AuthError } from "@/lib/auth";
import { dictFor, getLanguage } from "@/i18n";
import * as svc from "@/lib/services/admin";
import type { ActionResult } from "./applications";

async function guard<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  const lang = await getLanguage();
  const t = dictFor(lang);
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AuthError)
      return { ok: false, error: e.message && e.message !== e.code ? e.message : e.code === "FORBIDDEN" ? t.errors.forbidden : t.errors.unauthenticated };
    console.error(e);
    return { ok: false, error: t.errors.generic };
  }
}

function refresh() {
  revalidatePath("/admin");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

// ─── Users ──────────────────────────────────────────────────────────────────

const userSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().min(2).max(120),
  nameKn: z.string().max(120).optional(),
  phone: z.string().max(20).optional(),
  roleId: z.string().min(1),
  departmentId: z.string().nullable().optional(),
  taluk: z.string().max(80).optional(),
  district: z.string().max(80).optional(),
  password: z.string().min(6).max(100).optional(),
});

export async function adminCreateUserAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = userSchema.extend({ password: z.string().min(6).max(100) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid user data" };
  const res = await guard(() => svc.adminCreateUser(user, parsed.data));
  if (res.ok) refresh();
  return res;
}

export async function adminUpdateUserAction(userId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = userSchema.partial().safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid user data" };
  const res = await guard(() => svc.adminUpdateUser(user, userId, parsed.data));
  if (res.ok) refresh();
  return res;
}

export async function adminSetUserActiveAction(userId: string, active: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const res = await guard(() => svc.adminSetUserActive(user, userId, active));
  if (res.ok) refresh();
  return res;
}

export async function adminResetPasswordAction(userId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.object({ password: z.string().min(6).max(100) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Password must be at least 6 characters" };
  const res = await guard(() => svc.adminResetPassword(user, userId, parsed.data.password));
  if (res.ok) refresh();
  return res;
}

// ─── Departments ────────────────────────────────────────────────────────────

const deptSchema = z.object({
  code: z.string().min(3).max(40).regex(/^[A-Z0-9-]+$/, "Uppercase code"),
  nameEn: z.string().min(3).max(140),
  nameKn: z.string().max(140).optional(),
  taluk: z.string().min(1).max(80),
  district: z.string().min(1).max(80),
});

export async function adminCreateDepartmentAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = deptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid department data" };
  const res = await guard(() => svc.adminCreateDepartment(user, parsed.data));
  if (res.ok) refresh();
  return res;
}

export async function adminUpdateDepartmentAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = deptSchema.partial().safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid department data" };
  const res = await guard(() => svc.adminUpdateDepartment(user, id, parsed.data));
  if (res.ok) refresh();
  return res;
}

export async function adminSetDepartmentActiveAction(id: string, active: boolean): Promise<ActionResult> {
  const user = await requireUser();
  const res = await guard(() => svc.adminSetDepartmentActive(user, id, active));
  if (res.ok) refresh();
  return res;
}

export async function adminDeleteDepartmentAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const res = await guard(() => svc.adminDeleteDepartment(user, id));
  if (res.ok) refresh();
  return res;
}

// ─── Document requirements ─────────────────────────────────────────────────

const reqSchema = z.object({
  documentType: z.string().min(2).max(60).regex(/^[A-Z0-9_]+$/, "Uppercase type"),
  labelEn: z.string().min(2).max(140),
  labelKn: z.string().min(2).max(140),
  required: z.boolean(),
  alternativeOf: z.string().max(60).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

export async function adminCreateRequirementAction(input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = reqSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid requirement data" };
  const res = await guard(() => svc.adminCreateRequirement(user, parsed.data));
  if (res.ok) refresh();
  return res;
}

export async function adminUpdateRequirementAction(id: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = reqSchema.partial().extend({ active: z.boolean().optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid requirement data" };
  const res = await guard(() => svc.adminUpdateRequirement(user, id, parsed.data));
  if (res.ok) refresh();
  return res;
}

export async function adminDeleteRequirementAction(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const res = await guard(() => svc.adminDeleteRequirement(user, id));
  if (res.ok) refresh();
  return res;
}

// ─── Roles & permissions ────────────────────────────────────────────────────

export async function adminUpdateRoleAction(roleId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.object({
    nameEn: z.string().min(2).max(80).optional(),
    nameKn: z.string().min(2).max(80).optional(),
    description: z.string().max(300).optional(),
  }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid role data" };
  const res = await guard(() => svc.adminUpdateRole(user, roleId, parsed.data));
  if (res.ok) refresh();
  return res;
}

export async function adminSetRolePermissionsAction(roleId: string, permissions: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.array(z.string().max(60)).max(50).safeParse(permissions);
  if (!parsed.success) return { ok: false, error: "Invalid permission set" };
  const res = await guard(() => svc.adminSetRolePermissions(user, roleId, parsed.data));
  if (res.ok) refresh();
  return res;
}

// ─── Application admin edit ─────────────────────────────────────────────────

const appEditSchema = z.object({
  fullName: z.string().min(2).max(120).optional(),
  fullNameKn: z.string().max(120).optional(),
  fatherName: z.string().max(120).optional(),
  phone: z.string().min(10).max(15).optional(),
  addressLine1: z.string().max(200).optional(),
  village: z.string().max(80).optional(),
  taluk: z.string().max(80).optional(),
  district: z.string().max(80).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional(),
  declaredAnnualIncome: z.number().int().min(0).max(100_000_000).optional(),
  incomeSource: z.enum(["SALARIED", "SELF_EMPLOYED", "AGRICULTURE", "DAILY_WAGE", "PENSION", "OTHER"]).optional(),
  purpose: z.enum(["SCHOLARSHIP", "FEE_CONCESSION", "GOVT_SCHEME", "EWS_RESERVATION", "OTHER"]).optional(),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).optional(),
  assignedOfficerId: z.string().nullable().optional(),
});

export async function adminUpdateApplicationAction(applicationId: string, input: unknown): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = appEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid application data" };
  const res = await guard(() => svc.adminUpdateApplication(user, applicationId, parsed.data));
  if (res.ok) {
    refresh();
    revalidatePath(`/applications/${applicationId}`);
  }
  return res;
}
