// app/api/admin/subscriptions/add-addons/route.ts
// Batch add one or more addons to an active plan subscription.
// One invoice generated for all addons added in the same call (if autoInvoice=true).
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { BillingPeriod, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import {
  createSubscriptionInvoice,
  buildSubscriptionLine,
  buildProRatedLine,
} from "@/lib/sales/create-subscription-invoice";

function s(v: unknown): string { return typeof v === "string" ? v : ""; }

function proRateCents(
  fullPriceCents: number,
  periodStart:    Date,
  periodEnd:      Date,
  addonStart:     Date,
): number {
  const totalDays     = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000));
  const remainingDays = Math.max(0, Math.round((periodEnd.getTime() - addonStart.getTime()) / 86400000));
  return Math.round(fullPriceCents * (remainingDays / totalDays));
}

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    planSubscriptionId?: unknown;
    addons?: { productId: string; quantity?: number }[];
    autoInvoice?: boolean; // default true
  } | null;

  const planSubscriptionId = s(body?.planSubscriptionId).trim();
  const addons             = Array.isArray(body?.addons) ? body.addons : [];
  const autoInvoice        = body?.autoInvoice !== false; // default true

  if (!planSubscriptionId)
    return NextResponse.json({ ok: false, error: "PLAN_SUBSCRIPTION_ID_REQUIRED" }, { status: 400 });
  if (addons.length === 0)
    return NextResponse.json({ ok: false, error: "NO_ADDONS_PROVIDED" }, { status: 400 });

  // ── Fetch plan subscription ────────────────────────────────────────────────
  const planSub = await prisma.subscription.findUnique({
    where:  { id: planSubscriptionId },
    select: {
      id:                 true,
      userId:             true,
      marketId:           true,
      billingPeriod:      true,
      status:             true,
      currentPeriodStart: true,
      currentPeriodEnd:   true,
      product: {
        select: { id: true, name: true, key: true, tags: { select: { key: true } } },
      },
      user: {
        select: { id: true, customerGroupId: true },
      },
    },
  });

  if (!planSub)
    return NextResponse.json({ ok: false, error: "PLAN_SUBSCRIPTION_NOT_FOUND" }, { status: 404 });
  if (planSub.status === "CANCELED")
    return NextResponse.json({ ok: false, error: "PLAN_SUBSCRIPTION_CANCELED" }, { status: 400 });

  const isMidSubscription = planSub.status === "ACTIVE"
    && planSub.currentPeriodStart != null
    && planSub.currentPeriodEnd   != null;

  const now              = new Date();
  const customerGroupId  = planSub.user.customerGroupId;

  // Resolve effective group
  let effectiveGroupId = customerGroupId;
  if (!effectiveGroupId) {
    const def = await prisma.customerGroup.findFirst({
      where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true },
    });
    effectiveGroupId = def?.id ?? null;
  }

  // ── Validate addon product IDs ─────────────────────────────────────────────
  const addonProductIds = addons.map(a => a.productId);
  const addonProducts   = await prisma.product.findMany({
    where:  { id: { in: addonProductIds }, isActive: true, type: "addon" },
    select: { id: true, name: true, type: true },
  });
  const validAddonMap = new Map(addonProducts.map(p => [p.id, p]));

  // Check none already subscribed
  const existingAddonSubs = await prisma.subscription.findMany({
    where: {
      parentSubscriptionId: planSubscriptionId,
      productId:            { in: addonProductIds },
      status:               { not: SubscriptionStatus.CANCELED },
    },
    select: { productId: true },
  });
  const alreadySubscribed = new Set(existingAddonSubs.map(s => s.productId));

  // ── Create addon subscriptions ─────────────────────────────────────────────
  type CreatedAddon = {
    subId:         string;
    productId:     string;
    productName:   string;
    quantity:      number;
    catalogCents:  number;
    proRatedCents: number | null;
    remainingDays: number | null;
    totalDays:     number | null;
  };

  const created: CreatedAddon[] = [];
  const skipped: { productId: string; reason: string }[] = [];

  for (const addon of addons) {
    const addonProduct = validAddonMap.get(addon.productId);

    if (!addonProduct) {
      skipped.push({ productId: addon.productId, reason: "not_found_or_inactive" });
      continue;
    }
    if (alreadySubscribed.has(addon.productId)) {
      skipped.push({ productId: addon.productId, reason: "already_subscribed" });
      continue;
    }

    const addonQty = addon.quantity ?? 1;

    // Resolve pricing
    const addonPricing = effectiveGroupId
      ? await prisma.pricing.findFirst({
          where: {
            productId:       addon.productId,
            marketId:        planSub.marketId,
            customerGroupId: effectiveGroupId,
            billingPeriod:   planSub.billingPeriod,
            isActive:        true,
          },
          select: { priceCents: true },
        })
      : null;

    const catalogCents = (addonPricing?.priceCents ?? 0) * addonQty;

    // Pro-rate calculation
    let addonProRatedCents: number | null = null;
    let addonNote: string | null = null;
    let remainingDays: number | null = null;
    let totalDays: number | null = null;

    if (isMidSubscription && planSub.currentPeriodStart && planSub.currentPeriodEnd && addonPricing) {
      addonProRatedCents = proRateCents(
        addonPricing.priceCents * addonQty,
        planSub.currentPeriodStart,
        planSub.currentPeriodEnd,
        now,
      );
      remainingDays = Math.round((planSub.currentPeriodEnd.getTime() - now.getTime()) / 86400000);
      totalDays     = Math.round((planSub.currentPeriodEnd.getTime() - planSub.currentPeriodStart.getTime()) / 86400000);
      addonNote     = `Pro-rated: ${remainingDays}/${totalDays} days. Suggested: ${(addonProRatedCents / 100).toFixed(2)}`;
    }

    const addonSub = await prisma.subscription.create({
      data: {
        userId:               planSub.userId,
        marketId:             planSub.marketId,
        productId:            addon.productId,
        billingPeriod:        planSub.billingPeriod as BillingPeriod,
        status:               SubscriptionStatus.PENDING_PAYMENT,
        paymentStatus:        PaymentStatus.UNPAID,
        quantity:             addonQty > 1 ? addonQty : null,
        parentSubscriptionId: planSubscriptionId,
        productNote:          addonNote,
        ...(isMidSubscription ? {
          currentPeriodStart: now,
          currentPeriodEnd:   planSub.currentPeriodEnd!,
        } : {}),
      },
      select: { id: true },
    });

    created.push({
      subId:         addonSub.id,
      productId:     addon.productId,
      productName:   addonProduct.name,
      quantity:      addonQty,
      catalogCents,
      proRatedCents: addonProRatedCents,
      remainingDays,
      totalDays,
    });
  }

  // ── Auto-generate ONE invoice for all addons added ─────────────────────────
  let invoiceResult: { ok: boolean; docId?: string; docNum?: string; reason?: string } = { ok: false, reason: "skipped" };

  if (autoInvoice && created.length > 0) {
    const invoiceLines = created
      .filter(a => (a.proRatedCents ?? a.catalogCents) > 0)
      .map(a => {
        if (isMidSubscription && a.proRatedCents && a.remainingDays && a.totalDays) {
          return buildProRatedLine({
            productId:     a.productId,
            productName:   a.productName,
            billingPeriod: planSub.billingPeriod,
            remainingDays: a.remainingDays,
            totalDays:     a.totalDays,
            proRatedCents: a.proRatedCents,
            addedQty:      a.quantity,
          });
        }
        return buildSubscriptionLine({
          productId:      a.productId,
          productName:    a.productName,
          billingPeriod:  planSub.billingPeriod,
          quantity:       a.quantity,
          unitPriceCents: a.catalogCents,
        });
      });

    if (invoiceLines.length > 0) {
      invoiceResult = await createSubscriptionInvoice({
        actorId:         admin.id,
        customerId:      planSub.userId,
        marketId:        planSub.marketId,
        referenceNumber: planSubscriptionId,
        subject:         `Add-ons — ${planSub.product.name}`,
        internalNote:    `Added ${created.length} addon(s) to subscription ${planSubscriptionId}`,
        lines:           invoiceLines,
      });
    }
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "ADDONS_BATCH_ADDED",
      entityType:   "Subscription",
      entityId:     planSubscriptionId,
      metadataJson: JSON.stringify({
        created: created.map(a => a.subId),
        skipped,
        autoInvoice,
        invoiceDocNum: invoiceResult.ok ? (invoiceResult as any).docNum : null,
      }),
    },
  });

  return NextResponse.json({
    ok:      true,
    created: created.map(a => ({ subId: a.subId, productId: a.productId })),
    skipped,
    invoice: invoiceResult.ok
      ? { docId: (invoiceResult as any).docId, docNum: (invoiceResult as any).docNum }
      : null,
  });
}
