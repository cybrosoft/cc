// lib/utils/dashboard-url.ts
// The ONE rule: never hardcode /dashboard or /sa/dashboard anywhere.
// Always use this helper in auth redirects, nav links, and email links.

/**
 * Returns the correct dashboard URL for a given market key.
 * Saudi customers → /sa/dashboard
 * Everyone else  → /dashboard
 */
export function dashboardUrl(marketKey: string): string {
  return marketKey?.toLowerCase() === "saudi" ? "/sa/dashboard" : "/dashboard";
}

/**
 * Returns the correct login URL for a given market key.
 */
export function loginUrl(marketKey: string): string {
  return marketKey?.toLowerCase() === "saudi" ? "/sa/login" : "/login";
}

/**
 * Returns the correct signup URL for a given market key.
 */
export function signupUrl(marketKey: string): string {
  return marketKey?.toLowerCase() === "saudi" ? "/sa/signup" : "/signup";
}

/**
 * Detects market from a URL pathname.
 * /sa/anything → "saudi"
 * anything else → "global"
 */
export function marketFromPathname(pathname: string): "saudi" | "global" {
  return pathname.startsWith("/sa/") || pathname === "/sa" ? "saudi" : "global";
}
