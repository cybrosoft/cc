// app/api/customer/dashboard/route.ts
// Now reads from the cache layer. Fast on repeat visits.
// Cache is busted by admin/customer mutation routes via revalidateTag().

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import {
  getCachedCustomerData,
  getCachedCustomerNotifs,
  getCachedServerDetails,
} from "@/lib/cache/customer-cache";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // ── Last login: most recent session before current ────────────────────────
  // Not cached — always fresh (it's a single indexed query, ~1ms)
  let lastLogin: string | null = null;
  try {
    const { prisma } = await import("@/lib/prisma");
    const prevSession = await prisma.session.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      skip: 1,
      select: { createdAt: true },
    });
    lastLogin = prevSession?.createdAt?.toISOString() ?? null;
  } catch { /* session query failed */ }

  // ── All three cached fetches run in parallel ──────────────────────────────
  // core data + notifs: served from cache after first load (~1ms)
  // server details: cached separately with 60s TTL
  const [coreData, notifsData, serverDetails] = await Promise.all([
    getCachedCustomerData(user.id),
    getCachedCustomerNotifs(user.id),
    getCachedServerDetails(user.id),
  ]);

  // ── Merge live server details into the server list ────────────────────────
  // Core data has DB-only server records; serverDetails has live IP/status/specs.
  // We merge by id so the dashboard gets everything in one response.
  const detailsMap = new Map(serverDetails.map(d => [d.id, d]));

  const mergedServers = coreData.servers.map(s => ({
    ...s,
    ipv4:     detailsMap.get(s.id)?.ipv4     ?? null,
    status:   detailsMap.get(s.id)?.status   ?? null,
    location: detailsMap.get(s.id)?.location ?? s.oracleInstanceRegion ?? null,
    vcpus:    detailsMap.get(s.id)?.vcpus    ?? null,
    ramGb:    detailsMap.get(s.id)?.ramGb    ?? null,
    diskGb:   detailsMap.get(s.id)?.diskGb   ?? null,
  }));

  return NextResponse.json({
    stats:           coreData.stats,
    servers:         mergedServers,
    subscriptions:   coreData.subscriptions,
    recentActivity:  coreData.recentActivity,
    notifications:   notifsData.notifications,
    unreadNotifCount:notifsData.unreadCount,
    lastLogin,
  });
}
