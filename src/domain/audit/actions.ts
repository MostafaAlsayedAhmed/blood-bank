/**
 * Audit action names (spec §8 Audit strategy). Format "<entity>.<verb>" is also
 * enforced by the audit_log_action_format CHECK constraint.
 * Phase 1 uses the auth and seed actions; later phases add theirs here.
 */
export const AUDIT_ACTIONS = {
  authLogin: "auth.login",
  authLogout: "auth.logout",
  seedCompleted: "seed.completed",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_ENTITY_TYPES = {
  user: "user",
  hospital: "hospital",
} as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[keyof typeof AUDIT_ENTITY_TYPES];
