import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type { AuditAction, AuditEntityType } from "@/domain/audit/actions";
import { assertSafeAuditMetadata, type AuditMetadata } from "@/domain/audit/metadata";

/** Either the root client or a transaction client, so audit rows commit with the change. */
export type AuditWriter = PrismaClient | Prisma.TransactionClient;

export type AuditEntry =
  | {
      hospitalId: string;
      actorType: "STAFF";
      actorUserId: string;
      action: AuditAction;
      entityType: AuditEntityType;
      entityId: string;
      metadata?: AuditMetadata;
    }
  | {
      hospitalId: string;
      actorType: "PUBLIC" | "SYSTEM";
      actorUserId?: never;
      action: AuditAction;
      entityType: AuditEntityType;
      entityId: string;
      metadata?: AuditMetadata;
    };

/**
 * Appends one audit row. Call it with the same transaction client as the change
 * it describes, so an action and its audit entry commit or fail together.
 *
 * Not marked `server-only` because the seed script (plain Node) also uses it;
 * ESLint blocks imports of src/server from client code.
 */
export async function recordAudit(writer: AuditWriter, entry: AuditEntry): Promise<void> {
  const metadata = entry.metadata ?? {};
  assertSafeAuditMetadata(metadata);
  await writer.auditLog.create({
    data: {
      hospitalId: entry.hospitalId,
      actorType: entry.actorType,
      actorUserId: entry.actorType === "STAFF" ? entry.actorUserId : null,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      metadata: metadata as Prisma.InputJsonObject,
    },
  });
}
