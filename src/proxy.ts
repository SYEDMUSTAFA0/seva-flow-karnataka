import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

/**
 * Fast-path redirect only — real session verification happens server-side in
 * layouts and actions (the network proxy cannot reach the database).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession && !pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // run on everything except API routes (they enforce auth internally),
  // static assets and images
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
