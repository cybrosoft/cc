// app/api/admin/subscriptions/create/route.ts
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { BillingPeriod, PaymentStatus, Role, SubscriptionStatus } from "@prisma/client";

function s(v: unknown): string { return typeof v === "string" ? v : ""; }

async function getEffectiveGroupId(userGroupId: string | null): Promise<string | null> {
  if (userGroupId) return userGroupId;
  const def = await prisma.customerGroup.findFirst({
    where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true },
  });
  return def?.id ?? null;
}

// Pro-rate price based on remaining days in parent subscription period
function proRateCents(fullPriceCents: number, periodStart: Date, periodEnd: Date, addonStart: Date): number {
  const totalDays     = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000));
  const remainingDays = Math.max(0, Math.round((periodEnd.getTime() - addonStart.getTime()) / 86400000));
  return Math.round(fullPriceCents * (remainingDays / totalDays));
}

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    customerId?:      unknown;
    productId?:       unknown;
    billingPeriod?:   unknown;
    quantity?:        unknown;
    locationCode?:    unknown;
    templateSlug?:    unknown;
    productDetails?:  unknown;
    productNote?:     unknown;
    parentSubscriptionId?: unknown;  // if adding addon to existing active plan
    addonIds?: { productId: string; quantity?: number }[];
  } | null;

  const customerId           = s(body?.customerId).trim();
  const productId            = s(body?.productId).trim();
  const billingPeriod        = s(body?.billingPeriod).trim();
  const locationCode         = s(body?.locationCode).trim() || null;
  const templateSlug         = s(body?.templateSlug).trim() || null;
  const productDetails       = s(body?.productDetails).trim() || null;
  const productNote          = s(body?.productNote).trim() || null;
  const quantity             = typeof body?.quantity === "number" ? body.quantity : 1;
  const addonIds             = Array.isArray(body?.addonIds) ? body.addonIds : [];
  const parentSubscriptionId = s(body?.parentSubscriptionId).trim() || null;

  if (!customerId) return NextResponse.json({ ok: false, error: "CUSTOMER_ID_REQUIRED" },  { status: 400 });
  if (!productId)  return NextResponse.json({ ok: false, error: "PRODUCT_ID_REQUIRED" },   { status: 400 });
  if (!billingPeriod || !Object.values(BillingPeriod).includes(billingPeriod as BillingPeriod))
    return NextResponse.json({ ok: false, error: "INVALID_BILLING_PERIOD" }, { status: 400 });

  // ── Validate customer ──────────────────────────────────────────────────────
  const user = await prisma.user.findUnique({
    where:  { id: customerId },
    select: { id: true, role: true, marketId: true, customerGroupId: true },
  });
  if (!user)                       return NextResponse.json({ ok: false, error: "CUSTOMER_NOT_FOUND" }, { status: 404 });
  if (user.role !== Role.CUSTOMER) return NextResponse.json({ ok: false, error: "NOT_A_CUSTOMER" },    { status: 400 });

  const effectiveGroupId = await getEffectiveGroupId(user.customerGroupId);
  if (!effectiveGroupId)
    return NextResponse.json({ ok: false, error: "NO_CUSTOMER_GROUP" }, { status: 500 });

  // ── Validate product ───────────────────────────────────────────────────────
  const product = await prisma.product.findUnique({
    where:  { id: productId },
    select: { id: true, isActive: true, type: true },
  });
  if (!product || !product.isActive)
    return NextResponse.json({ ok: false, error: "PRODUCT_NOT_FOUND" }, { status: 404 });

  // ── Check if adding mid-subscription (parent is active plan) ───────────────
  let parentSub: {
    id: string; status: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd:   Date | null;
  } | null = null;

  if (parentSubscriptionId) {
    parentSub = await prisma.subscription.findUnique({
      where:  { id: parentSubscriptionId },
      select: { id: true, status: true, currentPeriodStart: true, currentPeriodEnd: true },
    });
  }

  const isMidSubscription = parentSub?.status === "ACTIVE"
    && parentSub.currentPeriodStart != null
    && parentSub.currentPeriodEnd   != null;

  const now = new Date();

  // ── Resolve full catalog price for pro-rate calculation ────────────────────
  let proRatedNote: string | null = null;
  let proRatedCents: number | null = null;

  if (isMidSubscription && parentSub!.currentPeriodStart && parentSub!.currentPeriodEnd) {
    const pricing = await prisma.pricing.findFirst({
      where: {
        productId:       productId,
        marketId:        user.marketId,
        customerGroupId: effectiveGroupId,
        billingPeriod:   billingPeriod as BillingPeriod,
        isActive:        true,
      },
      select: { priceCents: true },
    });

    if (pricing) {
      proRatedCents = proRateCents(
        pricing.priceCents * (quantity > 1 ? quantity : 1),
        parentSub!.currentPeriodStart,
        parentSub!.currentPeriodEnd,
        now
      );
      const totalDays     = Math.round((parentSub!.currentPeriodEnd.getTime() - parentSub!.currentPeriodStart.getTime()) / 86400000);
      const remainingDays = Math.round((parentSub!.currentPeriodEnd.getTime() - now.getTime()) / 86400000);
      proRatedNote = `Pro-rated: ${remainingDays}/${totalDays} days remaining. Suggested charge: ${(proRatedCents / 100).toFixed(2)}`;
    }
  }

  // ── Create plan/service subscription ──────────────────────────────────────
  const planSub = await prisma.subscription.create({
    data: {
      userId:              user.id,
      marketId:            user.marketId,
      productId:           product.id,
      billingPeriod:       billingPeriod as BillingPeriod,
      status:              SubscriptionStatus.PENDING_PAYMENT,
      paymentStatus:       PaymentStatus.UNPAID,
      quantity:            quantity > 1 ? quantity : null,
      locationCode,
      templateSlug,
      productDetails,
      productNote:         proRatedNote ?? productNote,
      // If mid-subscription, inherit parent's period dates
      parentSubscriptionId: parentSubscriptionId || null,
      ...(isMidSubscription ? {
        currentPeriodStart: now,
        currentPeriodEnd:   parentSub!.currentPeriodEnd!,
      } : {}),
    },
    select: { id: true },
  });

  // ── Create addon subscription rows ─────────────────────────────────────────
  const addonSubIds: string[] = [];

  if (addonIds.length > 0) {
    const addonProducts = await prisma.product.findMany({
      where:  { id: { in: addonIds.map(a => a.productId) }, isActive: true },
      select: { id: true, type: true },
    });
    const validAddonIds = new Set(addonProducts.map(p => p.id));

    for (const addon of addonIds) {
      if (!validAddonIds.has(addon.productId)) continue;

      // Pro-rate addon if mid-subscription
      let addonNote: string | null = null;
      if (isMidSubscription && parentSub!.currentPeriodStart && parentSub!.currentPeriodEnd) {
        const addonPricing = await prisma.pricing.findFirst({
          where: {
            productId:       addon.productId,
            marketId:        user.marketId,
            customerGroupId: effectiveGroupId,
            billingPeriod:   billingPeriod as BillingPeriod,
            isActive:        true,
          },
          select: { priceCents: true },
        });
        if (addonPricing) {
          const addonQty    = addon.quantity ?? 1;
          const addonProRated = proRateCents(
            addonPricing.priceCents * addonQty,
            parentSub!.currentPeriodStart,
            parentSub!.currentPeriodEnd,
            now
          );
          const remainingDays = Math.round((parentSub!.currentPeriodEnd.getTime() - now.getTime()) / 86400000);
          const totalDays     = Math.round((parentSub!.currentPeriodEnd.getTime() - parentSub!.currentPeriodStart.getTime()) / 86400000);
          addonNote = `Pro-rated: ${remainingDays}/${totalDays} days. Suggested: ${(addonProRated / 100).toFixed(2)}`;
        }
      }

      const addonSub = await prisma.subscription.create({
        data: {
          userId:               user.id,
          marketId:             user.marketId,
          productId:            addon.productId,
          billingPeriod:        billingPeriod as BillingPeriod,
          status:               SubscriptionStatus.PENDING_PAYMENT,
          paymentStatus:        PaymentStatus.UNPAID,
          quantity:             addon.quantity ?? null,
          parentSubscriptionId: planSub.id,
          productNote:          addonNote,
          ...(isMidSubscription ? {
            currentPeriodStart: now,
            currentPeriodEnd:   parentSub!.currentPeriodEnd!,
          } : {}),
        },
        select: { id: true },
      });
      addonSubIds.push(addonSub.id);
    }
  }

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "SUBSCRIPTION_CREATED",
      entityType:   "Subscription",
      entityId:     planSub.id,
      metadataJson: JSON.stringify({
        customerId, productId, billingPeriod,
        isMidSubscription,
        proRatedCents,
        addonCount:  addonSubIds.length,
        addonSubIds,
      }),
    },
  });

  return NextResponse.json({
    ok:                   true,
    subscriptionId:       planSub.id,
    addonSubscriptionIds: addonSubIds,
    isMidSubscription,
    proRatedCents,
  });
}