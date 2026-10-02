import { DomainError } from "@/domain/errors";
import { roleHasPermission, type Permission, type StaffRole } from "@/domain/auth/permissions";

/**
 * Identity of an authenticated staff member, scoped to one hospital.
 * Services accept only this type; it is minted by the DAL after the session
 * and active membership have been checked server-side.
 */
export type AuthContext = Readonly<{
  userId: string;
  name: string;
  hospitalId: string;
  hospitalName: string;
  role: StaffRole;
}> & { readonly __brand: "AuthContext" };

export type SessionUser = { id: string; name: string };

export type ActiveMembership = {
  hospitalId: string;
  hospitalName: string;
  role: StaffRole;
};

export type SessionVerifierDeps = {
  /** Returns the signed-in user, or null when there is no valid session. */
  getSessionUser: () => Promise<SessionUser | null>;
  /** Returns the user's active memberships (MVP expects exactly one). */
  loadActiveMemberships: (userId: string) => Promise<ActiveMembership[]>;
  onAmbiguousMembership?: (userId: string, count: number) => void;
};

/**
 * Framework-free core of the DAL, so it can be unit-tested without Next.js.
 * - no session              → UNAUTHENTICATED
 * - no / several memberships → FORBIDDEN (hospital selection is not in the MVP, A1)
 */
export function createSessionVerifier(deps: SessionVerifierDeps) {
  async function verifySession(): Promise<AuthContext> {
    const user = await deps.getSessionUser();
    if (!user) throw new DomainError("UNAUTHENTICATED");

    const memberships = await deps.loadActiveMemberships(user.id);
    if (memberships.length !== 1) {
      if (memberships.length > 1) deps.onAmbiguousMembership?.(user.id, memberships.length);
      throw new DomainError("FORBIDDEN", "no single active hospital membership");
    }
    const [membership] = memberships as [ActiveMembership];

    return {
      userId: user.id,
      name: user.name,
      hospitalId: membership.hospitalId,
      hospitalName: membership.hospitalName,
      role: membership.role,
    } as AuthContext;
  }

  async function requirePermission(
    permission: Permission,
    verify: () => Promise<AuthContext> = verifySession,
  ): Promise<AuthContext> {
    const ctx = await verify();
    if (!roleHasPermission(ctx.role, permission)) {
      throw new DomainError("FORBIDDEN", `missing ${permission}`);
    }
    return ctx;
  }

  return { verifySession, requirePermission };
}
