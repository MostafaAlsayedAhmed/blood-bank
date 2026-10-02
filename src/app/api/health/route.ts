import { NextResponse } from "next/server";
import { checkDatabase } from "@/server/services/health";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/** Liveness + database reachability. Public; reveals no configuration details. */
export async function GET() {
  try {
    await checkDatabase();
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    logger.error("health check failed", { error });
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
