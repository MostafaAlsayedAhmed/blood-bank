import "server-only";
import { requirePermission } from "@/server/auth/dal";
import { createActionRunner } from "@/server/actions/action-runner";
import { logger } from "@/lib/logger";

/** Bound runner used by every feature's actions.ts. */
export const runAction = createActionRunner({ requirePermission, logger });
