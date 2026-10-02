import { DomainError } from "@/domain/errors";
import { isPiiKey } from "@/domain/pii";

/** Audit metadata: flat, primitive values only — ids, field names, status values. */
export type AuditMetadataValue = string | number | boolean | null | readonly string[];
export type AuditMetadata = Readonly<Record<string, AuditMetadataValue>>;

/**
 * Rejects metadata that could carry personal data. Throws rather than silently
 * dropping keys so a mistake is caught in tests, not discovered in production logs.
 */
export function assertSafeAuditMetadata(metadata: AuditMetadata): void {
  for (const [key, value] of Object.entries(metadata)) {
    if (isPiiKey(key)) {
      throw new DomainError("INTERNAL", `audit metadata key "${key}" is not allowed`);
    }
    const isPrimitive = value === null || ["string", "number", "boolean"].includes(typeof value);
    const isStringList = Array.isArray(value) && value.every((v) => typeof v === "string");
    if (!isPrimitive && !isStringList) {
      throw new DomainError("INTERNAL", `audit metadata key "${key}" must be a primitive or string list`);
    }
  }
}
