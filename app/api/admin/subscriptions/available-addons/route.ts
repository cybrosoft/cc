// app/api/admin/subscriptions/available-addons/route.ts
// Returns all addons available for a plan subscription, with pricing and subscription status
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

export async function GET(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const subscriptionId = searchParams.get("subscriptionId")?.trim();

  if (!subscriptionId)
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_ID_REQUIRED" }, { status: 400 });

  // Get the plan subscription with product tags
  const sub = await prisma.subscription.findUnique({
    where:  { id: subscriptionId },
    select: {
      id:           true,
      userId:       true,
      marketId:     true,
      billingPeriod: true,
      status:       true,
      currentPeriodStart: true,
      currentPeriodEnd:   true,
      user: { select: { customerGroupId: true } },
      product: {
        select: {
          id:   true,
          tags: { select: { key: true } },
        },
      },
      childSubscriptions: {
        select: {
          id:           true,
          productId:    true,
          status:       true,
          paymentStatus: true,
          quantity:     true,
          productNote:  true,
        },
      },
    },
  });

  if (!sub)
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_NOT_FOUND" }, { status: 404 });

  const planTagKeys   = sub.product.tags.map(t => t.key);
  const customerGroupId = sub.user.customerGroupId;

  // Find all active addon products whose applicableTags overlap with plan tags
  const allAddons = await prisma.product.findMany({
    where: {
      type:     "addon",
      isActive: true,
      // applicableTags has ANY overlap with planTagKeys
      // Prisma doesn't support array overlap natively — fetch all and filter
    },
    select: {
      id:               true,
      key:              true,
      name:             true,
      addonPricingType: true,
      addonBehavior:    true,
      addonPercentage:  true,
      addonUnitLabel:   true,
      addonMinUnits:    true,
      addonMaxUnits:    true,
      applicableTags:   true,
      billingPeriods:   true,
    },
  });

  // Filter: addon applicableTags must overlap with plan's tags
  const matchingAddons = allAddons.filter(addon =>
    addon.applicableTags.length === 0 || // no restriction = applies to all plans
    addon.applicableTags.some(tag => planTagKeys.includes(tag))
  );

  if (matchingAddons.length === 0)
    return NextResponse.json({ ok: true, addons: [] });

  // Resolve pricing for each addon
  const addonIds = matchingAddons.map(a => a.id);
  const pricingRows = customerGroupId ? await prisma.pricing.findMany({
    where: {
      productId:       { in: addonIds },
      marketId:        sub.marketId,
      customerGroupId: customerGroupId,
      billingPeriod:   sub.billingPeriod,
      isActive:        true,
    },
    select: { productId: true, priceCents: true },
  }) : [];

  const priceMap = new Map(pricingRows.map(p => [p.productId, p.priceCents]));

  // Map existing subscriptions by productId
  const subscribedMap = new Map(sub.childSubscriptions.map(c => [c.productId, c]));

  const addons = matchingAddons.map(addon => {
    const existing = subscribedMap.get(addon.id) ?? null;
    const priceCents = priceMap.get(addon.id) ?? null;

    return {
      id:               addon.id,
      key:              addon.key,
      name:             addon.name,
      addonPricingType: addon.addonPricingType,
      addonBehavior:    addon.addonBehavior,
      addonPercentage:  addon.addonPercentage ? Number(addon.addonPercentage) : null,
      addonUnitLabel:   addon.addonUnitLabel,
      addonMinUnits:    addon.addonMinUnits,
      addonMaxUnits:    addon.addonMaxUnits,
      billingPeriods:   addon.billingPeriods,
      priceCents,
      // Subscription status
      subscriptionId:   existing?.id ?? null,
      status:           existing?.status ?? null,
      paymentStatus:    existing?.paymentStatus ?? null,
      quantity:         existing?.quantity ?? null,
      productNote:      existing?.productNote ?? null,
      isSubscribed:     existing != null,
    };
  });

  return NextResponse.json({ ok: true, addons });
}