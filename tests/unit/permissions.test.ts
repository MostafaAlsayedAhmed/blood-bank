import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  STAFF_ROLES,
  permissionsForRole,
  roleHasPermission,
  type Permission,
  type StaffRole,
} from "@/domain/auth/permissions";

// Transcribed from docs/mvp-technical-spec.md §7. A change here must match a spec change.
const SPEC_MATRIX: Record<Permission, Record<StaffRole, boolean>> = {
  "dashboard:read": { ADMIN: true, STAFF: true, VIEWER: true },
  "donor:read": { ADMIN: true, STAFF: true, VIEWER: true },
  "donor:read_contact": { ADMIN: true, STAFF: true, VIEWER: false },
  "donor:create": { ADMIN: true, STAFF: true, VIEWER: false },
  "donor:update": { ADMIN: true, STAFF: true, VIEWER: false },
  "donor:verify": { ADMIN: true, STAFF: true, VIEWER: false },
  "donor:verify_admin": { ADMIN: true, STAFF: false, VIEWER: false },
  "donor:set_eligibility": { ADMIN: true, STAFF: true, VIEWER: false },
  "donor:eligibility_correct": { ADMIN: true, STAFF: false, VIEWER: false },
  "donor:note": { ADMIN: true, STAFF: true, VIEWER: false },
  "consent:withdraw": { ADMIN: true, STAFF: true, VIEWER: false },
  "request:read": { ADMIN: true, STAFF: true, VIEWER: true },
  "request:write": { ADMIN: true, STAFF: true, VIEWER: false },
  "match:write": { ADMIN: true, STAFF: true, VIEWER: false },
  "communication:write": { ADMIN: true, STAFF: true, VIEWER: false },
  "donation:write": { ADMIN: true, STAFF: true, VIEWER: false },
  "donation:void": { ADMIN: true, STAFF: false, VIEWER: false },
  "history:read": { ADMIN: true, STAFF: true, VIEWER: false },
  "audit:read": { ADMIN: true, STAFF: false, VIEWER: false },
  "dsr:manage": { ADMIN: true, STAFF: false, VIEWER: false },
  "staff:manage": { ADMIN: true, STAFF: false, VIEWER: false },
  "settings:manage": { ADMIN: true, STAFF: false, VIEWER: false },
  "rules:read": { ADMIN: true, STAFF: true, VIEWER: true },
};

describe("permission matrix", () => {
  it("covers exactly the permissions listed in the spec", () => {
    expect([...PERMISSIONS].sort()).toEqual(Object.keys(SPEC_MATRIX).sort());
  });

  for (const permission of PERMISSIONS) {
    for (const role of STAFF_ROLES) {
      const expected = SPEC_MATRIX[permission][role];
      it(`${role} ${expected ? "has" : "lacks"} ${permission}`, () => {
        expect(roleHasPermission(role, permission)).toBe(expected);
      });
    }
  }

  it("VIEWER has no write or contact permissions", () => {
    expect(permissionsForRole("VIEWER")).toEqual(["dashboard:read", "donor:read", "request:read", "rules:read"]);
  });
});
