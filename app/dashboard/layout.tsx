// app/dashboard/layout.tsx
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { CustomerNav } from "@/components/nav/CustomerNav";
import { CustomerHeader } from "@/components/nav/CustomerHeader";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user) redirect("/login");

  // Admins who land on /dashboard → redirect to admin
  if (user.role === "ADMIN" || user.role === "STAFF") redirect("/admin");

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <CustomerNav
        userEmail={user.email}
        userName={user.fullName ?? null}
        customerNumber={user.customerNumber ?? null}
      />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <CustomerHeader />
        <main style={{ flex: 1, overflowY: "auto", background: "#f5f5f5" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
