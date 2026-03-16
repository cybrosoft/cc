// app/admin/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { AdminHeader } from "@/components/nav/AdminHeader";
import { AdminDashboardClient } from "./AdminDashboardClient";

async function getDashboardStats() {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const [activeSubs, pendingApprovals, expiringSoon, activeServers, totalCustomers, recentSubs] = await Promise.all([
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "PENDING_PAYMENT" } }),
    prisma.subscription.count({ where: { status: "ACTIVE", currentPeriodEnd: { lte: thirtyDaysFromNow, gte: now } } }),
    prisma.server.count(),
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.subscription.findMany({
      take: 8, orderBy: { createdAt: "desc" },
      include: {
        user:    { select: { id: true, email: true, fullName: true, customerNumber: true } },
        product: { select: { name: true } },
        market:  { select: { name: true, key: true, defaultCurrency: true } },
      },
    }),
  ]);
  return {
    activeSubs, pendingApprovals, expiringSoon, activeServers, totalCustomers,
    recentSubs: recentSubs.map(s => ({
      id: s.id,
      customerName: s.user.fullName ?? s.user.email,
      customerEmail: s.user.email,
      customerNumber: s.user.customerNumber ?? "",
      productName: s.product.name,
      marketKey: s.market.key,
      marketName: s.market.name,
      currency: s.market.defaultCurrency,
      status: s.status,
      paymentStatus: s.paymentStatus,
      billingPeriod: s.billingPeriod,
      currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
      createdAt: s.createdAt.toISOString(),
    })),
  };
}

export default async function AdminDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "STAFF") redirect("/dashboard");
  const stats = await getDashboardStats();

  return (
    <>
      <AdminHeader />
      <main className="cy-main-flush" style={{ flex: 1, overflowY: "auto", padding: "24px", background: "#f5f5f5" }}>
        <AdminDashboardClient stats={stats} />
      </main>
    </>
  );
}