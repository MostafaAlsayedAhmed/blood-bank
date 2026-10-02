"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth/auth";
import { db } from "@/server/db";
import { getOptionalAuthContext } from "@/server/auth/dal";
import { recordAudit } from "@/server/services/audit";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/domain/audit/actions";
import { logger } from "@/lib/logger";

/** Signs the current user out, auditing the logout before the session ends. */
export async function signOutAction(): Promise<void> {
  const ctx = await getOptionalAuthContext();

  if (ctx) {
    try {
      await recordAudit(db, {
        hospitalId: ctx.hospitalId,
        actorType: "STAFF",
        actorUserId: ctx.userId,
        action: AUDIT_ACTIONS.authLogout,
        entityType: AUDIT_ENTITY_TYPES.user,
        entityId: ctx.userId,
      });
    } catch (error) {
      logger.error("auth.logout audit failed", { error });
    }
  }

  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
