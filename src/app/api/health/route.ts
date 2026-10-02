import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Liveness + database reachability. Public; reveals no configuration details. */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    logger.error("health check failed", { error });
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
