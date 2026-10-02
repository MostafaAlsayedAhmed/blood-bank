/**
 * Development seed — FICTIONAL DATA ONLY.
 *
 * Creates one hospital record, placeholder areas and three staff accounts
 * (ADMIN, STAFF, VIEWER). Idempotent: safe to run repeatedly.
 * Donors, requests and donations are seeded in the phases that add those tables.
 *
 * Run: pnpm db:seed   (requires SEED_STAFF_PASSWORD, refuses NODE_ENV=production)
 */
import "dotenv/config";
import { createPrismaClient } from "../src/server/db-client";
import { createAuth, MIN_PASSWORD_LENGTH } from "../src/server/auth/auth-config";
import { recordAudit } from "../src/server/services/audit";
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from "../src/domain/audit/actions";
import type { StaffRole } from "../src/domain/auth/permissions";

const HOSPITAL = {
  code: "QSR",
  name: "Queseir Hospital Blood Bank",
  city: "Quseir",
  timezone: "Africa/Cairo",
} as const;

// Open Question O5: the real area list is not yet provided. These are placeholders.
const PLACEHOLDER_AREAS = ["Dev Area North", "Dev Area Center", "Dev Area South"] as const;

// Fictional staff on the reserved .test domain (RFC 2606) — never real people.
const STAFF: ReadonlyArray<{ email: string; name: string; role: StaffRole }> = [
  { email: "admin@bloodbank.test", name: "Dev Admin", role: "ADMIN" },
  { email: "staff@bloodbank.test", name: "Dev Coordinator", role: "STAFF" },
  { email: "viewer@bloodbank.test", name: "Dev Viewer", role: "VIEWER" },
];

function readSeedPassword(): string {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to seed: NODE_ENV=production. The seed is for development only.");
  }
  const password = process.env.SEED_STAFF_PASSWORD ?? "";
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Set SEED_STAFF_PASSWORD in .env (at least ${MIN_PASSWORD_LENGTH} characters).`);
  }
  return password;
}

async function main(): Promise<void> {
  const password = readSeedPassword();
  const prisma = createPrismaClient(process.env.DATABASE_URL);
  const auth = createAuth(prisma);

  try {
    const hospital = await prisma.hospital.upsert({
      where: { code: HOSPITAL.code },
      update: {},
      create: HOSPITAL,
    });

    for (const name of PLACEHOLDER_AREAS) {
      await prisma.area.upsert({
        where: { hospitalId_city_name: { hospitalId: hospital.id, city: HOSPITAL.city, name } },
        update: {},
        create: { hospitalId: hospital.id, city: HOSPITAL.city, name },
      });
    }

    const created: string[] = [];
    for (const member of STAFF) {
      let user = await prisma.user.findUnique({ where: { email: member.email } });
      if (!user) {
        // Uses Better Auth so the password is hashed exactly as at sign-in.
        await auth.api.createUser({
          body: {
            email: member.email,
            password,
            name: member.name,
            role: member.role === "ADMIN" ? "admin" : "user",
          },
        });
        user = await prisma.user.findUniqueOrThrow({ where: { email: member.email } });
        created.push(member.role);
      }

      await prisma.staffMembership.upsert({
        where: { userId_hospitalId: { userId: user.id, hospitalId: hospital.id } },
        update: { role: member.role, active: true },
        create: { userId: user.id, hospitalId: hospital.id, role: member.role },
      });
    }

    await recordAudit(prisma, {
      hospitalId: hospital.id,
      actorType: "SYSTEM",
      action: AUDIT_ACTIONS.seedCompleted,
      entityType: AUDIT_ENTITY_TYPES.hospital,
      entityId: hospital.id,
      metadata: { createdStaffRoles: created },
    });

    console.log(`Seed complete: hospital ${HOSPITAL.code}, ${PLACEHOLDER_AREAS.length} areas, staff created: ${created.length}`);
    console.log("Staff logins: admin@ / staff@ / viewer@bloodbank.test with SEED_STAFF_PASSWORD");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
