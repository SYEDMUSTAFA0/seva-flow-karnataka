// ─── Seva Flow Karnataka — domain constants ─────────────────────────────────
// Single source of truth for workflow stages, roles, permissions, document
// types and allowed stage transitions. Server-side enforcement lives in
// src/lib/permissions.ts — these maps are shared by UI and server code.

export const ROLES = {
  FIELD_OFFICER: "FIELD_OFFICER",
  REVENUE_INSPECTOR: "REVENUE_INSPECTOR",
  APPROVING_OFFICER: "APPROVING_OFFICER",
  ADMIN: "ADMIN",
} as const;
export type RoleId = (typeof ROLES)[keyof typeof ROLES];

export const STAGES = {
  RECEIVED: "RECEIVED",
  DOCUMENT_SCRUTINY: "DOCUMENT_SCRUTINY",
  FIELD_VERIFICATION: "FIELD_VERIFICATION",
  OFFICER_RECOMMENDATION: "OFFICER_RECOMMENDATION",
  FINAL_DECISION: "FINAL_DECISION",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  RETURNED: "RETURNED",
} as const;
export type Stage = (typeof STAGES)[keyof typeof STAGES];

export const ACTIVE_STAGES: Stage[] = [
  STAGES.RECEIVED,
  STAGES.DOCUMENT_SCRUTINY,
  STAGES.FIELD_VERIFICATION,
  STAGES.OFFICER_RECOMMENDATION,
  STAGES.FINAL_DECISION,
];

export const TERMINAL_STAGES: Stage[] = [STAGES.APPROVED, STAGES.REJECTED];

export const STAGE_ORDER: Stage[] = [
  STAGES.RECEIVED,
  STAGES.DOCUMENT_SCRUTINY,
  STAGES.FIELD_VERIFICATION,
  STAGES.OFFICER_RECOMMENDATION,
  STAGES.FINAL_DECISION,
];

export const PRIORITIES = {
  LOW: "LOW",
  NORMAL: "NORMAL",
  HIGH: "HIGH",
  URGENT: "URGENT",
} as const;
export type Priority = (typeof PRIORITIES)[keyof typeof PRIORITIES];

export const DOCUMENT_TYPES = {
  AADHAAR: "AADHAAR",
  RATION_CARD: "RATION_CARD",
  ID_PROOF: "ID_PROOF",
  ADDRESS_PROOF: "ADDRESS_PROOF",
  INCOME_PROOF: "INCOME_PROOF",
  SELF_DECLARATION: "SELF_DECLARATION",
  PHOTOGRAPH: "PHOTOGRAPH",
  FIELD_PHOTO: "FIELD_PHOTO",
  OTHER: "OTHER",
} as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[keyof typeof DOCUMENT_TYPES];

export const DOC_VERIFICATION_STATUSES = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  INVALID: "INVALID",
  MISSING: "MISSING",
  NEEDS_CLARIFICATION: "NEEDS_CLARIFICATION",
} as const;

export const FIELD_OUTCOMES = {
  VERIFIED: "VERIFIED",
  FURTHER_VERIFICATION: "FURTHER_VERIFICATION",
  UNABLE_TO_VERIFY: "UNABLE_TO_VERIFY",
  RETURN_FOR_CLARIFICATION: "RETURN_FOR_CLARIFICATION",
} as const;
export type FieldOutcome = (typeof FIELD_OUTCOMES)[keyof typeof FIELD_OUTCOMES];

export const RECOMMENDATIONS = {
  RECOMMEND_APPROVAL: "RECOMMEND_APPROVAL",
  RECOMMEND_REJECTION: "RECOMMEND_REJECTION",
  RETURN_FOR_VERIFICATION: "RETURN_FOR_VERIFICATION",
} as const;
export type Recommendation = (typeof RECOMMENDATIONS)[keyof typeof RECOMMENDATIONS];

export const DECISIONS = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  RETURNED: "RETURNED",
} as const;
export type Decision = (typeof DECISIONS)[keyof typeof DECISIONS];

export const INCOME_SOURCES = {
  SALARIED: "SALARIED",
  SELF_EMPLOYED: "SELF_EMPLOYED",
  AGRICULTURE: "AGRICULTURE",
  DAILY_WAGE: "DAILY_WAGE",
  PENSION: "PENSION",
  OTHER: "OTHER",
} as const;
export type IncomeSource = (typeof INCOME_SOURCES)[keyof typeof INCOME_SOURCES];

export const PURPOSES = {
  SCHOLARSHIP: "SCHOLARSHIP",
  FEE_CONCESSION: "FEE_CONCESSION",
  GOVT_SCHEME: "GOVT_SCHEME",
  EWS_RESERVATION: "EWS_RESERVATION",
  OTHER: "OTHER",
} as const;
export type Purpose = (typeof PURPOSES)[keyof typeof PURPOSES];

