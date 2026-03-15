// app/api/admin/subscriptions/[id]/upgrade/route.ts
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

function s(v: unknown): string { return typeof v === "string" ? v : ""; }

// Pro-rate: price per unit × extra units × remaining days / total days
function calcProRateCents(
  pricePerUnitCents: number,
  extraUnits:        number,
  periodStart:       Date,
  periodEnd:         Date,
  upgradeDate:       Date
): number {
  const totalDays     = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / 86400000));
  const remainingDays = Math.max(0, Math.round((periodEnd.getTime() - upgradeDate.getTime()) / 86400000));
  return Math.round(pricePerUnitCents * extraUnits * (remainingDays / totalDays));
}

// GET — return current quantity + price per unit + pro-rate preview
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const previewQty = parseInt(searchParams.get("qty") ?? "0") || 0;

  const sub = await prisma.subscription.findUnique({
    where:  { id },
    select: {
      id: true, quantity: true, billingPeriod: true,
      currentPeriodStart: true, currentPeriodEnd: true,
      marketId: true, productId: true, status: true,
      user: { select: { customerGroupId: true } },
      market: { select: { defaultCurrency: true } },
      product: {
        select: {
          id: true, name: true, unitLabel: true,
          tags: { select: { key: true } },
        },
      },
    },
  });

  if (!sub)
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  // Check it's a metered product
  const isMetered = sub.product.tags.some(t => t.key === "metered");
  if (!isMetered)
    return NextResponse.json({ ok: false, error: "NOT_A_METERED_SUBSCRIPTION" }, { status: 400 });

  const cgId     = sub.user.customerGroupId;
  const currency = sub.market.defaultCurrency ?? "SAR";

  // Resolve price per unit from Pricing table
  const pricing = cgId ? await prisma.pricing.findFirst({
    where: {
      productId:       sub.productId,
      marketId:        sub.marketId,
      customerGroupId: cgId,
      billingPeriod:   sub.billingPeriod,
      isActive:        true,
    },
    select: { priceCents: true },
  }) : null;

  const pricePerUnitCents = pricing?.priceCents ?? null;
  const currentQty        = sub.quantity ?? 1;
  const now               = new Date();

  // Pro-rate preview if qty provided
  let proRateCents: number | null = null;
  let proRateDetails: string | null = null;

  if (
    previewQty > currentQty &&
    pricePerUnitCents != null &&
    sub.currentPeriodStart &&
    sub.currentPeriodEnd
  ) {
    const extraUnits    = previewQty - currentQty;
    const totalDays     = Math.max(1, Math.round((sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) / 86400000));
    const remainingDays = Math.max(0, Math.round((sub.currentPeriodEnd.getTime() - now.getTime()) / 86400000));
    proRateCents = calcProRateCents(pricePerUnitCents, extraUnits, sub.currentPeriodStart, sub.currentPeriodEnd, now);
    proRateDetails = `${extraUnits} extra ${sub.product.unitLabel ?? "unit"}${extraUnits > 1 ? "s" : ""} × ${remainingDays}/${totalDays} days remaining = ${(proRateCents / 100).toFixed(2)} ${currency}`;
  }

  return NextResponse.json({
    ok: true,
    data: {
      currentQty,
      unitLabel:         sub.product.unitLabel ?? "unit",
      pricePerUnitCents,
      currency,
      periodStart:       sub.currentPeriodStart,
      periodEnd:         sub.currentPeriodEnd,
      proRateCents,
      proRateDetails,
      isActive:          sub.status === "ACTIVE",
    },
  });
}

// POST — execute upgrade or downgrade
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as {
    newQuantity?: unknown;
    note?:        unknown;
  } | null;

  const newQty = typeof body?.newQuantity === "number" ? Math.max(1, body.newQuantity) : null;
  if (!newQty)
    return NextResponse.json({ ok: false, error: "NEW_QUANTITY_REQUIRED" }, { status: 400 });

  const sub = await prisma.subscription.findUnique({
    where:  { id },
    select: {
      id: true, quantity: true, billingPeriod: true, productNote: true,
      currentPeriodStart: true, currentPeriodEnd: true,
      marketId: true, productId: true,
      user: { select: { customerGroupId: true } },
      market: { select: { defaultCurrency: true } },
      product: { select: { unitLabel: true, tags: { select: { key: true } } } },
    },
  });

  if (!sub)
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const isMetered = sub.product.tags.some(t => t.key === "metered");
  if (!isMetered)
    return NextResponse.json({ ok: false, error: "NOT_A_METERED_SUBSCRIPTION" }, { status: 400 });

  const currentQty    = sub.quantity ?? 1;
  const cgId          = sub.user.customerGroupId;
  const currency      = sub.market.defaultCurrency ?? "SAR";
  const unitLabel     = sub.product.unitLabel ?? "unit";
  const isUpgrade     = newQty > currentQty;
  const isDowngrade   = newQty < currentQty;
  const now           = new Date();

  let proRateCents    = 0;
  let proRateNote     = "";

  if (isUpgrade && sub.currentPeriodStart && sub.currentPeriodEnd) {
    const pricing = cgId ? await prisma.pricing.findFirst({
      where: {
        productId:       sub.productId,
        marketId:        sub.marketId,
        customerGroupId: cgId,
        billingPeriod:   sub.billingPeriod,
        isActive:        true,
      },
      select: { priceCents: true },
    }) : null;

    if (pricing) {
      const extraUnits    = newQty - currentQty;
      const totalDays     = Math.max(1, Math.round((sub.currentPeriodEnd.getTime() - sub.currentPeriodStart.getTime()) / 86400000));
      const remainingDays = Math.max(0, Math.round((sub.currentPeriodEnd.getTime() - now.getTime()) / 86400000));
      proRateCents = calcProRateCents(pricing.priceCents, extraUnits, sub.currentPeriodStart, sub.currentPeriodEnd, now);
      proRateNote = `Upgrade: +${extraUnits} ${unitLabel}${extraUnits > 1 ? "s" : ""} (${currentQty}→${newQty}). Pro-rated ${remainingDays}/${totalDays} days = ${(proRateCents / 100).toFixed(2)} ${currency}.`;
    }
  } else if (isDowngrade) {
    proRateNote = `Downgrade: ${currentQty}→${newQty} ${unitLabel}${newQty > 1 ? "s" : ""}. No charge. Renewal will use new quantity.`;
  }

  const customNote   = s(body?.note).trim();
  const combinedNote = [proRateNote, customNote].filter(Boolean).join(" ");

  // Update subscription quantity + append note
  const existingNote   = sub.productNote ?? "";
  const updatedNote    = [existingNote, combinedNote].filter(Boolean).join("\n");

  await prisma.subscription.update({
    where: { id },
    data:  {
      quantity:    newQty,
      productNote: updatedNote || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       isUpgrade ? "SUBSCRIPTION_UPGRADED" : "SUBSCRIPTION_DOWNGRADED",
      entityType:   "Subscription",
      entityId:     id,
      metadataJson: JSON.stringify({ from: currentQty, to: newQty, proRateCents, currency }),
    },
  });

  return NextResponse.json({
    ok:           true,
    newQuantity:  newQty,
    isUpgrade,
    isDowngrade,
    proRateCents,
    currency,
    note:         combinedNote,
  });
}