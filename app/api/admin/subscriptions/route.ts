// app/api/admin/subscriptions/route.ts
export const runtime = "nodejs";

import { NextResponse }        from "next/server";
import { prisma }              from "@/lib/prisma";
import { requireAdmin }        from "@/lib/auth/require-admin";
import { SubscriptionStatus }  from "@prisma/client";

type PaymentStatusFilter = "PAID" | "PENDING" | "";

// ── GET /api/admin/subscriptions ──────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const page         = Math.max(1, Number(searchParams.get("page")     ?? "1"));
    const pageSize     = Math.min(9999, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));
    const email        = searchParams.get("email")         ?? "";
    const marketId     = searchParams.get("marketId")      ?? "";
    const categoryId   = searchParams.get("categoryId")    ?? "";
    const statusParam  = searchParams.get("status")        ?? "";
    const paymentParam = searchParams.get("paymentStatus") ?? "" as PaymentStatusFilter;
    const expiringParam = searchParams.get("expiringDays") ?? "";

    const status = Object.values(SubscriptionStatus).includes(statusParam as SubscriptionStatus)
      ? (statusParam as SubscriptionStatus)
      : undefined;

    const where: Record<string, unknown> = {};

    if (status)    where["status"]   = status;
    if (marketId)  where["marketId"] = marketId;
    if (email)     where["user"]     = { email: { contains: email, mode: "insensitive" as const } };
    if (categoryId) where["product"] = { categoryId };
    if (paymentParam === "PAID")    where["manualPaymentReference"] = { not: null };
    if (paymentParam === "PENDING") where["currentPeriodStart"]     = null;

    if (expiringParam) {
      const days = Number(expiringParam);
      if (Number.isFinite(days) && days > 0) {
        const now = new Date();
        const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
        where["status"]          = SubscriptionStatus.ACTIVE;
        where["currentPeriodEnd"] = { gte: now, lte: end };
      }
    }

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        where: where as never,
        select: {
          id:                  true,
          status:              true,
          paymentStatus:       true,
          billingPeriod:       true,
          createdAt:           true,
          currentPeriodStart:  true,
          currentPeriodEnd:    true,
          receiptUrl:          true,
          productDetails:      true,
          productNote:         true,
          parentSubscriptionId: true,
          parentSubscription: {
            select: {
              id: true,
              status: true,
              product: { select: { id: true, name: true, key: true, type: true } },
            },
          },
          user:    { select: { id: true, email: true } },
          market:  { select: { id: true, name: true } },
          product: {
            select: {
              id: true, name: true, key: true, type: true,
              category: { select: { id: true, name: true, key: true } },
            },
          },
          servers: { select: { id: true, hetznerServerId: true } },
        },
        orderBy: { createdAt: "desc" },
        skip:  (page - 1) * pageSize,
        take:  pageSize,
      }),
      prisma.subscription.count({ where: where as never }),
    ]);

    // Map to match SubRow shape expected by the UI
    const data = subscriptions.map(s => ({
      ...s,
      // UI expects activatedAt — derive from currentPeriodStart presence
      activatedAt: s.currentPeriodStart ?? null,
      // UI expects servers with hetznerServerId
      servers: s.servers.map(sv => ({ ...sv, oracleInstanceId: null })),
    }));

    return NextResponse.json({ ok: true, page, pageSize, total, data });
  } catch (e: any) {
    console.error("[subscriptions/route]", e);
    return NextResponse.json({ ok: false, error: e.message ?? "Failed" }, { status: 500 });
  }
}