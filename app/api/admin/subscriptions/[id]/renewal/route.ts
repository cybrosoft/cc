// app/api/admin/subscriptions/[id]/renewal/route.ts
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { BillingPeriod, PaymentStatus, SubscriptionStatus } from "@prisma/client";

function s(v: unknown): string { return typeof v === "string" ? v : ""; }

// Calculate next period end based on billing period
function calcPeriodEnd(start: Date, billingPeriod: string): Date {
  const d = new Date(start);
  switch (billingPeriod) {
    case "MONTHLY":    d.setMonth(d.getMonth() + 1);    break;
    case "SIX_MONTHS": d.setMonth(d.getMonth() + 6);    break;
    case "YEARLY":     d.setFullYear(d.getFullYear() + 1); break;
    case "ONE_TIME":   d.setFullYear(d.getFullYear() + 99); break;
    default:           d.setFullYear(d.getFullYear() + 1);
  }
  return d;
}

// GET — fetch renewal info: current period, history, resolved prices, addons
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;

  const sub = await prisma.subscription.findUnique({
    where:  { id },
    select: {
      id: true, status: true, billingPeriod: true, paymentStatus: true,
      autoRenew: true, renewalBillingPeriod: true, renewalPriceCents: true,
      currentPeriodStart: true, currentPeriodEnd: true,
      marketId: true, productId: true,
      user: { select: { id: true, customerGroupId: true } },
      market: { select: { defaultCurrency: true } },
      product: { select: { id: true, name: true, billingPeriods: true } },
      childSubscriptions: {
        where:  { status: { not: SubscriptionStatus.CANCELED } },
        select: {
          id: true, productId: true, status: true, paymentStatus: true, quantity: true,
          product: { select: { id: true, name: true, key: true, addonPricingType: true, addonPercentage: true } },
        },
      },
      renewals: {
        orderBy: { createdAt: "desc" },
        take:    20,
        select: {
          id: true, periodStart: true, periodEnd: true, billingPeriod: true,
          priceCents: true, addonsCents: true, totalCents: true, currency: true,
          overrideCents: true, overrideNote: true, isAutomatic: true,
          notes: true, createdAt: true, renewedAddonIds: true,
          renewedBy: { select: { id: true, fullName: true, email: true } },
        },
      },
    },
  });

  if (!sub)
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const cgId     = sub.user.customerGroupId;
  const currency = sub.market.defaultCurrency ?? "SAR";
  const renewBp  = sub.renewalBillingPeriod ?? sub.billingPeriod;

  // Resolve plan price for renewal billing period
  const planPricing = cgId ? await prisma.pricing.findFirst({
    where: { productId: sub.productId, marketId: sub.marketId, customerGroupId: cgId, billingPeriod: renewBp, isActive: true },
    select: { priceCents: true },
  }) : null;

  // Resolve all available billing periods with prices
  const allPricing = cgId ? await prisma.pricing.findMany({
    where: { productId: sub.productId, marketId: sub.marketId, customerGroupId: cgId, isActive: true },
    select: { billingPeriod: true, priceCents: true },
  }) : [];

  // Resolve addon prices
  const addonPrices: { id: string; name: string; key: string; priceCents: number | null; qty: number }[] = [];
  for (const addon of sub.childSubscriptions) {
    let price: number | null = null;
    if (addon.product.addonPricingType === "percentage") {
      const planCents = sub.renewalPriceCents ?? planPricing?.priceCents ?? 0;
      price = Math.round(planCents * (Number(addon.product.addonPercentage ?? 0) / 100));
    } else {
      const ap = cgId ? await prisma.pricing.findFirst({
        where: { productId: addon.productId, marketId: sub.marketId, customerGroupId: cgId, billingPeriod: renewBp, isActive: true },
        select: { priceCents: true },
      }) : null;
      price = ap ? ap.priceCents * (addon.quantity ?? 1) : null;
    }
    addonPrices.push({ id: addon.id, name: addon.product.name, key: addon.product.key, priceCents: price, qty: addon.quantity ?? 1 });
  }

  const planCents   = sub.renewalPriceCents ?? planPricing?.priceCents ?? null;
  const addonTotal  = addonPrices.reduce((a, b) => a + (b.priceCents ?? 0), 0);
  const grandTotal  = planCents != null ? planCents + addonTotal : null;

  // Next period
  const nextStart = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : new Date();
  const nextEnd   = calcPeriodEnd(nextStart, renewBp);

  return NextResponse.json({
    ok: true,
    data: {
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd:   sub.currentPeriodEnd,
      autoRenew:          sub.autoRenew,
      billingPeriod:      sub.billingPeriod,
      renewalBillingPeriod: renewBp,
      renewalPriceCents:  sub.renewalPriceCents,
      nextPeriodStart:    nextStart,
      nextPeriodEnd:      nextEnd,
      planPriceCents:     planCents,
      addonPrices,
      addonTotalCents:    addonTotal,
      grandTotalCents:    grandTotal,
      currency,
      availablePeriods:   allPricing.map(p => ({ billingPeriod: p.billingPeriod, priceCents: p.priceCents })),
      addons:             sub.childSubscriptions,
      renewals:           sub.renewals,
    },
  });
}

