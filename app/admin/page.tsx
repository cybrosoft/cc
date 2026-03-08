// app/admin/page.tsx
export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { SubscriptionStatus } from "@prisma/client";
import { redirect } from "next/navigation";

type MarketRow = {
  marketId: string;
  marketKey: string;
  marketName: string;
  users: number;
  activeSubs: number;
  pendingPaymentSubs: number;
  pendingExternalSubs: number;
  canceledSubs: number;
  serversAssigned: number;
};

export default async function AdminDashboardPage() {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") redirect("/login");

  const [markets, usersByMarket, subsByMarketAndStatus, servers] =
    await Promise.all([
      prisma.market.findMany({
        where: { isActive: true },
        select: { id: true, key: true, name: true },
        orderBy: { name: "asc" },
      }),

      prisma.user.groupBy({
        by: ["marketId"],
        _count: { _all: true },
      }),

      prisma.subscription.groupBy({
        by: ["marketId", "status"],
        _count: { _all: true },
      }),

      prisma.server.findMany({
        where: { subscriptionId: { not: null } },
        select: {
          subscription: { select: { marketId: true } },
          hetznerServerId: true,
        },
      }),
    ]);

  const usersCountMap = new Map<string, number>();
  for (const row of usersByMarket) usersCountMap.set(row.marketId, row._count._all);

  const subsCountMap = new Map<string, Map<SubscriptionStatus, number>>();
  for (const row of subsByMarketAndStatus) {
    if (!subsCountMap.has(row.marketId)) subsCountMap.set(row.marketId, new Map());
    subsCountMap.get(row.marketId)!.set(row.status, row._count._all);
  }

  const serversAssignedMap = new Map<string, number>();
  for (const s of servers) {
    const marketId = s.subscription?.marketId;
    if (!marketId) continue;
    if (!s.hetznerServerId) continue;
    serversAssignedMap.set(marketId, (serversAssignedMap.get(marketId) ?? 0) + 1);
  }

  const rows: MarketRow[] = markets.map((m) => {
    const s = subsCountMap.get(m.id) ?? new Map<SubscriptionStatus, number>();
    return {
      marketId: m.id,
      marketKey: m.key,
      marketName: m.name,
      users: usersCountMap.get(m.id) ?? 0,
      activeSubs: s.get(SubscriptionStatus.ACTIVE) ?? 0,
      pendingPaymentSubs: s.get(SubscriptionStatus.PENDING_PAYMENT) ?? 0,
      pendingExternalSubs: s.get(SubscriptionStatus.PENDING_EXTERNAL) ?? 0,
      canceledSubs: s.get(SubscriptionStatus.CANCELED) ?? 0,
      serversAssigned: serversAssignedMap.get(m.id) ?? 0,
    };
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.users += r.users;
      acc.activeSubs += r.activeSubs;
      acc.pendingPaymentSubs += r.pendingPaymentSubs;
      acc.pendingExternalSubs += r.pendingExternalSubs;
      acc.canceledSubs += r.canceledSubs;
      acc.serversAssigned += r.serversAssigned;
      return acc;
    },
    {
      users: 0,
      activeSubs: 0,
      pendingPaymentSubs: 0,
      pendingExternalSubs: 0,
      canceledSubs: 0,
      serversAssigned: 0,
    }
  );

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Card title="Users" value={totals.users} />
        <Card title="Active Subs" value={totals.activeSubs} />
        <Card title="Pending Payment" value={totals.pendingPaymentSubs} />
        <Card title="Pending External" value={totals.pendingExternalSubs} />
        <Card title="Canceled" value={totals.canceledSubs} />
        <Card title="Servers Assigned" value={totals.serversAssigned} />
      </div>

      <div className="rounded-lg border bg-white">
        <div className="border-b px-4 py-3 font-medium">By Market</div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2">Market</th>
                <th className="px-4 py-2">Users</th>
                <th className="px-4 py-2">Active</th>
                <th className="px-4 py-2">Pending Pay</th>
                <th className="px-4 py-2">Pending Ext</th>
                <th className="px-4 py-2">Canceled</th>
                <th className="px-4 py-2">Servers</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.marketId} className="border-t">
                  <td className="px-4 py-2">
                    <div className="font-medium">{r.marketName}</div>
                    <div className="text-xs text-gray-500">{r.marketKey}</div>
                  </td>
                  <td className="px-4 py-2">{r.users}</td>
                  <td className="px-4 py-2">{r.activeSubs}</td>
                  <td className="px-4 py-2">{r.pendingPaymentSubs}</td>
                  <td className="px-4 py-2">{r.pendingExternalSubs}</td>
                  <td className="px-4 py-2">{r.canceledSubs}</td>
                  <td className="px-4 py-2">{r.serversAssigned}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={7}>
                    No markets found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3">
      <div className="text-xs text-gray-500">{title}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}