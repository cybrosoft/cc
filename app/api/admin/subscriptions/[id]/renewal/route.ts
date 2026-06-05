// app/api/admin/subscriptions/[id]/renewal/route.ts
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { BillingPeriod, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import {
  createSubscriptionInvoice,
  buildRenewalLine,
} from "@/lib/sales/create-subscription-invoice";

function s(v: unknown): string { return typeof v === "string" ? v : ""; }

function calcPeriodEnd(start: Date, billingPeriod: string): Date {
  const d = new Date(start);
  switch (billingPeriod) {
    case "MONTHLY":    d.setMonth(d.getMonth() + 1);       break;
    case "SIX_MONTHS": d.setMonth(d.getMonth() + 6);       break;
    case "YEARLY":     d.setFullYear(d.getFullYear() + 1); break;
    case "ONE_TIME":   d.setFullYear(d.getFullYear() + 99); break;
    default:           d.setFullYear(d.getFullYear() + 1);
  }
  return d;
}

// GET — fetch renewal info
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

  const planPricing = cgId ? await prisma.pricing.findFirst({
    where: { productId: sub.productId, marketId: sub.marketId, customerGroupId: cgId, billingPeriod: renewBp, isActive: true },
    select: { priceCents: true },
  }) : null;

  const allPricing = cgId ? await prisma.pricing.findMany({
    where: { productId: sub.productId, marketId: sub.marketId, customerGroupId: cgId, isActive: true },
    select: { billingPeriod: true, priceCents: true },
  }) : [];

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

  const nextStart = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : new Date();
  const nextEnd   = calcPeriodEnd(nextStart, renewBp);

  return NextResponse.json({
    ok: true,
    data: {
      currentPeriodStart:   sub.currentPeriodStart,
      currentPeriodEnd:     sub.currentPeriodEnd,
      autoRenew:            sub.autoRenew,
      billingPeriod:        sub.billingPeriod,
      renewalBillingPeriod: renewBp,
      renewalPriceCents:    sub.renewalPriceCents,
      nextPeriodStart:      nextStart,
      nextPeriodEnd:        nextEnd,
      planPriceCents:       planCents,
      addonPrices,
      addonTotalCents:      addonTotal,
      grandTotalCents:      grandTotal,
      currency,
      availablePeriods:     allPricing.map(p => ({ billingPeriod: p.billingPeriod, priceCents: p.priceCents })),
      addons:               sub.childSubscriptions,
      renewals:             sub.renewals,
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
    action?:               unknown;
    autoRenew?:            unknown;
    renewalBillingPeriod?: unknown;
    renewalPriceCents?:    unknown;
    billingPeriod?:        unknown;
    overridePriceCents?:   unknown;
    overrideNote?:         unknown;
    renewAddonIds?:        unknown;
    notes?:                unknown;
    isAutomatic?:          unknown;
    autoInvoice?:          unknown; // default true
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
      product: { select: { id: true, name: true } },
      childSubscriptions: {
        where:  { status: { not: SubscriptionStatus.CANCELED } },
        select: {
          id: true, productId: true, status: true, quantity: true,
          product: {
            select: {
              id: true, name: true,
              addonPricingType: true, addonPercentage: true,
            },
          },
        },
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

    const cgId        = sub.user.customerGroupId;
    const currency    = sub.market.defaultCurrency ?? "SAR";
    const isAutomatic = body?.isAutomatic === true;
    const autoInvoice = body?.autoInvoice !== false; // default true

    const planPricing = cgId ? await prisma.pricing.findFirst({
      where: { productId: sub.productId, marketId: sub.marketId, customerGroupId: cgId, billingPeriod: bp, isActive: true },
      select: { priceCents: true },
    }) : null;

    const overrideCents = typeof body?.overridePriceCents === "number" && body.overridePriceCents > 0
      ? body.overridePriceCents : null;
    const planCents = overrideCents ?? planPricing?.priceCents ?? 0;

    const renewAddonIds = Array.isArray(body?.renewAddonIds)
      ? body.renewAddonIds as string[]
      : sub.childSubscriptions.map(a => a.id);

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
    const newStart   = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : new Date();
    const newEnd     = calcPeriodEnd(newStart, bp);

    await prisma.$transaction(async tx => {
      await tx.subscription.update({
        where: { id },
        data:  {
          billingPeriod:          bp,
          currentPeriodStart:     newStart,
          currentPeriodEnd:       newEnd,
          status:                 SubscriptionStatus.PENDING_PAYMENT,
          paymentStatus:          PaymentStatus.UNPAID,
          invoiceNumber:          null,
          manualPaymentReference: null,
        },
      });

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

    // ── Auto-generate invoice ─────────────────────────────────────────────────
    let invoiceResult: { ok: boolean; docNum?: string } = { ok: false };

    if (autoInvoice && planCents > 0) {
      const periodStartStr = newStart.toISOString().split("T")[0];
      const periodEndStr   = newEnd.toISOString().split("T")[0];
      const invoiceLines   = [];

      // Plan line
      if (sub.product) {
        invoiceLines.push(buildRenewalLine({
          productId:      sub.product.id,
          productName:    sub.product.name,
          billingPeriod:  bp,
          quantity:       1,
          unitPriceCents: planPricing?.priceCents ?? planCents,
          overrideCents:  overrideCents,
          periodStart:    periodStartStr,
          periodEnd:      periodEndStr,
        }));
      }

      // Addon lines
      for (const addon of sub.childSubscriptions.filter(a => renewAddonIds.includes(a.id))) {
        let addonPrice = 0;
        if (addon.product.addonPricingType === "percentage") {
          addonPrice = Math.round(planCents * (Number(addon.product.addonPercentage ?? 0) / 100));
        } else {
          const ap = cgId ? await prisma.pricing.findFirst({
            where: { productId: addon.productId, marketId: sub.marketId, customerGroupId: cgId, billingPeriod: bp, isActive: true },
            select: { priceCents: true },
          }) : null;
          addonPrice = (ap?.priceCents ?? 0) * (addon.quantity ?? 1);
        }

        if (addonPrice > 0) {
          invoiceLines.push(buildRenewalLine({
            productId:      addon.product.id,
            productName:    addon.product.name,
            billingPeriod:  bp,
            quantity:       addon.quantity ?? 1,
            unitPriceCents: addonPrice,
            periodStart:    periodStartStr,
            periodEnd:      periodEndStr,
          }));
        }
      }

      if (invoiceLines.length > 0) {
        invoiceResult = await createSubscriptionInvoice({
          actorId:         isAutomatic ? sub.userId : admin.id,
          customerId:      sub.userId,
          marketId:        sub.marketId,
          referenceNumber: id,
          subject:         `Renewal — ${isAutomatic ? "Auto" : "Manual"} (${sub.product?.name ?? ""})`,
          internalNote:    isAutomatic ? "Auto-generated on auto-renewal" : undefined,
          lines:           invoiceLines,
        });
      }
    }

    return NextResponse.json({
      ok: true, action: "renewed", newStart, newEnd, totalCents, currency,
      invoice: invoiceResult.ok ? { docNum: (invoiceResult as any).docNum } : null,
    });
  }

  return NextResponse.json({ ok: false, error: "INVALID_ACTION" }, { status: 400 });
}
