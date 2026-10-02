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

export type PublicActionSpec<C, S extends z.ZodType, T> = {
  schema: S;
  handler: (ctx: C, input: z.infer<S>) => Promise<T>;
};

/**
 * Runner for the few unauthenticated actions (public registration). Same Zod and
 * error handling as runAction; the context (hospital, IP hash) comes from server
 * configuration, never from client input.
 */
export function createPublicActionRunner<C>(deps: { getContext: () => Promise<C>; logger: Logger }) {
  return async function runPublicAction<S extends z.ZodType, T>(
    spec: PublicActionSpec<C, S, T>,
    rawInput: unknown,
  ): Promise<ActionResult<T>> {
    try {
      const parsed = spec.schema.safeParse(rawInput);
      if (!parsed.success) {
        const { fieldErrors } = z.flattenError(parsed.error);
        return { ok: false, error: "VALIDATION", fieldErrors: fieldErrors as Record<string, string[]> };
      }
      return { ok: true, data: await spec.handler(await deps.getContext(), parsed.data) };
    } catch (error) {
      if (isDomainError(error) && error.code !== "INTERNAL") return { ok: false, error: error.code };
      deps.logger.error("public action failed", { error });
      return { ok: false, error: "INTERNAL" };
    }
  };
}

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