export const AI_TASKS = {
  DOCUMENT_EXTRACTION: "DOCUMENT_EXTRACTION",
  DOCUMENT_COMPARISON: "DOCUMENT_COMPARISON",
  MISSING_INFO: "MISSING_INFO",
  FIELD_REPORT: "FIELD_REPORT",
  CASE_SUMMARY: "CASE_SUMMARY",
  DECISION_SUPPORT: "DECISION_SUPPORT",
} as const;
export type AiTask = (typeof AI_TASKS)[keyof typeof AI_TASKS];

// ─── Permissions ────────────────────────────────────────────────────────────

export const PERMISSIONS = {
  APP_VIEW_ALL: "app:view-all",
  APP_VIEW_ASSIGNED: "app:view-assigned",
  APP_CREATE: "app:create",
  APP_EDIT: "app:edit",
  DOC_UPLOAD: "doc:upload",
  DOC_VERIFY: "doc:verify",
  DOC_REQUEST: "doc:request",
  STAGE_ADVANCE: "stage:advance",
  FIELD_VERIFY: "field:verify",
  RECOMMEND: "recommendation:submit",
  DECIDE: "decision:make",
  AI_USE: "ai:use",
  AUDIT_VIEW_ALL: "audit:view-all",
  USERS_MANAGE: "users:manage",
  CONFIG_MANAGE: "config:manage",
} as const;
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  FIELD_OFFICER: [
    PERMISSIONS.APP_VIEW_ASSIGNED,
    PERMISSIONS.DOC_UPLOAD,
    PERMISSIONS.DOC_REQUEST,
    PERMISSIONS.FIELD_VERIFY,
    PERMISSIONS.AI_USE,
  ],
  REVENUE_INSPECTOR: [
    PERMISSIONS.APP_VIEW_ALL,
    PERMISSIONS.APP_CREATE,
    PERMISSIONS.APP_EDIT,
    PERMISSIONS.DOC_UPLOAD,
    PERMISSIONS.DOC_VERIFY,
    PERMISSIONS.DOC_REQUEST,
    PERMISSIONS.STAGE_ADVANCE,
    PERMISSIONS.RECOMMEND,
    PERMISSIONS.AI_USE,
  ],
  APPROVING_OFFICER: [
    PERMISSIONS.APP_VIEW_ALL,
    PERMISSIONS.DECIDE,
    PERMISSIONS.AI_USE,
    PERMISSIONS.AUDIT_VIEW_ALL,
  ],
  ADMIN: [
    PERMISSIONS.APP_VIEW_ALL,
    PERMISSIONS.APP_CREATE,
    PERMISSIONS.APP_EDIT,
    PERMISSIONS.USERS_MANAGE,
    PERMISSIONS.CONFIG_MANAGE,
    PERMISSIONS.AUDIT_VIEW_ALL,
    PERMISSIONS.AI_USE,
  ],
};

// ─── Stage transitions ──────────────────────────────────────────────────────
// Keyed by current stage → allowed next stage → permission required.
// Final decisions additionally require the DECIDE permission.

export const STAGE_TRANSITIONS: Partial<
  Record<Stage, Partial<Record<Stage, Permission>>>
> = {
  [STAGES.RECEIVED]: {
    [STAGES.DOCUMENT_SCRUTINY]: PERMISSIONS.STAGE_ADVANCE,
    [STAGES.RETURNED]: PERMISSIONS.DOC_REQUEST,
  },
  [STAGES.DOCUMENT_SCRUTINY]: {
    [STAGES.FIELD_VERIFICATION]: PERMISSIONS.STAGE_ADVANCE,
    [STAGES.RETURNED]: PERMISSIONS.DOC_REQUEST,
    [STAGES.FINAL_DECISION]: PERMISSIONS.RECOMMEND, // direct rejection recommendation
  },
  [STAGES.FIELD_VERIFICATION]: {
    [STAGES.OFFICER_RECOMMENDATION]: PERMISSIONS.STAGE_ADVANCE,
    [STAGES.RETURNED]: PERMISSIONS.DOC_REQUEST,
  },
  [STAGES.OFFICER_RECOMMENDATION]: {
    [STAGES.FINAL_DECISION]: PERMISSIONS.RECOMMEND,
  },
  [STAGES.FINAL_DECISION]: {
    [STAGES.APPROVED]: PERMISSIONS.DECIDE,
    [STAGES.REJECTED]: PERMISSIONS.DECIDE,
    [STAGES.RETURNED]: PERMISSIONS.DECIDE,
  },
  [STAGES.RETURNED]: {
    // citizen resubmission re-enters document scrutiny
    [STAGES.DOCUMENT_SCRUTINY]: PERMISSIONS.STAGE_ADVANCE,
  },
};

// ─── Misc ────────────────────────────────────────────────────────────────────

export const LANGUAGES = { KN: "kn", EN: "en" } as const;
export type Language = (typeof LANGUAGES)[keyof typeof LANGUAGES];
export const DEFAULT_LANGUAGE: Language = "kn";
export const LANGUAGE_COOKIE = "sf_lang";
export const SESSION_COOKIE = "sf_session";

/** Illustrative internal target (days) — NOT a statutory deadline. */
export const INTERNAL_TARGET_DAYS = 21;

export const APPLICATION_TYPE_LABEL = "INCOME_CERTIFICATE";
