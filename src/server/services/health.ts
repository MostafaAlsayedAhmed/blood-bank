import "server-only";
import { db } from "@/server/db";

/** Throws if the database is unreachable. */
export async function checkDatabase(): Promise<void> {
  await db.$queryRaw`SELECT 1`;
}
