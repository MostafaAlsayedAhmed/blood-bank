/**
 * Code-defined permission map (spec §7, decision D8).
 * Every server entry point checks one of these keys via requirePermission().
 * Adding a role or permission is a reviewed code change, not a runtime setting.
 */

export const STAFF_ROLES = ["ADMIN", "STAFF", "VIEWER"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = [
  "dashboard:read",
  "donor:read",
  "donor:read_contact",
  "donor:create",
  "donor:update",
  "donor:verify",
  "donor:verify_admin",
  "donor:set_eligibility",
  "donor:eligibility_correct",
  "donor:note",
  "consent:withdraw",
  "request:read",
  "request:write",
  "match:write",
  "communication:write",
  "donation:write",
  "donation:void",
  "history:read",
  "audit:read",
  "dsr:manage",
  "staff:manage",
  "settings:manage",
  "rules:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const VIEWER_PERMISSIONS = [
  "dashboard:read",
  "donor:read",
  "request:read",
  "rules:read",
] as const satisfies readonly Permission[];

// Open Question O12: eligibility may later be restricted to a medically qualified role.
const STAFF_PERMISSIONS = [
  ...VIEWER_PERMISSIONS,
  "donor:read_contact",
  "donor:create",
  "donor:update",
  "donor:verify",
  "donor:set_eligibility",
  "donor:note",
  "consent:withdraw",
  "request:write",
  "match:write",
  "communication:write",
  "donation:write",
  "history:read",
] as const satisfies readonly Permission[];

const ROLE_PERMISSIONS: Readonly<Record<StaffRole, ReadonlySet<Permission>>> = {
  ADMIN: new Set<Permission>(PERMISSIONS),
  STAFF: new Set<Permission>(STAFF_PERMISSIONS),
  VIEWER: new Set<Permission>(VIEWER_PERMISSIONS),
};

export function roleHasPermission(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function permissionsForRole(role: StaffRole): readonly Permission[] {
  return PERMISSIONS.filter((p) => ROLE_PERMISSIONS[role].has(p));
}
