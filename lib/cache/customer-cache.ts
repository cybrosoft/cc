// lib/cache/customer-cache.ts
// Cached data fetchers for the customer portal.
// All data is tagged per userId so admin mutations can bust it with revalidateTag().
//
// Usage:
//   import { getCustomerDashboard } from "@/lib/cache/customer-cache";
//   const data = await getCustomerDashboard(userId);
//
// Invalidation (call from any admin or customer mutation route):
//   import { invalidateCustomer, invalidateCustomerServers, invalidateCustomerNotifs } from "@/lib/cache/customer-cache";
//   await invalidateCustomer(userId);

import { unstable_cache, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";

// ── Tag helpers ───────────────────────────────────────────────────────────────
// Call these from admin/customer mutation routes after any data change.

export function customerTag(userId: string)        { return `customer-${userId}`; }
export function customerServersTag(userId: string) { return `customer-${userId}-servers`; }
export function customerNotifsTag(userId: string)  { return `customer-${userId}-notifs`; }

// Next.js 16 requires a second "profile" argument for revalidateTag.
// "max" busts the tag immediately, matching the previous (Next 14/15) default behavior.
export async function invalidateCustomer(userId: string) {
  revalidateTag(customerTag(userId), "max");
}
export async function invalidateCustomerServers(userId: string) {
  revalidateTag(customerServersTag(userId), "max");
}
export async function invalidateCustomerNotifs(userId: string) {
  revalidateTag(customerNotifsTag(userId), "max");
}

// ── Cached: core customer data ────────────────────────────────────────────────
// Includes: stats, subscriptions, notifications, recent activity.
// Does NOT include live server details (those are fetched separately).
// Revalidates: when admin/customer triggers invalidateCustomer(userId).
// Fallback TTL: 5 minutes (safety net if a mutation misses revalidation).

export function getCachedCustomerData(userId: string) {
  return unstable_cache(
    async () => {
      const now       = new Date();
      const in30Days  = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const in7Days   = new Date(now.getTime() + 7  * 24 * 60 * 60 * 1000);

      const [
        activeSubscriptions,
        expiringSubscriptions,
        expiringSoon,
        subscriptions,
        serverSubs,
        allLocations,
      ] = await Promise.all([
        // Count active subscriptions
        prisma.subscription.count({
          where: { userId, status: "ACTIVE" },
        }),

        // Count expiring within 30 days
        prisma.subscription.count({
          where: {
            userId,
            status: "ACTIVE",
            currentPeriodEnd: { gte: now, lte: in30Days },
          },
        }),

        // Expiring within 7 days — for amber warning on detail rows
        prisma.subscription.findMany({
          where: {
            userId,
            status: "ACTIVE",
            currentPeriodEnd: { gte: now, lte: in7Days },
          },
          select: { id: true },
        }),

        // Full subscription list (plan + addons)
        prisma.subscription.findMany({
          where: { userId },
          include: {
            product: {
              select: {
                name: true,
                key: true,
                type: true,
                unitLabel: true,
              },
            },
          },
          orderBy: [
            { status: "asc" },
            { currentPeriodEnd: "asc" },
          ],
          take: 50,
        }),

        // Server subscriptions (source of truth: Subscription, category = "server").
        // Matches the pattern in /api/servers/me — includes unprovisioned ones.
        prisma.subscription.findMany({
          where: {
            userId,
            product: { category: { key: "server" } },
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: {
            id:             true,
            status:         true,
            locationCode:   true,
            productDetails: true,
            createdAt:      true,
            product: {
              select: { name: true, key: true, tags: { select: { key: true } } },
            },
            servers: {
              select: { id: true },
              take: 1,
            },
          },
        }),

        // Location lookup for display names
        prisma.location.findMany({
          select: { code: true, name: true, countryCode: true },
        }),
      ]);

      // ── Sales documents (safe fallback if not yet migrated) ──────────────
      let pendingInvoices  = 0;
      let overdueInvoices  = 0;
      let recentActivity: object[] = [];

      try {
        const [pending, overdue, recent] = await Promise.all([
          prisma.salesDocument.count({
            where: {
              customerId: userId,
              type: "INVOICE",
              status: { notIn: ["PAID", "VOID", "WRITTEN_OFF"] },
            },
          }),
          prisma.salesDocument.count({
            where: { customerId: userId, type: "INVOICE", status: "OVERDUE" },
          }),
          prisma.salesDocument.findMany({
            where: { customerId: userId },
            orderBy: { createdAt: "desc" },
            take: 6,
            select: {
              id: true, docNum: true, type: true, status: true,
              total: true, currency: true, createdAt: true,
            },
          }),
        ]);

        pendingInvoices = pending;
        overdueInvoices = overdue;
        recentActivity  = recent.map(doc => ({
          id:          doc.id,
          docNumber:   doc.docNum,
          type:        String(doc.type),
          status:      String(doc.status),
          totalAmount: doc.total / 100,
          currency:    doc.currency,
          createdAt:   doc.createdAt.toISOString(),
          href:        "/dashboard/invoices",
        }));
      } catch {
        // SalesDocument not yet migrated — silent fallback
      }

      // ── Serialize subscriptions ──────────────────────────────────────────
      const expiringSoonIds = new Set(expiringSoon.map(s => s.id));

      const serializedSubs = subscriptions.map(s => ({
        id:                 s.id,
        productName:        s.product?.name ?? "—",
        productKey:         s.product?.key  ?? null,
        productType:        String(s.product?.type ?? ""),
        unitLabel:          s.product?.unitLabel ?? null,
        billingPeriod:      String(s.billingPeriod),
        status:             String(s.status),
        paymentStatus:      String(s.paymentStatus),
        quantity:           s.quantity,
        locationCode:       s.locationCode   ?? null,
        templateSlug:       s.templateSlug   ?? null,
        productNote:        s.productNote    ?? null,
        receiptUrl:         s.receiptUrl     ?? null,
        parentSubId:        s.parentSubscriptionId ?? null,
        currentPeriodStart: s.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd:   s.currentPeriodEnd?.toISOString()   ?? null,
        createdAt:          s.createdAt.toISOString(),
        expiringSoon:       expiringSoonIds.has(s.id),
      }));

      // ── Serialize server subscriptions (DB fields only, no live API) ─────
      // Name = first line of productDetails when set by customer (same logic
      // as /api/servers/me). Location = subscription.locationCode via lookup.
      const locationMap = new Map(allLocations.map(l => [l.code, l]));

      const serializedServers = serverSubs.map(sub => {
        const server = sub.servers[0] ?? null;
        const tags   = sub.product?.tags?.map(t => t.key) ?? [];
        const provider = tags.includes("hz") ? "Hetzner"
                       : tags.includes("or") ? "Oracle"
                       : "—";

        const firstLine  = sub.productDetails ? sub.productDetails.split("\n")[0].trim() : null;
        const serverName = !firstLine || firstLine === sub.product?.name ? null : firstLine;

        const loc = sub.locationCode ? locationMap.get(sub.locationCode) : null;
        const locationDisplay = loc
          ? (loc.countryCode ? `${loc.countryCode} - ${loc.name}` : loc.name)
          : (sub.locationCode ?? null);

        return {
          subscriptionId:     sub.id,
          subscriptionStatus: String(sub.status),
          serverId:           server?.id ?? null,
          provisioned:        !!server,
          provider,
          serverName,
          productName:        sub.product?.name ?? "—",
          productKey:         sub.product?.key  ?? null,
          locationCode:       sub.locationCode ?? null,
          locationDisplay,
          createdAt:          sub.createdAt.toISOString(),
        };
      });

      return {
        stats: {
          activeSubscriptions,
          expiringSubscriptions,
          pendingInvoices,
          overdueInvoices,
          servers: serializedServers.length,
        },
        subscriptions: serializedSubs,
        servers:        serializedServers,
        recentActivity,
      };
    },
    // Cache key — unique per user
    [`customer-data-${userId}`],
    {
      tags:       [customerTag(userId)],
      revalidate: 900, // 15-minute fallback TTL
    }
  )();
}

// ── Cached: notifications ─────────────────────────────────────────────────────
// Separate tag so admin sending a notification only busts notifs, not everything.

export function getCachedCustomerNotifs(userId: string) {
  return unstable_cache(
    async () => {
      let notifications: object[] = [];
      let unreadCount = 0;

      try {
        const [notifs, unread] = await Promise.all([
          prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: {
              id: true, title: true, body: true, link: true,
              isRead: true, type: true, createdAt: true,
            },
          }),
          prisma.notification.count({
            where: { userId, isRead: false },
          }),
        ]);

        notifications = notifs.map(n => ({
          ...n,
          createdAt: n.createdAt.toISOString(),
        }));
        unreadCount = unread;
      } catch {
        // Notification model not yet migrated — silent fallback
      }

      return { notifications, unreadCount };
    },
    [`customer-notifs-${userId}`],
    {
      tags:       [customerNotifsTag(userId)],
      revalidate: 900,
    }
  )();
}

