import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only guard /app/* routes
  if (pathname.startsWith("/app")) {
    const sessionRes = await fetch(
      new URL("/api/auth/get-session", request.url),
      {
        headers: request.headers,
      }
    );

    if (!sessionRes.ok) {
      const loginUrl = new URL("/", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const session = await sessionRes.json();
    if (!session?.user || (session.user as { isActive?: boolean }).isActive === false) {
      const loginUrl = new URL("/", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Role-based access control for admin-only routes
    const adminRoutes = ["/app/users", "/app/settings"];
    if (adminRoutes.some((route) => pathname.startsWith(route))) {
      const userRole = (session.user as { role?: string })?.role;
      if (!["owner", "admin"].includes(userRole ?? "")) {
        const ticketsUrl = new URL("/app/tickets", request.url);
        return NextResponse.redirect(ticketsUrl);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};
