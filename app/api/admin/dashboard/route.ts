// app/api/admin/dashboard/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { SubscriptionStatus } from "@prisma/client";

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

export async function GET() {
  const admin = await getSessionUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

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
          subscription: {
            select: { marketId: true },
          },
          hetznerServerId: true,
        },
      }),
    ]);

  const usersCountMap = new Map<string, number>();
  for (const row of usersByMarket) {
    usersCountMap.set(row.marketId, row._count._all);
  }

  const subsCountMap = new Map<string, Map<SubscriptionStatus, number>>();
  for (const row of subsByMarketAndStatus) {
    const marketId = row.marketId;
    const status = row.status;
    const count = row._count._all;

    if (!subsCountMap.has(marketId)) subsCountMap.set(marketId, new Map());
    subsCountMap.get(marketId)!.set(status, count);
  }

  const serversAssignedMap = new Map<string, number>();
  for (const s of servers) {
    const marketId = s.subscription?.marketId;
    if (!marketId) continue;
    if (!s.hetznerServerId) continue;
    serversAssignedMap.set(
      marketId,
      (serversAssignedMap.get(marketId) ?? 0) + 1
    );
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

  return NextResponse.json({
    ok: true,
    totals,
    rows,
  });
}