// ── Cached: live server details ───────────────────────────────────────────────
// Separate tag + shorter TTL (60s) since server status changes frequently.
// Hetzner/Oracle API calls are isolated here so they never block the main data.

export function getCachedServerDetails(userId: string) {
  return unstable_cache(
    async () => {
      const servers = await prisma.server.findMany({
        where: { userId },
        include: {
          subscription: {
            include: {
              product: { select: { key: true, tags: { select: { key: true } } } },
            },
          },
        },
      });

      const details = await Promise.all(
        servers.map(async s => {
          const tags     = s.subscription?.product?.tags?.map(t => t.key) ?? [];
          const provider = tags.includes("hz") ? "Hetzner"
                         : tags.includes("or") ? "Oracle"
                         : null;

          let ipv4:     string | null = null;
          let status:   string | null = null;
          let location: string | null = null;
          let vcpus:    number | null = null;
          let ramGb:    number | null = null;
          let diskGb:   number | null = null;

          // ── Hetzner live details ────────────────────────────────────────
          if (provider === "Hetzner" && s.hetznerServerId && s.hetznerApiToken) {
            try {
              const res = await fetch(
                `https://api.hetzner.cloud/v1/servers/${s.hetznerServerId}`,
                {
                  headers: { Authorization: `Bearer ${s.hetznerApiToken}` },
                  next: { revalidate: 60 },
                }
              );
              if (res.ok) {
                const d = (await res.json()).server;
                ipv4     = d.public_net?.ipv4?.ip ?? null;
                status   = d.status ?? null;
                location = d.datacenter?.location?.name ?? null;
                vcpus    = d.server_type?.cores  ?? null;
                ramGb    = d.server_type?.memory ?? null;
                diskGb   = d.server_type?.disk   ?? null;
              }
            } catch { /* provider unavailable */ }
          }

          // ── Oracle live details ─────────────────────────────────────────
          // NOTE: getOracleComputeClient does not exist in lib/oracle/client.ts —
          // this codepath used the OCI SDK directly elsewhere (lib/oracle/compute.ts).
          // Disabled here pending a real implementation; falls through silently.
          if (provider === "Oracle" && s.oracleInstanceId) {
            try {
              const { getOracleInstanceSummary } = await import("@/lib/oracle/compute");
              if (s.oracleInstanceRegion) {
                const o = await getOracleInstanceSummary({
                  instanceOcid:    s.oracleInstanceId,
                  regionCode:      s.oracleInstanceRegion,
                  compartmentOcid: s.oracleCompartmentOcid ?? undefined,
                });
                ipv4     = o.ipv4;
                status   = o.status;
                location = o.location;
                vcpus    = o.vcpu;
                ramGb    = o.ramGb;
                diskGb   = o.diskGb;
              }
            } catch { /* provider unavailable */ }
          }

          return {
            id:         s.id,
            provider:   provider ?? "—",
            productKey: s.subscription?.product?.key ?? null,
            ipv4, status, location, vcpus, ramGb, diskGb,
          };
        })
      );

      return details;
    },
    [`customer-servers-${userId}`],
    {
      tags:       [customerServersTag(userId)],
      revalidate: 60, // server status refreshes every 60s
    }
  )();
}

