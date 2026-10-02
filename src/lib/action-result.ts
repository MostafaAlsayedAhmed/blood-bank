import type { ErrorCode } from "@/domain/errors";

/**
 * Uniform result of every Server Action. Values are serialized to the client,
 * so `data` must be a minimal DTO (spec §8).
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: ErrorCode; fieldErrors?: Record<string, string[]> };
