import { beforeAll, describe, expect, it } from "vitest";
import { setupTestDb } from "../helpers/testdb";
import { hasPermission } from "@/lib/permissions";

const svc = () => import("@/lib/services/admin");
const { PERMISSIONS } = await import("@/lib/constants");

let users: Awaited<ReturnType<typeof setupTestDb>>["users"];
let prisma: Awaited<ReturnType<typeof setupTestDb>>["prisma"];

beforeAll(async () => {
  const db = await setupTestDb();
  users = db.users;
  prisma = db.prisma;
});

describe("admin: users", () => {
  it("creates, updates and deactivates a member with audit", async () => {
    const { adminCreateUser, adminUpdateUser, adminSetUserActive } = await svc();
    const u = await adminCreateUser(users.admin, {
      email: "new@test.kar", name: "New Officer", roleId: "FIELD_OFFICER",
      departmentId: null, password: "secret1",
    });
    expect(u.id).toBeTruthy();

    await adminUpdateUser(users.admin, u.id, { name: "Renamed Officer", taluk: "Malur" });
    const after = await prisma.user.findUnique({ where: { id: u.id } });
    expect(after?.name).toBe("Renamed Officer");
    expect(after?.taluk).toBe("Malur");

    await adminSetUserActive(users.admin, u.id, false);
    expect((await prisma.user.findUnique({ where: { id: u.id } }))?.active).toBe(false);

    const actions = (await prisma.auditLog.findMany({ where: { entityId: u.id } })).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["USER_CREATED", "USER_UPDATED", "USER_DEACTIVATED"]));
  });

  it("forbids user management for non-admin roles", async () => {
    const { adminCreateUser } = await svc();
    await expect(
      adminCreateUser(users.inspector, { email: "x@t.kar", name: "X", roleId: "ADMIN", password: "123456" })
    ).rejects.toThrow();
  });

  it("refuses self-deactivation", async () => {
    const { adminSetUserActive } = await svc();
    await expect(adminSetUserActive(users.admin, users.admin.id, false)).rejects.toThrow();
  });
});

describe("admin: departments", () => {
  it("creates, updates, blocks delete while members attached", async () => {
    const { adminCreateDepartment, adminUpdateDepartment, adminDeleteDepartment, adminSetDepartmentActive } = await svc();
    const d = await adminCreateDepartment(users.admin, {
      code: "TALUK-TEST", nameEn: "Test Office", taluk: "T", district: "D",
    });
    await adminUpdateDepartment(users.admin, d.id, { nameEn: "Test Office 2" });
    expect((await prisma.department.findUnique({ where: { id: d.id } }))?.nameEn).toBe("Test Office 2");

    await prisma.user.update({ where: { id: users.field.id }, data: { departmentId: d.id } });
    await expect(adminDeleteDepartment(users.admin, d.id)).rejects.toThrow();
    await prisma.user.update({ where: { id: users.field.id }, data: { departmentId: null } });

    await adminSetDepartmentActive(users.admin, d.id, false);
    await adminDeleteDepartment(users.admin, d.id);
    expect(await prisma.department.findUnique({ where: { id: d.id } })).toBeNull();
  });
});

describe("admin: requirements + roles", () => {
  it("CRUDs document requirements", async () => {
    const { adminCreateRequirement, adminUpdateRequirement, adminDeleteRequirement } = await svc();
    const r = await adminCreateRequirement(users.admin, {
      documentType: "TEST_DOC", labelEn: "Test doc", labelKn: "Тест", required: false,
    });
    await adminUpdateRequirement(users.admin, r.id, { required: true, sortOrder: 5 });
    const saved = await prisma.documentRequirement.findUnique({ where: { id: r.id } });
    expect(saved?.required).toBe(true);
    await adminDeleteRequirement(users.admin, r.id);
    expect(await prisma.documentRequirement.findUnique({ where: { id: r.id } })).toBeNull();
  });

  it("overrides role permissions — DB set beats code defaults", async () => {
    const { adminSetRolePermissions } = await svc();
    await adminSetRolePermissions(users.admin, "FIELD_OFFICER", [PERMISSIONS.APP_VIEW_ASSIGNED]);
    const role = await prisma.role.findUnique({ where: { id: "FIELD_OFFICER" } });
    const user = { ...users.field, permissions: role!.permissions };
    expect(hasPermission(user, PERMISSIONS.APP_VIEW_ASSIGNED)).toBe(true);
    expect(hasPermission(user, PERMISSIONS.AI_USE)).toBe(false);
    // empty stored set → code defaults still apply
    expect(hasPermission(users.field, PERMISSIONS.AI_USE)).toBe(true);
  });
});

describe("admin: application edit", () => {
  it("updates applicant + application fields with audit", async () => {
    const { createApplication } = await import("@/lib/services/applications");
    const { adminUpdateApplication } = await svc();
    const { SAMPLE_APPLICATION } = await import("../helpers/testdb");
    const app = await createApplication(users.inspector, { ...SAMPLE_APPLICATION });
    await adminUpdateApplication(users.admin, app.id, {
      fullName: "Edited Name", declaredAnnualIncome: 555000, priority: "HIGH",
    });
    const after = await prisma.application.findUnique({ where: { id: app.id }, include: { applicant: true } });
    expect(after?.applicant.fullName).toBe("Edited Name");
    expect(after?.declaredAnnualIncome).toBe(555000);
    expect(after?.priority).toBe("HIGH");
    const actions = (await prisma.auditLog.findMany({ where: { applicationId: app.id } })).map((a) => a.action);
    expect(actions).toContain("APPLICATION_ADMIN_EDITED");
  });
});
