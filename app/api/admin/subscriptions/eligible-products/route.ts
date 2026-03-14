// app/api/admin/subscriptions/eligible-products/route.ts
// Returns full rich product data for the create-subscription modal.
// Supports ?rich=1 to return billingPeriods, tags, addon fields, and per-period prices.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { Role } from "@prisma/client";

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

async function getEffectiveGroupId(userGroupId: string | null, marketId: string): Promise<string | null> {
  if (userGroupId) return userGroupId;
  const def = await prisma.customerGroup.findFirst({
    where: { isDefault: true, isActive: true },
    select: { id: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  return def?.id ?? null;
}

export async function GET(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== Role.ADMIN) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const customerId = s(searchParams.get("customerId")).trim();
  const rich = searchParams.get("rich") === "1";

  if (!customerId) {
    return NextResponse.json({ ok: false, error: "CUSTOMER_ID_REQUIRED" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: {
      id: true, role: true, marketId: true, customerGroupId: true,
      market: { select: { id: true, key: true, name: true, defaultCurrency: true } },
    },
  });

  if (!user) return NextResponse.json({ ok: false, error: "CUSTOMER_NOT_FOUND" }, { status: 404 });
  if (user.role !== Role.CUSTOMER) return NextResponse.json({ ok: false, error: "NOT_A_CUSTOMER" }, { status: 400 });
  if (!user.market) return NextResponse.json({ ok: false, error: "CUSTOMER_HAS_NO_MARKET" }, { status: 400 });

  const effectiveGroupId = await getEffectiveGroupId(user.customerGroupId, user.marketId);
  if (!effectiveGroupId) {
    return NextResponse.json({ ok: false, error: "DEFAULT_CUSTOMER_GROUP_NOT_FOUND" }, { status: 500 });
  }

  const currency = user.market.defaultCurrency;

  const groupPricingRows = await prisma.pricing.findMany({
    where: {
      isActive:        true,
      marketId:        user.marketId,
      customerGroupId: effectiveGroupId,
      product:         { isActive: true },
    },
    select: {
      billingPeriod: true,
      priceCents:    true,
      product: {
        select: {
          id: true, key: true, name: true, type: true, unitLabel: true,
          billingPeriods: true, addonPricingType: true, addonBehavior: true,
          addonUnitLabel: true, addonMinUnits: true, addonMaxUnits: true,
          addonPercentage: true, applicableTags: true,
          category: { select: { id: true, key: true, name: true } },
          tags:     { select: { id: true, key: true, name: true } },
        },
      },
    },
  });

  const productIdsFromPricing = [...new Set(groupPricingRows.map(r => r.product.id))];

  const overrides = await prisma.customerPricingOverride.findMany({
    where: { userId: user.id, marketId: user.marketId, productId: { in: productIdsFromPricing } },
    select: { productId: true, billingPeriod: true, priceCents: true },
  });

  const overrideMap = new Map<string, number>();
  for (const o of overrides) overrideMap.set(`${o.productId}:${o.billingPeriod}`, o.priceCents);

  const groupRow = await prisma.customerGroup.findUnique({
    where: { id: effectiveGroupId }, select: { key: true, name: true },
  });

  const productMap = new Map<string, {
    product: (typeof groupPricingRows)[number]["product"];
    prices: Array<{ billingPeriod: string; priceCents: number; isOverride: boolean }>;
  }>();

  for (const row of groupPricingRows) {
    const pid = row.product.id;
    const overridePrice = overrideMap.get(`${pid}:${row.billingPeriod}`);
    const finalPrice = overridePrice ?? row.priceCents;
    if (!productMap.has(pid)) productMap.set(pid, { product: row.product, prices: [] });
    productMap.get(pid)!.prices.push({ billingPeriod: row.billingPeriod, priceCents: finalPrice, isOverride: overridePrice !== undefined });
  }

  // Enterprise-only overrides (no group pricing row)
  const enterpriseOnly = await prisma.customerPricingOverride.findMany({
    where: { userId: user.id, marketId: user.marketId, productId: { notIn: productIdsFromPricing } },
    select: {
      billingPeriod: true, priceCents: true,
      product: {
        select: {
          id: true, key: true, name: true, type: true, unitLabel: true,
          billingPeriods: true, addonPricingType: true, addonBehavior: true,
          addonUnitLabel: true, addonMinUnits: true, addonMaxUnits: true,
          addonPercentage: true, applicableTags: true,
          category: { select: { id: true, key: true, name: true } },
          tags:     { select: { id: true, key: true, name: true } },
        },
      },
    },
  });

  for (const row of enterpriseOnly) {
    const pid = row.product.id;
    if (!productMap.has(pid)) productMap.set(pid, { product: row.product, prices: [] });
    productMap.get(pid)!.prices.push({ billingPeriod: row.billingPeriod, priceCents: row.priceCents, isOverride: true });
  }

  // Percentage / required addons that have no pricing rows
  const alreadyInMap = new Set(productMap.keys());
  const pricelessAddons = await prisma.product.findMany({
    where: {
      isActive: true, type: "addon", id: { notIn: [...alreadyInMap] },
      OR: [{ addonPricingType: "percentage" }, { addonBehavior: "required" }],
    },
    select: {
      id: true, key: true, name: true, type: true, unitLabel: true,
      billingPeriods: true, addonPricingType: true, addonBehavior: true,
      addonUnitLabel: true, addonMinUnits: true, addonMaxUnits: true,
      addonPercentage: true, applicableTags: true,
      category: { select: { id: true, key: true, name: true } },
      tags:     { select: { id: true, key: true, name: true } },
    },
  });

  for (const p of pricelessAddons) {
    productMap.set(p.id, { product: p as typeof groupPricingRows[number]["product"], prices: [] });
  }

  const PERIOD_ORDER = ["MONTHLY", "SIX_MONTHS", "YEARLY", "ONE_TIME"];

  const allProducts = [...productMap.values()].map(({ product, prices }) => ({
    id: product.id, key: product.key, name: product.name, type: product.type as string,
    category: product.category ?? null, tags: product.tags,
    billingPeriods: product.billingPeriods as string[],
    prices: prices
      .sort((a, b) => (PERIOD_ORDER.indexOf(a.billingPeriod) === -1 ? 99 : PERIOD_ORDER.indexOf(a.billingPeriod)) - (PERIOD_ORDER.indexOf(b.billingPeriod) === -1 ? 99 : PERIOD_ORDER.indexOf(b.billingPeriod)))
      .map(p => ({ ...p, currency })),
    unitLabel:        product.unitLabel        ?? null,
    addonPricingType: product.addonPricingType ?? null,
    addonBehavior:    product.addonBehavior    ?? null,
    addonUnitLabel:   product.addonUnitLabel   ?? null,
    addonMinUnits:    product.addonMinUnits    ?? null,
    addonMaxUnits:    product.addonMaxUnits    ?? null,
    addonPercentage:  product.addonPercentage !== null && product.addonPercentage !== undefined
                        ? Number(product.addonPercentage) : null,
    applicableTags: product.applicableTags ?? [],
  })).sort((a, b) => a.name.localeCompare(b.name));

  if (!rich) {
    return NextResponse.json({
      ok: true,
      products: allProducts.map(p => ({
        id: p.id, name: p.name, key: p.key, currency,
        categoryKey:      p.category?.key ?? null,
        yearlyPriceCents: p.prices.find(pr => pr.billingPeriod === "YEARLY")?.priceCents ?? p.prices[0]?.priceCents ?? 0,
        introMonthCents:  p.prices.find(pr => pr.billingPeriod === "MONTHLY")?.priceCents ?? null,
      })),
    });
  }

  return NextResponse.json({
    ok:            true,
    currency,
    customerGroup: groupRow?.name ?? groupRow?.key ?? "Standard",
    market:        { key: user.market.key, name: user.market.name },
    plans:    allProducts.filter(p => p.type === "plan"),
    addons:   allProducts.filter(p => p.type === "addon"),
    services: allProducts.filter(p => p.type === "service" || p.type === "product"),
  });
}