import * as z from "zod";
import { isDomainError } from "@/domain/errors";
import type { Permission } from "@/domain/auth/permissions";
import type { ActionResult } from "@/lib/action-result";
import type { AuthContext } from "@/server/auth/session-verifier";

type Logger = { error: (message: string, fields?: Record<string, unknown>) => void };

export type ActionRunnerDeps = {
  requirePermission: (permission: Permission) => Promise<AuthContext>;
  logger: Logger;
};

export type ActionSpec<S extends z.ZodType, T> = {
  permission: Permission;
  schema: S;
  handler: (ctx: AuthContext, input: z.infer<S>) => Promise<T>;
};

/**
 * Framework-free core of every Server Action (spec §8):
 *   requirePermission → Zod safeParse → handler → typed ActionResult.
 * Authorization runs first, so an unauthenticated caller learns nothing about
 * validation rules. Unexpected errors are logged (redacted) and returned as INTERNAL.
 */
export function createActionRunner(deps: ActionRunnerDeps) {
  return async function runAction<S extends z.ZodType, T>(
    spec: ActionSpec<S, T>,
    rawInput: unknown,
  ): Promise<ActionResult<T>> {
    try {
      const ctx = await deps.requirePermission(spec.permission);

      const parsed = spec.schema.safeParse(rawInput);
      if (!parsed.success) {
        const { fieldErrors } = z.flattenError(parsed.error);
        return { ok: false, error: "VALIDATION", fieldErrors: fieldErrors as Record<string, string[]> };
      }

      return { ok: true, data: await spec.handler(ctx, parsed.data) };
    } catch (error) {
      if (isDomainError(error)) return { ok: false, error: error.code };
      deps.logger.error("server action failed", { permission: spec.permission, error });
      return { ok: false, error: "INTERNAL" };
    }
  };
}
