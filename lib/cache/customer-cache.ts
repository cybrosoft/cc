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

export async function invalidateCustomer(userId: string) {
  revalidateTag(customerTag(userId));
}
export async function invalidateCustomerServers(userId: string) {
  revalidateTag(customerServersTag(userId));
}
export async function invalidateCustomerNotifs(userId: string) {
  revalidateTag(customerNotifsTag(userId));
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
        servers,
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

        // Servers (DB record only — no live provider calls here)
        prisma.server.findMany({
          where: { userId },
          include: {
            subscription: {
              include: {
                product: {
                  select: { name: true, key: true, tags: { select: { key: true } } },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
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

      // ── Serialize servers (DB fields only, no live API) ──────────────────
      const serializedServers = servers.map(s => {
        const tags     = s.subscription?.product?.tags?.map(t => t.key) ?? [];
        const provider = tags.includes("hz") ? "Hetzner"
                       : tags.includes("or") ? "Oracle"
                       : "—";
        return {
          id:                  s.id,
          provider,
          productName:         s.subscription?.product?.name ?? "—",
          productKey:          s.subscription?.product?.key  ?? null,
          subscriptionId:      s.subscriptionId     ?? null,
          hetznerServerId:     s.hetznerServerId    ?? null,
          oracleInstanceId:    s.oracleInstanceId   ?? null,
          oracleInstanceRegion:s.oracleInstanceRegion ?? null,
          createdAt:           s.createdAt.toISOString(),
        };
      });

      return {
        stats: {
          activeSubscriptions,
          expiringSubscriptions,
          pendingInvoices,
          overdueInvoices,
          servers: servers.length,
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
          if (provider === "Oracle" && s.oracleInstanceId) {
            try {
              const { getOracleComputeClient } = await import("@/lib/oracle/client");
              const client   = getOracleComputeClient(s.oracleInstanceRegion ?? "me-jeddah-1");
              const instance = await client.getInstance({ instanceId: s.oracleInstanceId });
              const i        = instance.instance;
              status   = i.lifecycleState ?? null;
              location = s.oracleInstanceRegion ?? null;
              vcpus    = i.shapeConfig?.ocpus ?? null;
              ramGb    = i.shapeConfig?.memoryInGBs ?? null;

              // Get public IP via VNIC
              try {
                const vnics = await client.listVnicAttachments({
                  compartmentId: s.oracleCompartmentOcid ?? i.compartmentId,
                  instanceId: s.oracleInstanceId,
                });
                if (vnics.items?.length) {
                  const vnic = await client.getVnic({ vnicId: vnics.items[0].vnicId });
                  ipv4 = vnic.vnic?.publicIp ?? vnic.vnic?.privateIp ?? null;
                }
              } catch { /* no IP */ }
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
          // Addons linked to this plan
          addons: {
            include: {
              product: { select: { name: true, key: true, type: true, unitLabel: true } },
            },
          },
          // Server linked to this subscription
          server: true,
        },
      });

      if (!sub) return null;

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
        server: sub.server ? {
          id:                   sub.server.id,
          hetznerServerId:      sub.server.hetznerServerId    ?? null,
          oracleInstanceId:     sub.server.oracleInstanceId   ?? null,
          oracleInstanceRegion: sub.server.oracleInstanceRegion ?? null,
        } : null,
        addons: sub.addons.map(a => ({
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
