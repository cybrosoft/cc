// app/api/admin/subscriptions/create/route.ts
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { BillingPeriod, PaymentStatus, Role, SubscriptionStatus, InvoicingMode } from "@prisma/client";
import {
  createSubscriptionInvoice,
  buildSubscriptionLine,
} from "@/lib/sales/create-subscription-invoice";

function s(v: unknown): string { return typeof v === "string" ? v : ""; }

async function getEffectiveGroupId(userGroupId: string | null): Promise<string | null> {
  if (userGroupId) return userGroupId;
  const def = await prisma.customerGroup.findFirst({
    where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true },
  });
  return def?.id ?? null;
}

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
    customerId?:           unknown;
    productId?:            unknown;
    billingPeriod?:        unknown;
    quantity?:             unknown;
    locationCode?:         unknown;
    templateSlug?:         unknown;
    productDetails?:       unknown;
    productNote?:          unknown;
    parentSubscriptionId?: unknown;
    addonIds?:             { productId: string; quantity?: number }[];
    autoInvoice?:          boolean;  // generate invoice immediately
    invoicingMode?:        unknown;  // "AUTO" | "MANUAL" — default "AUTO"
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
  const autoInvoice          = body?.autoInvoice !== false; // default true

  // invoicingMode: AUTO or MANUAL — if autoInvoice is false, default to MANUAL
  const invoicingModeRaw = s(body?.invoicingMode).trim().toUpperCase();
  const invoicingMode: InvoicingMode = invoicingModeRaw === "MANUAL"
    ? InvoicingMode.MANUAL
    : autoInvoice ? InvoicingMode.AUTO : InvoicingMode.MANUAL;

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
    select: { id: true, isActive: true, type: true, name: true },
  });
  if (!product || !product.isActive)
    return NextResponse.json({ ok: false, error: "PRODUCT_NOT_FOUND" }, { status: 404 });

  // ── Check if adding mid-subscription ──────────────────────────────────────
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

  // ── Resolve pro-rate ───────────────────────────────────────────────────────
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
      userId:               user.id,
      marketId:             user.marketId,
      productId:            product.id,
      billingPeriod:        billingPeriod as BillingPeriod,
      status:               SubscriptionStatus.PENDING_PAYMENT,
      paymentStatus:        PaymentStatus.UNPAID,
      quantity:             quantity > 1 ? quantity : null,
      locationCode,
      templateSlug,
      productDetails,
      productNote:          proRatedNote ?? productNote,
      parentSubscriptionId: parentSubscriptionId || null,
      invoicingMode,
      // MANUAL mode cannot auto-renew
      autoRenew:            invoicingMode === InvoicingMode.MANUAL ? false : undefined,
      ...(isMidSubscription ? {
        currentPeriodStart: now,
        currentPeriodEnd:   parentSub!.currentPeriodEnd!,
      } : {}),
    },
    select: { id: true },
  });

  // ── Create addon rows ──────────────────────────────────────────────────────
  type AddonInvoiceData = {
    subId:         string;
    productId:     string;
    productName:   string;
    quantity:      number;
    priceCents:    number;
    isProRated:    boolean;
    proRatedCents: number | null;
    remainingDays: number | null;
    totalDays:     number | null;
  };
  const addonSubIds: string[]          = [];
  const addonInvoiceData: AddonInvoiceData[] = [];

  if (addonIds.length > 0) {
    const addonProducts = await prisma.product.findMany({
      where:  { id: { in: addonIds.map(a => a.productId) }, isActive: true },
      select: { id: true, type: true, name: true },
    });
    const validAddonMap = new Map(addonProducts.map(p => [p.id, p]));

    for (const addon of addonIds) {
      const addonProduct = validAddonMap.get(addon.productId);
      if (!addonProduct) continue;

      let addonNote: string | null          = null;
      let addonProRatedCents: number | null = null;
      let addonRemainingDays: number | null = null;
      let addonTotalDays: number | null     = null;
      let addonCatalogCents                 = 0;

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
        addonCatalogCents = addonPricing.priceCents * (addon.quantity ?? 1);
      }

      if (isMidSubscription && parentSub!.currentPeriodStart && parentSub!.currentPeriodEnd && addonPricing) {
        const addonQty     = addon.quantity ?? 1;
        addonProRatedCents = proRateCents(
          addonPricing.priceCents * addonQty,
          parentSub!.currentPeriodStart,
          parentSub!.currentPeriodEnd,
          now
        );
        addonRemainingDays = Math.round((parentSub!.currentPeriodEnd.getTime() - now.getTime()) / 86400000);
        addonTotalDays     = Math.round((parentSub!.currentPeriodEnd.getTime() - parentSub!.currentPeriodStart.getTime()) / 86400000);
        addonNote = `Pro-rated: ${addonRemainingDays}/${addonTotalDays} days. Suggested: ${(addonProRatedCents / 100).toFixed(2)}`;
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
          invoicingMode,
          ...(isMidSubscription ? {
            currentPeriodStart: now,
            currentPeriodEnd:   parentSub!.currentPeriodEnd!,
          } : {}),
        },
        select: { id: true },
      });

      addonSubIds.push(addonSub.id);
      addonInvoiceData.push({
        subId:         addonSub.id,
        productId:     addon.productId,
        productName:   addonProduct.name,
        quantity:      addon.quantity ?? 1,
        priceCents:    addonCatalogCents,
        isProRated:    isMidSubscription,
        proRatedCents: addonProRatedCents,
        remainingDays: addonRemainingDays,
        totalDays:     addonTotalDays,
      });
    }
  }

  // ── Auto-generate invoice ──────────────────────────────────────────────────
  let invoiceResult: { ok: boolean; docId?: string; docNum?: string; reason?: string } = { ok: false, reason: "skipped" };

  if (autoInvoice && invoicingMode === InvoicingMode.AUTO) {
    const planPricing = await prisma.pricing.findFirst({
      where: {
        productId:       product.id,
        marketId:        user.marketId,
        customerGroupId: effectiveGroupId,
        billingPeriod:   billingPeriod as BillingPeriod,
        isActive:        true,
      },
      select: { priceCents: true },
    });

    const invoiceLines = [];

    if (planPricing || proRatedCents) {
      const unitPrice = isMidSubscription && proRatedCents
        ? proRatedCents
        : (planPricing?.priceCents ?? 0) * quantity;

      invoiceLines.push(buildSubscriptionLine({
        productId:      product.id,
        productName:    product.name,
        billingPeriod,
        quantity:       isMidSubscription ? 1 : quantity,
        unitPriceCents: unitPrice,
      }));
    }

    for (const a of addonInvoiceData) {
      const unitPrice = a.isProRated && a.proRatedCents ? a.proRatedCents : a.priceCents;
      if (unitPrice > 0) {
        invoiceLines.push(buildSubscriptionLine({
          productId:      a.productId,
          productName:    a.productName,
          billingPeriod,
          quantity:       a.isProRated ? 1 : a.quantity,
          unitPriceCents: unitPrice,
        }));
      }
    }

    if (invoiceLines.length > 0) {
      invoiceResult = await createSubscriptionInvoice({
        actorId:         admin.id,
        customerId:      user.id,
        marketId:        user.marketId,
        referenceNumber: planSub.id,
        subject:         `Subscription — ${product.name}`,
        lines:           invoiceLines,
      });
    }
  }

  // ── Audit log ──────────────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "SUBSCRIPTION_CREATED",
      entityType:   "Subscription",
      entityId:     planSub.id,
      metadataJson: JSON.stringify({
        customerId, productId, billingPeriod,
        invoicingMode,
        isMidSubscription,
        proRatedCents,
        addonCount:    addonSubIds.length,
        addonSubIds,
        autoInvoice,
        invoiceDocNum: invoiceResult.ok ? (invoiceResult as any).docNum : null,
      }),
    },
  });

  return NextResponse.json({
    ok:                   true,
    subscriptionId:       planSub.id,
    addonSubscriptionIds: addonSubIds,
    isMidSubscription,
    proRatedCents,
    invoicingMode,
    invoice: invoiceResult.ok
      ? { docId: (invoiceResult as any).docId, docNum: (invoiceResult as any).docNum }
      : null,
  });
}