// POST — trigger renewal or update auto-renewal settings
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as {
    action?:              unknown; // "renew" | "update-settings"
    // For "update-settings"
    autoRenew?:           unknown;
    renewalBillingPeriod?: unknown;
    renewalPriceCents?:   unknown;
    // For "renew"
    billingPeriod?:       unknown;
    overridePriceCents?:  unknown;
    overrideNote?:        unknown;
    renewAddonIds?:       unknown; // string[] — which addons to renew
    notes?:               unknown;
    isAutomatic?:         unknown;
  } | null;

  const action = s(body?.action).trim();

  const sub = await prisma.subscription.findUnique({
    where:  { id },
    select: {
      id: true, status: true, billingPeriod: true,
      currentPeriodEnd: true, marketId: true, productId: true,
      userId: true, autoRenew: true,
      user: { select: { customerGroupId: true } },
      market: { select: { defaultCurrency: true } },
      childSubscriptions: {
        where:  { status: { not: SubscriptionStatus.CANCELED } },
        select: { id: true, productId: true, status: true, quantity: true,
                  product: { select: { addonPricingType: true, addonPercentage: true } } },
      },
    },
  });

  if (!sub)
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  // ── Update auto-renewal settings ───────────────────────────────────────────
  if (action === "update-settings") {
    const updateData: Record<string, unknown> = {};

    if (typeof body?.autoRenew === "boolean")
      updateData["autoRenew"] = body.autoRenew;

    const bpRaw = s(body?.renewalBillingPeriod).trim();
    if (bpRaw && Object.values(BillingPeriod).includes(bpRaw as BillingPeriod))
      updateData["renewalBillingPeriod"] = bpRaw as BillingPeriod;

    const overridePrice = typeof body?.renewalPriceCents === "number"
      ? body.renewalPriceCents : null;
    if (overridePrice !== null)
      updateData["renewalPriceCents"] = overridePrice > 0 ? overridePrice : null;

    await prisma.subscription.update({ where: { id }, data: updateData as never });
    return NextResponse.json({ ok: true, action: "settings-updated" });
  }

  // ── Execute renewal ────────────────────────────────────────────────────────
  if (action === "renew") {
    const bpRaw = s(body?.billingPeriod).trim();
    const bp    = Object.values(BillingPeriod).includes(bpRaw as BillingPeriod)
      ? bpRaw as BillingPeriod
      : sub.billingPeriod;

    const cgId     = sub.user.customerGroupId;
    const currency = sub.market.defaultCurrency ?? "SAR";

    // Resolve plan price
    const planPricing = cgId ? await prisma.pricing.findFirst({
      where: { productId: sub.productId, marketId: sub.marketId, customerGroupId: cgId, billingPeriod: bp, isActive: true },
      select: { priceCents: true },
    }) : null;

    const overrideCents = typeof body?.overridePriceCents === "number" && body.overridePriceCents > 0
      ? body.overridePriceCents : null;
    const planCents = overrideCents ?? planPricing?.priceCents ?? 0;

    // Which addons to renew
    const renewAddonIds = Array.isArray(body?.renewAddonIds)
      ? body.renewAddonIds as string[]
      : sub.childSubscriptions.map(a => a.id); // default: all

    // Resolve addon prices
    let addonsTotalCents = 0;
    for (const addon of sub.childSubscriptions.filter(a => renewAddonIds.includes(a.id))) {
      if (addon.product.addonPricingType === "percentage") {
        addonsTotalCents += Math.round(planCents * (Number(addon.product.addonPercentage ?? 0) / 100));
      } else {
        const ap = cgId ? await prisma.pricing.findFirst({
          where: { productId: addon.productId, marketId: sub.marketId, customerGroupId: cgId, billingPeriod: bp, isActive: true },
          select: { priceCents: true },
        }) : null;
        addonsTotalCents += (ap?.priceCents ?? 0) * (addon.quantity ?? 1);
      }
    }

    const totalCents = planCents + addonsTotalCents;

    // Calculate new period
    const newStart = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : new Date();
    const newEnd   = calcPeriodEnd(newStart, bp);

    const isAutomatic = body?.isAutomatic === true;

    // Run in transaction
    await prisma.$transaction(async tx => {
      // 1. Update subscription period + status
      await tx.subscription.update({
        where: { id },
        data:  {
          billingPeriod:      bp,
          currentPeriodStart: newStart,
          currentPeriodEnd:   newEnd,
          status:             SubscriptionStatus.PENDING_PAYMENT,
          paymentStatus:      PaymentStatus.UNPAID,
          invoiceNumber:      null,
          manualPaymentReference: null,
        },
      });

      // 2. Update selected addon subscriptions
      for (const addonId of renewAddonIds) {
        await tx.subscription.update({
          where: { id: addonId },
          data:  {
            billingPeriod:      bp,
            currentPeriodStart: newStart,
            currentPeriodEnd:   newEnd,
            status:             SubscriptionStatus.PENDING_PAYMENT,
            paymentStatus:      PaymentStatus.UNPAID,
          },
        });
      }

      // 3. Write renewal log
      await tx.subscriptionRenewal.create({
        data: {
          subscriptionId:  id,
          periodStart:     newStart,
          periodEnd:       newEnd,
          billingPeriod:   bp,
          priceCents:      planCents,
          addonsCents:     addonsTotalCents,
          totalCents,
          currency,
          overrideCents:   overrideCents,
          overrideNote:    s(body?.overrideNote).trim() || null,
          renewedAddonIds: JSON.stringify(renewAddonIds),
          isAutomatic,
          notes:           s(body?.notes).trim() || null,
          renewedByUserId: isAutomatic ? null : admin.id,
        },
      });

      // 4. Write status log
      await tx.subscriptionStatusLog.create({
        data: {
          subscriptionId:  id,
          status:          SubscriptionStatus.PENDING_PAYMENT,
          comment:         `Renewed for ${bp} — new period: ${newStart.toISOString().split("T")[0]} → ${newEnd.toISOString().split("T")[0]}. Total: ${(totalCents / 100).toFixed(2)} ${currency}`,
          isAutomatic,
          changedByUserId: isAutomatic ? null : admin.id,
        },
      });
    });

    return NextResponse.json({ ok: true, action: "renewed", newStart, newEnd, totalCents, currency });
  }

  return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
}