import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic check only (spec D7): redirects to /login when no session cookie exists.
 * It does NOT authorize anything — every page, Server Action and Route Handler
 * re-checks the session and permission in the DAL (src/server/auth/dal.ts).
 * No database access here.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/donors/:path*",
    "/requests/:path*",
    "/donations/:path*",
    "/communications/:path*",
    "/settings/:path*",
  ],
};
