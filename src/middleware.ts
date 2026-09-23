import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getIronSession } from "iron-session";
import type { SessionData } from "@/modules/auth/types";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const sessionOptions = {
    password: process.env.AUTH_SECRET!,
    cookieName: "lounge-admin-session",
  };

  // Protect /admin routes (except /admin/login)
  if (
    request.nextUrl.pathname.startsWith("/admin") &&
    !request.nextUrl.pathname.startsWith("/admin/login")
  ) {
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    if (!session.isLoggedIn) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  // If logged in and visiting /admin/login, redirect to dashboard
  if (request.nextUrl.pathname === "/admin/login") {
    const session = await getIronSession<SessionData>(request, response, sessionOptions);

    if (session.isLoggedIn) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
