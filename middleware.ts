// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/sa/login",
  "/sa/signup",
  "/api/auth/",
  "/_next/",
  "/favicon",
  "/print/",   // token-protected print pages — Puppeteer has no session cookie
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

  if (pathname.includes(".")) return NextResponse.next();

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", pathname);

  if (isPublic(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (pathname === "/") {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (pathname === "/sa" || pathname === "/sa/") {
    return NextResponse.redirect(new URL("/sa/login", req.url));
  }

  if (!hasSessionCookie(req)) {
    const loginPath = isSaudiPath(pathname) ? "/sa/login" : "/login";
    const url = new URL(loginPath, req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
