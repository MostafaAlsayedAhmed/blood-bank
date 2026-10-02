import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { auth } from "@/server/auth/auth";
import { createSessionVerifier, type AuthContext } from "@/server/auth/session-verifier";
import { isDomainError } from "@/domain/errors";
import type { Permission } from "@/domain/auth/permissions";
import { logger } from "@/lib/logger";

export type { AuthContext } from "@/server/auth/session-verifier";

const verifier = createSessionVerifier({
  getSessionUser: async () => {
    const session = await auth.api.getSession({ headers: await headers() });
    return session ? { id: session.user.id, name: session.user.name } : null;
  },
  loadActiveMemberships: async (userId) => {
    const rows = await db.staffMembership.findMany({
      where: { userId, active: true },
      select: { hospitalId: true, role: true, hospital: { select: { name: true } } },
      take: 2,
    });
    return rows.map((r) => ({ hospitalId: r.hospitalId, hospitalName: r.hospital.name, role: r.role }));
  },
  onAmbiguousMembership: (userId, count) =>
    logger.warn("user has several active memberships; hospital selection is not implemented", {
      userId,
      count,
    }),
});

/**
 * The Data Access Layer entry point (spec §8). Memoized per request.
 * Throws DomainError UNAUTHENTICATED / FORBIDDEN.
 */
export const verifySession: () => Promise<AuthContext> = cache(verifier.verifySession);

/** Use in every Server Action, query and Route Handler. */
export function requirePermission(permission: Permission): Promise<AuthContext> {
  return verifier.requirePermission(permission, verifySession);
}

/**
 * For Server Component pages: same checks, but turns failures into navigation.
 * Layouts must not be relied on for authorization; each page calls this.
 */
export async function requirePagePermission(permission: Permission): Promise<AuthContext> {
  try {
    return await requirePermission(permission);
  } catch (error) {
    if (isDomainError(error) && error.code === "UNAUTHENTICATED") redirect("/login");
    if (isDomainError(error) && error.code === "FORBIDDEN") redirect("/no-access");
    throw error;
  }
}

/** For UI that renders differently when signed out (e.g. the login page). */
export async function getOptionalAuthContext(): Promise<AuthContext | null> {
  try {
    return await verifySession();
  } catch (error) {
    if (isDomainError(error)) return null;
    throw error;
  }
}
