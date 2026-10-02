"use server";

import { cookies } from "next/headers";
import * as z from "zod";
import { LOCALE_COOKIE, LOCALES } from "@/i18n/config";

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const schema = z.enum(LOCALES);

/**
 * Stores the viewer's language choice. Deliberately outside runAction: it is
 * available to anonymous visitors of /register, reads and writes no data, and
 * only sets a validated, non-personal preference cookie.
 */
export async function setLocaleAction(locale: unknown): Promise<void> {
  const parsed = schema.safeParse(locale);
  if (!parsed.success) return;
  (await cookies()).set(LOCALE_COOKIE, parsed.data, {
    path: "/",
    maxAge: ONE_YEAR_SECONDS,
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
}
