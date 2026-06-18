import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie, getCookieCache } from "better-auth/cookies";

/**
 * Optimistic auth middleware. It does NOT hit the DB (or self-fetch the
 * session endpoint) — that was the dominant per-navigation latency. The
 * authoritative check lives in the /app layout, which calls getSession()
 * (now cookie-cache backed) and redirects inactive/anonymous users.
 *
 *  - Gate: presence of the long-lived session cookie. Logged-in users are
 *    never bounced to login by a cache miss.
 *  - RBAC: read the cached session (signed cookie, no DB). Fail closed —
 *    if the role can't be determined or is insufficient, send to /app/tickets.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/app")) return NextResponse.next();

  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const adminRoutes = ["/app/users", "/app/settings", "/app/agent"];
  if (adminRoutes.some((route) => pathname.startsWith(route))) {
    const cached = await getCookieCache(request);
    const role = (cached?.user as { role?: string } | undefined)?.role;
    if (!["owner", "admin"].includes(role ?? "")) {
      return NextResponse.redirect(new URL("/app/tickets", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
