import { Prisma } from "@/generated/prisma/client";

/** True for a unique-constraint violation (P2002), optionally on a specific target column. */
export function isUniqueViolation(error: unknown, column?: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  if (!column) return true;
  // The driver adapter reports the constraint fields in meta; fall back to the message.
  const meta = JSON.stringify(error.meta ?? {});
  return meta.includes(column) || error.message.includes(column);
}
