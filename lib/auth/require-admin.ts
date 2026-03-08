// FILE: lib/auth/require-admin.ts
import { getSessionUser } from "@/lib/auth/get-session-user";

export async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { ok: false as const, error: "UNAUTHORIZED" as const };

  // ✅ Allow STAFF too (you already have STAFF in schema)
  const isAdminOrStaff = user.role === "ADMIN" || user.role === "STAFF";
  if (!isAdminOrStaff) return { ok: false as const, error: "FORBIDDEN" as const };

  return { ok: true as const, user };
}