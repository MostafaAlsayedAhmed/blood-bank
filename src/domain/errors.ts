/**
 * Closed set of domain error codes (spec §8). UI maps codes to localized messages;
 * codes never carry personal data.
 */
export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "CONFLICT",
  "INVALID_TRANSITION",
  "RULES_NOT_CONFIGURED",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class DomainError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, detail?: string) {
    // `detail` is for developer logs only and must not contain personal data.
    super(detail ? `${code}: ${detail}` : code);
    this.name = "DomainError";
    this.code = code;
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
