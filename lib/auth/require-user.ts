// FILE: lib/auth/require-user.ts
import { redirect } from "next/navigation";
import type { Role, User } from "@prisma/client";
import { getSessionUser } from "@/lib/auth/get-session-user";

type CurrentUser = Pick<
  User,
  "id" | "email" | "role" | "marketId" | "customerGroupId" | "customerNumber"
>;

async function getUserFromSessionCookie(): Promise<CurrentUser | null> {
  const u = await getSessionUser();
  if (!u) return null;

  return {
    id: u.id,
    email: u.email,
    role: u.role,
    marketId: u.marketId,
    customerGroupId: u.customerGroupId,
    customerNumber: u.customerNumber,
  };
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getUserFromSessionCookie();

  // ✅ For admin/server pages: redirect instead of throwing runtime error overlay
  if (!user) redirect("/login");

  return user;
}

export async function requireRole(allowed: ReadonlyArray<Role>): Promise<CurrentUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) redirect("/"); // or "/admin" if you prefer
  return user;
}