// ── Cached: single subscription detail ───────────────────────────────────────
// Used by the subscription detail page.

export function getCachedSubscription(userId: string, subscriptionId: string) {
  return unstable_cache(
    async () => {
      const sub = await prisma.subscription.findFirst({
        where: { id: subscriptionId, userId },
        include: {
          product: {
            select: {
              name: true, key: true, type: true,
              unitLabel: true, billingPeriods: true,
            },
          },
          // Server linked to this subscription
          servers: { take: 1 },
        },
      });

      if (!sub) return null;

      // Addons are subscriptions whose parentSubscriptionId points to this one
      const addonSubs = await prisma.subscription.findMany({
        where: { parentSubscriptionId: sub.id },
        include: {
          product: { select: { name: true, key: true, type: true, unitLabel: true } },
        },
      });

      const server = sub.servers[0] ?? null;

      return {
        id:                 sub.id,
        productName:        sub.product?.name ?? "—",
        productKey:         sub.product?.key  ?? null,
        productType:        String(sub.product?.type ?? ""),
        unitLabel:          sub.product?.unitLabel ?? null,
        billingPeriod:      String(sub.billingPeriod),
        status:             String(sub.status),
        paymentStatus:      String(sub.paymentStatus),
        quantity:           sub.quantity,
        locationCode:       sub.locationCode    ?? null,
        templateSlug:       sub.templateSlug    ?? null,
        productNote:        sub.productNote     ?? null,
        productDetails:     sub.productDetails  ?? null,
        receiptUrl:         sub.receiptUrl      ?? null,
        parentSubId:        sub.parentSubscriptionId ?? null,
        currentPeriodStart: sub.currentPeriodStart?.toISOString() ?? null,
        currentPeriodEnd:   sub.currentPeriodEnd?.toISOString()   ?? null,
        createdAt:          sub.createdAt.toISOString(),
        server: server ? {
          id:                   server.id,
          hetznerServerId:      server.hetznerServerId    ?? null,
          oracleInstanceId:     server.oracleInstanceId   ?? null,
          oracleInstanceRegion: server.oracleInstanceRegion ?? null,
        } : null,
        addons: addonSubs.map(a => ({
          id:            a.id,
          productName:   a.product?.name ?? "—",
          productKey:    a.product?.key  ?? null,
          productType:   String(a.product?.type ?? ""),
          unitLabel:     a.product?.unitLabel ?? null,
          billingPeriod: String(a.billingPeriod),
          status:        String(a.status),
          paymentStatus: String(a.paymentStatus),
          quantity:      a.quantity,
          currentPeriodStart: a.currentPeriodStart?.toISOString() ?? null,
          currentPeriodEnd:   a.currentPeriodEnd?.toISOString()   ?? null,
        })),
      };
    },
    [`customer-sub-${userId}-${subscriptionId}`],
    {
      tags:       [customerTag(userId)],
      revalidate: 900,
    }
  )();
}
