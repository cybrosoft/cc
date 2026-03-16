// app/api/cron/daily/route.ts
// Daily cron job — runs at midnight via Vercel cron or external scheduler.
// Checks: subscription expiry warnings + invoice overdue alerts.
//
// Vercel cron config (add to vercel.json):
// {
//   "crons": [{ "path": "/api/cron/daily", "schedule": "0 0 * * *" }]
// }
//
// Security: protected by CRON_SECRET env var.
// Set CRON_SECRET in your environment and pass as Authorization header.
// Vercel sets this automatically when using vercel.json crons.

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendNotification, EVENT_TYPES } from "@/lib/notifications/send";
import {
  buildSubscriptionVars,
  buildInvoiceVars,
} from "@/lib/notifications/templates";

export async function GET(req: NextRequest) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    expiryWarnings:  0,
    overdueInvoices: 0,
    scheduledBroadcasts: 0,
    errors:          [] as string[],
  };

  const baseUrl    = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const portalName = await prisma.portalSetting
    .findUnique({ where: { key: "portal.name" } })
    .then(r => r?.value ?? "Cybrosoft Cloud Console");

  // ── 1. Load notification thresholds ────────────────────────────────────────
  const [expiryDaysSetting, overdueDaysSetting] = await Promise.all([
    prisma.portalSetting.findUnique({ where: { key: "notif.expiryDays" } }),
    prisma.portalSetting.findUnique({ where: { key: "notif.paymentDays" } }),
  ]);

  const expiryWarnDays = Number(expiryDaysSetting?.value ?? "7");
  const overdueGraceDays = Number(overdueDaysSetting?.value ?? "3");

  // ── 2. Subscription expiry warnings ────────────────────────────────────────
  try {
    const warnBefore = new Date();
    warnBefore.setDate(warnBefore.getDate() + expiryWarnDays);
    const now = new Date();

    const expiring = await prisma.subscription.findMany({
      where: {
        status:            "ACTIVE",
        currentPeriodEnd:  { gte: now, lte: warnBefore },
      },
      include: {
        user:    { select: { id: true, fullName: true, email: true, mobile: true, market: { select: { key: true, defaultCurrency: true } } } },
        product: { select: { name: true } },
      },
    });

    for (const sub of expiring) {
      try {
        const daysUntil = sub.currentPeriodEnd
          ? Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        // Avoid duplicate — check if already notified today
        const alreadySent = await prisma.notification.findFirst({
          where: {
            userId:    sub.userId,
            eventType: EVENT_TYPES.SUBSCRIPTION_EXPIRING,
            createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
          },
        });
        if (alreadySent) continue;

        const vars = buildSubscriptionVars({
          customer:     sub.user,
          subscription: sub,
          product:      sub.product ?? { name: "Cloud Service" },
          portalName,
          baseUrl,
          daysUntil,
        });

        await sendNotification({
          userId:    sub.userId,
          eventType: EVENT_TYPES.SUBSCRIPTION_EXPIRING,
          variables: vars,
          link:      `${baseUrl}/dashboard/subscriptions`,
        });

        results.expiryWarnings++;
      } catch (e: any) {
        results.errors.push(`Sub expiry ${sub.id}: ${e.message}`);
      }
    }
  } catch (e: any) {
    results.errors.push(`Expiry check: ${e.message}`);
  }

  // ── 3. Overdue invoice alerts ───────────────────────────────────────────────
  try {
    const overdueThreshold = new Date();
    overdueThreshold.setDate(overdueThreshold.getDate() - overdueGraceDays);

    const overdueInvoices = await prisma.salesDocument.findMany({
      where: {
        type:    "INVOICE",
        status:  { in: ["ISSUED", "SENT", "PARTIAL"] },
        dueDate: { lt: overdueThreshold },
      },
      include: {
        customer: {
          select: {
            id: true, fullName: true, email: true, mobile: true,
            market: { select: { key: true, defaultCurrency: true } },
          },
        },
      },
    });

    for (const inv of overdueInvoices) {
      try {
        // Avoid duplicate — check if already notified today
        const alreadySent = await prisma.notification.findFirst({
          where: {
            userId:    inv.customerId,
            eventType: EVENT_TYPES.INVOICE_OVERDUE,
            createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          },
        });
        if (alreadySent) continue;

        // Mark invoice as overdue
        await prisma.salesDocument.update({
          where: { id: inv.id },
          data:  { status: "OVERDUE" },
        }).catch(() => {});

        const vars = buildInvoiceVars({
          customer:   inv.customer,
          doc:        { docNum: inv.docNum, total: inv.total, currency: inv.currency, dueDate: inv.dueDate },
          portalName,
          baseUrl,
        });

        await sendNotification({
          userId:     inv.customerId,
          eventType:  EVENT_TYPES.INVOICE_OVERDUE,
          variables:  vars,
          link:       `${baseUrl}/dashboard/invoices/${inv.docNum}`,
          forceSms:   true,  // always SMS for overdue (locked channel)
        });

        results.overdueInvoices++;
      } catch (e: any) {
        results.errors.push(`Invoice overdue ${inv.id}: ${e.message}`);
      }
    }
  } catch (e: any) {
    results.errors.push(`Overdue check: ${e.message}`);
  }

  // ── 4. Scheduled broadcasts ─────────────────────────────────────────────────
  try {
    const { sendBroadcast } = await import("@/lib/notifications/send");

    const scheduled = await prisma.notificationBroadcast.findMany({
      where: {
        sentAt:      null,
        scheduledAt: { lte: new Date() },
      },
    });

    for (const broadcast of scheduled) {
      try {
        const userIds = await resolveTargetUsers(broadcast.targetType, broadcast.targetId ?? undefined);

        await sendBroadcast({
          broadcastId:  broadcast.id,
          title:        broadcast.title,
          body:         broadcast.body,
          emailSubject: broadcast.emailSubject ?? broadcast.title,
          smsBody:      broadcast.smsBody      ?? broadcast.body,
          channels:     broadcast.channels,
          userIds,
        });

        results.scheduledBroadcasts++;
      } catch (e: any) {
        results.errors.push(`Broadcast ${broadcast.id}: ${e.message}`);
      }
    }
  } catch (e: any) {
    results.errors.push(`Scheduled broadcasts: ${e.message}`);
  }

  console.log("[cron/daily] Completed:", results);

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...results,
  });
}

// ── Target resolution helper (duplicated from send route for independence) ───

async function resolveTargetUsers(targetType: string, targetId?: string): Promise<string[]> {
  const baseWhere = { role: "CUSTOMER" as const };
  switch (targetType) {
    case "customer": return targetId ? [targetId] : [];
    case "group": {
      if (!targetId) return [];
      return (await prisma.user.findMany({ where: { ...baseWhere, customerGroupId: targetId }, select: { id: true } })).map(u => u.id);
    }
    case "market": {
      if (!targetId) return [];
      return (await prisma.user.findMany({ where: { ...baseWhere, marketId: targetId }, select: { id: true } })).map(u => u.id);
    }
    case "all":
      return (await prisma.user.findMany({ where: baseWhere, select: { id: true } })).map(u => u.id);
    default: return [];
  }
}
