import { betterAuth, type BetterAuthPlugin } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import { admin } from "better-auth/plugins";
import type { PrismaClient } from "@/generated/prisma/client";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/domain/audit/actions";
import { recordAudit } from "@/server/services/audit";
import { logger } from "@/lib/logger";

// Assumption A14: staff passwords are at least 12 characters.
export const MIN_PASSWORD_LENGTH = 12;

// Open Question O9: session lifetime depends on whether workstations are shared.
// Until answered: sessions last 8 hours (one shift) and refresh at most hourly.
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const SESSION_REFRESH_AGE_SECONDS = 60 * 60;

/**
 * Builds the Better Auth instance. A factory (rather than a singleton) so the
 * seed script can reuse the exact same configuration and password hashing
 * without loading Next.js-only plugins.
 */
export function createAuth(prisma: PrismaClient, extraPlugins: BetterAuthPlugin[] = []) {
  const baseURL = process.env.BETTER_AUTH_URL;

  return betterAuth({
    appName: "Queseir Blood Bank",
    baseURL,
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: baseURL ? [baseURL] : [],
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true,
      // Staff accounts are created by an ADMIN or the seed, never self-registered (A9).
      disableSignUp: true,
      minPasswordLength: MIN_PASSWORD_LENGTH,
      maxPasswordLength: 128,
    },
    session: {
      expiresIn: SESSION_MAX_AGE_SECONDS,
      updateAge: SESSION_REFRESH_AGE_SECONDS,
    },
    // Rate limiting is on by default in production (memory store, single instance).
    // Switch to storage: "database" before running more than one instance (spec Phase 8).
    rateLimit: {
      enabled: process.env.NODE_ENV === "production",
    },
    advanced: {
      useSecureCookies: process.env.NODE_ENV === "production",
    },
    databaseHooks: {
      session: {
        create: {
          // Audit every successful staff sign-in. Failures are logged, never block login.
          after: async (session) => {
            try {
              const membership = await prisma.staffMembership.findFirst({
                where: { userId: session.userId, active: true },
                select: { hospitalId: true },
              });
              if (!membership) return; // No hospital to attribute to; the DAL will deny access.
              await recordAudit(prisma, {
                hospitalId: membership.hospitalId,
                actorType: "STAFF",
                actorUserId: session.userId,
                action: AUDIT_ACTIONS.authLogin,
                entityType: AUDIT_ENTITY_TYPES.user,
                entityId: session.userId,
                metadata: { method: "password" },
              });
            } catch (error) {
              logger.error("auth.login audit failed", { error });
            }
          },
        },
      },
    },
    // Better Auth's own role stays "admin" | "user"; the application role lives on
    // StaffMembership (spec D8).
    plugins: [admin({ defaultRole: "user", adminRoles: ["admin"] }), ...extraPlugins],
  });
}

export type Auth = ReturnType<typeof createAuth>;
