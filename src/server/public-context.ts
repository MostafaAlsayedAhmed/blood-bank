import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { db } from "@/server/db";
import { DomainError } from "@/domain/errors";

/**
 * Context for unauthenticated public requests (/register). There is no session,
 * so the hospital comes from server configuration, never from client input.
 */
export type PublicContext = { hospitalId: string; ipHash: string };

let cachedHospitalId: string | undefined;

async function resolvePublicHospitalId(): Promise<string> {
  if (cachedHospitalId) return cachedHospitalId;
  const code = process.env.PUBLIC_HOSPITAL_CODE;
  if (!code) throw new DomainError("INTERNAL", "PUBLIC_HOSPITAL_CODE is not set");
  const hospital = await db.hospital.findUnique({ where: { code }, select: { id: true } });
  if (!hospital) throw new DomainError("INTERNAL", "PUBLIC_HOSPITAL_CODE does not match a hospital");
  cachedHospitalId = hospital.id;
  return hospital.id;
}

/**
 * Keyed hash of the client IP for throttling; the IP itself is never stored.
 * Technical Decision: the key is derived from BETTER_AUTH_SECRET with a purpose label,
 * so no extra secret is needed and hashes cannot be reversed by brute-forcing IPv4.
 * The first X-Forwarded-For entry is client-controlled unless a trusted proxy
 * overwrites it; the production proxy setup must do so (Phase 8, with L1 hosting).
 */
export function hashClientIp(ip: string, secret: string): string {
  return createHmac("sha256", secret).update(`registration-throttle:${ip}`).digest("hex");
}

export async function getPublicContext(): Promise<PublicContext> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new DomainError("INTERNAL", "BETTER_AUTH_SECRET is not set");
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return { hospitalId: await resolvePublicHospitalId(), ipHash: hashClientIp(ip, secret) };
}
