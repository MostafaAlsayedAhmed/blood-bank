import "server-only";
import { requirePermission } from "@/server/auth/dal";
import { createActionRunner, createPublicActionRunner } from "@/server/actions/action-runner";
import { getPublicContext } from "@/server/public-context";
import { logger } from "@/lib/logger";

/** Bound runner used by every feature's actions.ts. */
export const runAction = createActionRunner({ requirePermission, logger });

/** Bound runner for unauthenticated public actions (registration only). */
export const runPublicAction = createPublicActionRunner({ getContext: getPublicContext, logger });
