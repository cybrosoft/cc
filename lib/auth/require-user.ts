// lib/auth/require-user.ts
// Centralized customer auth + access control.
// Used by ALL customer page layouts and API routes.
// Single source of truth for status-based access rules.

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import type { SessionUser } from "@/lib/auth/get-session-user";

// ── Route access rules per status ────────────────────────────────────────────
// Based on approved access table. Paths are prefix-matched.
// ACTIVE users: full access (no restriction).
// REJECTED: blocked at login. SUSPENDED: allowed — same as PENDING + billing.

const ALWAYS_ALLOWED = [
  "/dashboard",
  "/sa/dashboard",
  "/api/auth/",           // all auth APIs
  "/api/customer/onboarding",
  "/api/geo",
];

const PENDING_ALLOWED = [
  ...ALWAYS_ALLOWED,
  "/dashboard/rfq",
  "/sa/dashboard/rfq",
  "/dashboard/notifications",
  "/sa/dashboard/notifications",
  "/dashboard/profile",
  "/sa/dashboard/profile",
  "/api/auth/totp",           // TOTP setup/disable/status/challenge
  "/api/customer/notifications",
  "/api/customer/profile/read", // Profile GET only — write blocked at API level
];

const INFO_REQUIRED_ALLOWED = [
  ...PENDING_ALLOWED,
  "/dashboard/profile",
  "/sa/dashboard/profile",
  "/api/customer/profile/read",  // read
  "/api/customer/profile/write", // edit — INFO_REQUIRED and ACTIVE only
];

// SUSPENDED: same as PENDING + billing access
const SUSPENDED_ALLOWED = [
  ...PENDING_ALLOWED,
  "/dashboard/invoices",
  "/sa/dashboard/invoices",
  "/dashboard/quotations",
  "/sa/dashboard/quotations",
  "/dashboard/statement",
  "/sa/dashboard/statement",
  "/dashboard/billing",
  "/sa/dashboard/billing",
  "/api/customer/sales",         // billing/sales document APIs
  "/api/customer/invoices",
  "/api/customer/statement",
];

function isAllowed(pathname: string, allowed: string[]): boolean {
  return allowed.some(p => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));
}

function getDashboardUrl(marketKey?: string): string {
  return marketKey?.toLowerCase() === "saudi" ? "/sa/dashboard" : "/dashboard";
}

function getLoginUrl(marketKey?: string): string {
  return marketKey?.toLowerCase() === "saudi" ? "/sa/login" : "/login";
}

// ── Page layout guard — redirects on failure ──────────────────────────────────
export async function requireUser(pathname?: string): Promise<SessionUser> {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  const status = user.status as string;
  const dashboardUrl = getDashboardUrl(user.market?.key);

  // REJECTED — redirect to login
  if (status === "REJECTED") {
    redirect(`${getLoginUrl(user.market?.key)}?reason=rejected`);
  }

  // ACTIVE — full access
  if (status === "ACTIVE") return user;

  // PENDING / INFO_REQUIRED / SUSPENDED — check route if pathname provided
  if (pathname) {
    const allowed =
      status === "INFO_REQUIRED" ? INFO_REQUIRED_ALLOWED :
      status === "SUSPENDED"     ? SUSPENDED_ALLOWED      :
                                   PENDING_ALLOWED;
    if (!isAllowed(pathname, allowed)) {
      redirect(dashboardUrl);
    }
  }

  return user;
}

// ── API route guard — returns 401/403 JSON on failure ────────────────────────
// Use this in API routes instead of requireUser() which redirects (not valid for APIs).
export async function requireUserApi(pathname?: string): Promise<
  { user: SessionUser; error: null } |
  { user: null; error: { message: string; status: number } }
> {
  const user = await getSessionUser();

  if (!user) {
    return { user: null, error: { message: "Unauthorized.", status: 401 } };
  }

  const status = user.status as string;

  if (status === "REJECTED") {
    return { user: null, error: { message: "Account access denied.", status: 403 } };
  }

  if (status === "ACTIVE") {
    return { user, error: null };
  }

  // PENDING / INFO_REQUIRED / SUSPENDED — check route
  if (pathname) {
    const allowed =
      status === "INFO_REQUIRED" ? INFO_REQUIRED_ALLOWED :
      status === "SUSPENDED"     ? SUSPENDED_ALLOWED      :
                                   PENDING_ALLOWED;
    if (!isAllowed(pathname, allowed)) {
      return { user: null, error: { message: "Your account does not have permission to perform this action.", status: 403 } };
    }
  }

  return { user, error: null };
}

// ── Legacy export — kept for backward compatibility ───────────────────────────
export async function requireRole(allowed: ReadonlyArray<string>) {
  const user = await requireUser();
  if (!allowed.includes(user.role)) redirect("/");
  return user;
}
