import "server-only";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/server/db";
import { createAuth } from "@/server/auth/auth-config";

// nextCookies() lets Server Actions set auth cookies; it must be the last plugin.
export const auth = createAuth(db, [nextCookies()]);
