// app/api/admin/subscriptions/route.ts
export const runtime = "nodejs";

import { NextResponse }       from "next/server";
import { prisma }             from "@/lib/prisma";
import { getSessionUser }     from "@/lib/auth/get-session-user";
import { SubscriptionStatus } from "@prisma/client";

function s(v: string | null): string { return typeof v === "string" ? v : ""; }

type PaymentStatusFilter = "PAID" | "PENDING";

export async function GET(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page     = Number(s(searchParams.get("page")) || "1");
  const pageSize = Math.min(9999, Math.max(1, Number(s(searchParams.get("pageSize")) || "50")));

  const email            = s(searchParams.get("email")).trim();
  const statusParam      = s(searchParams.get("status")).trim();
  const marketId         = s(searchParams.get("marketId")).trim();
  const categoryId       = s(searchParams.get("categoryId")).trim();
  const paymentStatusParam = s(searchParams.get("paymentStatus")).trim();
  const expiringDaysParam  = s(searchParams.get("expiringDays")).trim();

  const status = statusParam && Object.values(SubscriptionStatus).includes(statusParam as SubscriptionStatus)
    ? (statusParam as SubscriptionStatus)
    : undefined;

  const paymentStatus = paymentStatusParam === "PAID" || paymentStatusParam === "PENDING"
    ? (paymentStatusParam as PaymentStatusFilter)
    : undefined;

  const expiringDays = Number(expiringDaysParam || "0");
  const expiringWindowDays = Number.isFinite(expiringDays) && expiringDays > 0 ? expiringDays : null;

  const where: Record<string, unknown> = {
    ...(status   ? { status }   : {}),
    ...(marketId ? { marketId } : {}),
    ...(email    ? { user: { email: { contains: email, mode: "insensitive" as const } } } : {}),
  };

  if (categoryId) where["product"] = { categoryId };

  // Use currentPeriodStart as proxy for payment (activatedAt was dropped from DB)
  if (paymentStatus === "PAID")    where["currentPeriodStart"] = { not: null };
  if (paymentStatus === "PENDING") where["currentPeriodStart"] = null;

  if (expiringWindowDays) {
    const now = new Date();
    const end = new Date(now.getTime() + expiringWindowDays * 24 * 60 * 60 * 1000);
    where["status"]           = SubscriptionStatus.ACTIVE;
    where["currentPeriodEnd"] = { gte: now, lte: end };
  }

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where:   where as never,
      orderBy: { createdAt: "desc" },
      skip:    (Math.max(1, page) - 1) * pageSize,
      take:    pageSize,
      select: {
        // ── Fields confirmed in current GitHub schema ──
        id:                    true,
        productId:             true,
        marketId:              true,
        userId:                true,
        status:                true,
        paymentStatus:         true,
        billingPeriod:         true,
        createdAt:             true,
        currentPeriodStart:    true,
        currentPeriodEnd:      true,
        receiptUrl:            true,
        invoiceNumber:         true,
        manualPaymentReference: true,
        productDetails:        true,
        productNote:           true,
        parentSubscriptionId:  true,
        locationCode:          true,
        quantity:              true,
        parentSubscription: {
          select: {
            id: true, status: true,
            product: { select: { id: true, name: true, key: true, type: true } },
          },
        },
        user:    { select: { id: true, email: true, fullName: true, customerGroupId: true } },
        market:  { select: { id: true, name: true, defaultCurrency: true } },
        product: {
          select: {
            id: true, name: true, key: true, type: true,
            billingPeriods:   true,
            unitLabel:        true,
            addonPricingType: true,
            addonPercentage:  true,
            tags:             { select: { key: true } },
            category: { select: { id: true, name: true, key: true } },
          },
        },
        servers: { select: { id: true, hetznerServerId: true, oracleInstanceId: true } },
      },
    }),
    prisma.subscription.count({ where: where as never }),
  ]);

  // ── Resolve price from Pricing table ─────────────────────────────────────────
  let resolvedPrices = new Map<string, number>();

  if (subscriptions.length > 0) {
    const productIds = [...new Set(subscriptions.map(s => s.productId))];
    const marketIds  = [...new Set(subscriptions.map(s => s.marketId))];
    const groupIds   = [...new Set(
      subscriptions.map(s => s.user.customerGroupId).filter((v): v is string => v != null)
    )];

    if (groupIds.length > 0 && productIds.length > 0) {
      try {
        const rows = await prisma.pricing.findMany({
          where: {
            productId:       { in: productIds },
            marketId:        { in: marketIds },
            customerGroupId: { in: groupIds },
            // isActive not filtered — include all pricing rows
          },
          select: {
            productId: true, marketId: true,
            customerGroupId: true, billingPeriod: true, priceCents: true,
          },
        });
        for (const r of rows) {
          resolvedPrices.set(
            `${r.productId}|${r.marketId}|${r.customerGroupId}|${r.billingPeriod}`,
            r.priceCents
          );
        }
      } catch {
        // pricing resolution failed — continue without price
      }
    }
  }

  const data = subscriptions.map(s => {
    const cgId = s.user.customerGroupId;
    const key  = `${s.productId}|${s.marketId}|${cgId}|${s.billingPeriod}`;
    return {
      ...s,
      // derived fields for UI
      activatedAt:        s.paymentStatus === "PAID" ? s.currentPeriodStart : null,
      resolvedPriceCents: resolvedPrices.get(key) ?? null,
      // All available prices for this subscription's product across billing periods
      allPrices: (() => {
        const result: Record<string, number> = {};
        if (cgId) {
          for (const bp of ["MONTHLY","SIX_MONTHS","YEARLY","ONE_TIME"]) {
            const k = `${s.productId}|${s.marketId}|${cgId}|${bp}`;
            const v = resolvedPrices.get(k);
            if (v != null) result[bp] = v;
          }
        }
        return result;
      })(),
      currency:           s.market.defaultCurrency ?? "SAR",
      receiptFileName:    null,
      receiptUploadedAt:  null,
    };
  });

  return NextResponse.json({ ok: true, page: Math.max(1, page), pageSize, total, data });
}