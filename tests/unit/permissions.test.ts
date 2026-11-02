import { describe, expect, it } from "vitest";
import {
  allowedTransitions,
  canDecide,
  canFieldVerify,
  canTransition,
  canViewApplication,
  hasPermission,
  type AuthUser,
} from "@/lib/permissions";
import { PERMISSIONS, STAGES } from "@/lib/constants";

function user(roleId: AuthUser["roleId"], id = "u1"): AuthUser {
  return {
    id,
    email: `${roleId.toLowerCase()}@test.kar`,
    name: roleId,
    nameKn: null,
    roleId,
    roleNameEn: roleId,
    roleNameKn: roleId,
    taluk: "Kanakapura",
    district: "Ramanagara",
  };
}

const field = user("FIELD_OFFICER", "fo-1");
const inspector = user("REVENUE_INSPECTOR", "ri-1");
const approver = user("APPROVING_OFFICER", "ao-1");
const admin = user("ADMIN", "ad-1");

describe("hasPermission", () => {
  it("rejects null/undefined users", () => {
    expect(hasPermission(null, PERMISSIONS.DECIDE)).toBe(false);
    expect(hasPermission(undefined, PERMISSIONS.DECIDE)).toBe(false);
  });

  it("grants role-scoped permissions", () => {
    expect(hasPermission(field, PERMISSIONS.FIELD_VERIFY)).toBe(true);
    expect(hasPermission(field, PERMISSIONS.DECIDE)).toBe(false);
    expect(hasPermission(inspector, PERMISSIONS.DOC_VERIFY)).toBe(true);
    expect(hasPermission(inspector, PERMISSIONS.DECIDE)).toBe(false);
    expect(hasPermission(approver, PERMISSIONS.DECIDE)).toBe(true);
    expect(hasPermission(approver, PERMISSIONS.AUDIT_VIEW_ALL)).toBe(true);
    expect(hasPermission(admin, PERMISSIONS.USERS_MANAGE)).toBe(true);
    expect(hasPermission(admin, PERMISSIONS.DECIDE)).toBe(false);
  });
});

describe("canTransition / allowedTransitions", () => {
  it("inspector can move RECEIVED → DOCUMENT_SCRUTINY", () => {
    expect(canTransition(inspector, STAGES.RECEIVED, STAGES.DOCUMENT_SCRUTINY)).toBe(true);
  });

  it("field officer cannot move RECEIVED → DOCUMENT_SCRUTINY", () => {
    expect(canTransition(field, STAGES.RECEIVED, STAGES.DOCUMENT_SCRUTINY)).toBe(false);
  });

  it("stage advancement is reserved for officers with stage:advance", () => {
    // field officers move applications via submitFieldVerification instead
    expect(canTransition(field, STAGES.FIELD_VERIFICATION, STAGES.OFFICER_RECOMMENDATION)).toBe(false);
    expect(canTransition(inspector, STAGES.FIELD_VERIFICATION, STAGES.OFFICER_RECOMMENDATION)).toBe(true);
  });

  it("only approving officer can decide", () => {
    expect(canTransition(approver, STAGES.FINAL_DECISION, STAGES.APPROVED)).toBe(true);
    expect(canTransition(inspector, STAGES.FINAL_DECISION, STAGES.APPROVED)).toBe(false);
    expect(canTransition(field, STAGES.FINAL_DECISION, STAGES.REJECTED)).toBe(false);
  });

  it("no transitions out of terminal stages", () => {
    expect(allowedTransitions(inspector, STAGES.APPROVED)).toEqual([]);
    expect(allowedTransitions(admin, STAGES.REJECTED)).toEqual([]);
  });

  it("RETURNED re-enters DOCUMENT_SCRUTINY only via stage-advance permission", () => {
    expect(canTransition(inspector, STAGES.RETURNED, STAGES.DOCUMENT_SCRUTINY)).toBe(true);
    expect(canTransition(field, STAGES.RETURNED, STAGES.DOCUMENT_SCRUTINY)).toBe(false);
  });
});

describe("canViewApplication", () => {
  const app = { assignedOfficerId: "fo-1" };
  it("view-all roles see everything", () => {
    expect(canViewApplication(inspector, app)).toBe(true);
    expect(canViewApplication(approver, app)).toBe(true);
    expect(canViewApplication(admin, app)).toBe(true);
  });
  it("view-assigned sees only own assignments", () => {
    expect(canViewApplication(field, app)).toBe(true);
    expect(canViewApplication(user("FIELD_OFFICER", "other-fo"), app)).toBe(false);
  });
});

describe("canFieldVerify", () => {
  it("requires FIELD_VERIFY + stage + assignment", () => {
    const app = { assignedOfficerId: "fo-1", currentStage: STAGES.FIELD_VERIFICATION };
    expect(canFieldVerify(field, app)).toBe(true);
    expect(canFieldVerify(inspector, app)).toBe(false);
    expect(canFieldVerify(user("FIELD_OFFICER", "other"), app)).toBe(false);
    expect(canFieldVerify(field, { ...app, currentStage: STAGES.RECEIVED })).toBe(false);
  });
});

describe("canDecide", () => {
  it("requires DECIDE + FINAL_DECISION stage", () => {
    const app = { currentStage: STAGES.FINAL_DECISION };
    expect(canDecide(approver, app)).toBe(true);
    expect(canDecide(inspector, app)).toBe(false);
    expect(canDecide(approver, { currentStage: STAGES.APPROVED })).toBe(false);
  });
});
