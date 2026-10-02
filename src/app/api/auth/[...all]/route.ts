import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth/auth";

// Better Auth endpoints (sign-in, sign-out, session). Sign-up is disabled in config.
export const { GET, POST } = toNextJsHandler(auth);
