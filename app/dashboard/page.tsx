// app/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";

async function getCustomerData(userId: string) {
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [subs, servers] = await Promise.all([
    prisma.subscription.findMany({
      where:   { userId },
      orderBy: { createdAt: "desc" },
      include: {
        product: { select: { name: true, type: true } }, // nullable — product may be null
        market:  { select: { name: true, key: true, defaultCurrency: true } },
      },
    }),
    prisma.server.findMany({
      where: { userId },
    }),
  ]);

  return {
    subs: subs.map(s => ({
      id:               s.id,
      productName:      s.product?.name ?? "—",
      productType:      s.product?.type ?? "service",
      marketKey:        s.market.key,
      currency:         s.market.defaultCurrency,
      status:           s.status,
      paymentStatus:    s.paymentStatus,
      billingPeriod:    s.billingPeriod,
      currentPeriodEnd: s.currentPeriodEnd?.toISOString() ?? null,
    })),
    serverCount:  servers.length,
    expiringSoon: subs.filter(s =>
      s.status === "ACTIVE" &&
      s.currentPeriodEnd &&
      s.currentPeriodEnd <= thirtyDaysFromNow &&
      s.currentPeriodEnd >= now
    ).length,
    unpaidCount: subs.filter(s => s.paymentStatus === "UNPAID").length,
  };
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const data = await getCustomerData(user.id);

  return (
    <DashboardClient
      user={user}
      subs={data.subs}
      serverCount={data.serverCount}
      expiringSoon={data.expiringSoon}
      unpaidCount={data.unpaidCount}
    />
  );
}