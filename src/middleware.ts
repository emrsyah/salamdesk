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
 *  - RBAC: read the cached session (signed cookie, no DB). This is an
 *    optimistic fast-path only. The cookie-cache cookie (session_data) has a
 *    short TTL and is refreshed by server-side getSession() — so it is often
 *    absent here even for valid admins (e.g. after idling past the TTL). We
 *    therefore fail OPEN on a cache miss: redirect only when we can positively
 *    read a non-admin role. When the role can't be determined, we let the
 *    request through to the authoritative server-side guard (layout/page/action
 *    getSession()), which hits the DB and redirects genuine non-admins.
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
    // Only act when the cache positively resolves a role. A null cache means
    // the short-lived session_data cookie is absent/expired — not that the user
    // lacks the role — so we defer to the server-side guard instead of bouncing.
    if (cached?.user) {
      const role = (cached.user as { role?: string }).role;
      if (!["owner", "admin"].includes(role ?? "")) {
        return NextResponse.redirect(new URL("/app/tickets", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
