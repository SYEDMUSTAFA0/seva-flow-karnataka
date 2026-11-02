import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  STAGE_TRANSITIONS,
  STAGES,
  type Permission,
  type RoleId,
  type Stage,
} from "@/lib/constants";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  nameKn: string | null;
  roleId: RoleId;
  roleNameEn: string;
  roleNameKn: string;
  taluk: string | null;
  district: string | null;
  /** Role's admin-configured permission set. Empty/undefined → code defaults. */
  permissions?: string[];
}

export function hasPermission(user: AuthUser | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  const list = user.permissions?.length ? user.permissions : ROLE_PERMISSIONS[user.roleId];
  return list?.includes(permission) ?? false;
}

export function can(user: AuthUser | null | undefined, permission: Permission): boolean {
  return hasPermission(user, permission);
}

/** Whether `user` may move an application from `from` to `to`. */
export function canTransition(user: AuthUser, from: Stage, to: Stage): boolean {
  const required = STAGE_TRANSITIONS[from]?.[to];
  if (!required) return false;
  return hasPermission(user, required);
}

/** Allowed next stages for a user + stage (used to render action buttons). */
export function allowedTransitions(user: AuthUser, from: Stage): Stage[] {
  const map = STAGE_TRANSITIONS[from] ?? {};
  return (Object.keys(map) as Stage[]).filter((to) => hasPermission(user, map[to]!));
}

export function canViewApplication(
  user: AuthUser,
  application: { assignedOfficerId: string | null }
): boolean {
  if (hasPermission(user, PERMISSIONS.APP_VIEW_ALL)) return true;
  if (hasPermission(user, PERMISSIONS.APP_VIEW_ASSIGNED)) {
    return application.assignedOfficerId === user.id;
  }
  return false;
}

/** Field officer may only verify applications assigned to them. */
export function canFieldVerify(user: AuthUser, application: { assignedOfficerId: string | null; currentStage: string }): boolean {
  return (
    hasPermission(user, PERMISSIONS.FIELD_VERIFY) &&
    application.currentStage === STAGES.FIELD_VERIFICATION &&
    application.assignedOfficerId === user.id
  );
}

export function canDecide(user: AuthUser, application: { currentStage: string }): boolean {
  return hasPermission(user, PERMISSIONS.DECIDE) && application.currentStage === STAGES.FINAL_DECISION;
}
