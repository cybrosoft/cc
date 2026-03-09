// app/admin/layout.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { AdminNav } from "@/components/nav/AdminNav";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "STAFF") redirect("/dashboard");

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <AdminNav
        userEmail={user.email}
        userName={user.fullName ?? null}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}
