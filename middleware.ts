// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/sa/login",
  "/sa/signup",
  "/api/auth/",   // covers otp/request, otp/verify, google, microsoft, logout
  "/_next/",
  "/favicon",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(p => pathname === p || pathname.startsWith(p));
}

function hasSessionCookie(req: NextRequest): boolean {
  const sid = req.cookies.get("sid")?.value ?? "";
  return sid.trim().length > 0;
}

function isSaudiPath(pathname: string): boolean {
  return pathname.startsWith("/sa/") || pathname === "/sa";
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow static files
  if (pathname.includes(".")) return NextResponse.next();

  // Allow all public routes + all auth API routes
  if (isPublic(pathname)) return NextResponse.next();

  // Root → /login
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // /sa root → /sa/login
  if (pathname === "/sa" || pathname === "/sa/") {
    return NextResponse.redirect(new URL("/sa/login", req.url));
  }

  // Protected routes — require session cookie
  if (!hasSessionCookie(req)) {
    const loginPath = isSaudiPath(pathname) ? "/sa/login" : "/login";
    const url = new URL(loginPath, req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
