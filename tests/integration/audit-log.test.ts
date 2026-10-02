import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";
import { createPrismaClient } from "@/server/db-client";
import { recordAudit } from "@/server/services/audit";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "@/domain/audit/actions";

const prisma = createPrismaClient(inject("databaseUrl"));
let hospitalId: string;
let userId: string;

beforeAll(async () => {
  const hospital = await prisma.hospital.create({
    data: { code: `T-${randomUUID().slice(0, 8)}`, name: "Integration Hospital", city: "Test City" },
  });
  hospitalId = hospital.id;
  const user = await prisma.user.create({
    data: { id: randomUUID(), name: "Integration User", email: `${randomUUID()}@bloodbank.test` },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("audit_log integrity (migration rules)", () => {
  it("records a staff action through the audit service", async () => {
    await recordAudit(prisma, {
      hospitalId,
      actorType: "STAFF",
      actorUserId: userId,
      action: AUDIT_ACTIONS.authLogin,
      entityType: AUDIT_ENTITY_TYPES.user,
      entityId: userId,
      metadata: { method: "password" },
    });
    const rows = await prisma.auditLog.findMany({ where: { hospitalId, action: "auth.login" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.metadata).toEqual({ method: "password" });
  });

  it("blocks UPDATE, DELETE and TRUNCATE", async () => {
    await expect(prisma.$executeRawUnsafe(`UPDATE "audit_log" SET "action" = 'auth.logout'`)).rejects.toThrow(
      /append-only/,
    );
    await expect(prisma.$executeRawUnsafe(`DELETE FROM "audit_log"`)).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe(`TRUNCATE "audit_log"`)).rejects.toThrow(/append-only/);
  });

  it("rejects malformed action names", async () => {
    await expect(
      prisma.auditLog.create({
        data: { hospitalId, actorType: "SYSTEM", action: "Login", entityType: "user", entityId: "x" },
      }),
    ).rejects.toThrow();
  });

  it("requires a staff actor exactly when actorType is STAFF", async () => {
    await expect(
      prisma.auditLog.create({
        data: { hospitalId, actorType: "STAFF", action: "auth.login", entityType: "user", entityId: "x" },
      }),
    ).rejects.toThrow();
  });

  it("prevents deleting a user who appears in the audit log", async () => {
    await expect(prisma.user.delete({ where: { id: userId } })).rejects.toThrow();
  });
});
