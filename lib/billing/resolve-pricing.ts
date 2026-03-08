// lib/billing/resolve-pricing.ts
//
// Resolves the full product catalog for a given user, applying their market,
// customer group pricing, enterprise per-customer overrides, and optional filters.
//
// SCHEMA MIGRATION NOTES (old → new):
//   Pricing.yearlyPriceCents / introMonthCents / monthlyDisplayCents / currency
//     → replaced by one row per BillingPeriod with Pricing.priceCents
//   Pricing.billingMode / introMonths  → replaced by Product.billingPeriods[]
//   CustomerGroup.isDefault            → replaced by key = "standard" convention
//                                        (falls back to first active group found)
//   Pricing.currency                   → now comes from Market.defaultCurrency
//
// Filter params (all optional):
//   tags     – OR logic: products matching ANY of the provided tag keys
//   category – filter by category key  e.g. "cloud-servers"
//   type     – filter by product type  e.g. "plan" | "addon" | "service" | "product"
//
// API usage:
//   /api/catalog
//   /api/catalog?tag=windows
//   /api/catalog?tag=windows&tag=linux
//   /api/catalog?tag=linux&category=cloud-servers
//   /api/catalog?category=cloud-servers&type=plan

import { prisma } from "@/lib/prisma";
import { BillingPeriod, ProductType } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CatalogFilters {
  tags?:     string[];  // tag keys, OR logic
  category?: string;    // category key
  type?:     string;    // product type
}

export interface CatalogPrice {
  billingPeriod: BillingPeriod;
  priceCents:    number;
  currency:      string;
  isOverride:    boolean; // true = enterprise per-customer price override
}

export interface CatalogProduct {
  id:             string;
  key:            string;
  name:           string;
  type:           ProductType;
  billingPeriods: BillingPeriod[];  // periods supported by this product
  category:       { id: string; key: string; name: string } | null;
  tags:           { id: string; key: string; name: string }[];
  prices:         CatalogPrice[];   // one entry per available billing period
}

export interface CatalogCategory {
  id:       string;
  key:      string;
  name:     string;
  products: CatalogProduct[];
}

export interface ResolvedCatalog {
  market: {
    key:             string;
    defaultCurrency: string;
    zohoOrgId:       string | null;
  };
  customerGroup: string;  // key of the group whose pricing was applied
  currency:      string;
  categories:    CatalogCategory[];
}

// ─── Main resolver ────────────────────────────────────────────────────────────

export async function resolveCatalogForUser(params: {
  userId:    string;
  currency?: string;
  filters?:  CatalogFilters;
}): Promise<ResolvedCatalog> {

  // 1. Load user with market + group ─────────────────────────────────────────

  const user = await prisma.user.findUnique({
    where:   { id: params.userId },
    select: {
      id:   true,
      marketId: true,
      market: {
        select: {
          id:              true,
          key:             true,
          defaultCurrency: true,
          zohoOrgId:       true,
        },
      },
      customerGroupId: true,
      customerGroup: {
        select: { id: true, key: true, name: true, isActive: true },
      },
    },
  });

  if (!user) throw new Error("user_not_found");

  const market = user.market;

  // Currency validation — must match market (no cross-currency)
  const requestedCurrency = params.currency?.toUpperCase();
  const currency = requestedCurrency ?? market.defaultCurrency.toUpperCase();
  if (currency !== market.defaultCurrency.toUpperCase()) {
    throw new Error("invalid_currency_for_market");
  }

  // 2. Resolve customer group ─────────────────────────────────────────────────
  //
  // Priority:
  //   1. User's own active group (e.g. business, enterprise)
  //   2. "standard" group (replaces old isDefault=true convention)
  //   3. First active group found (safety fallback)

  const activeUserGroup =
    user.customerGroup?.isActive ? user.customerGroup : null;

  // Find the standard group as fallback (was isDefault in old schema)
  const standardGroup = await prisma.customerGroup.findFirst({
    where:  { key: "standard", isActive: true },
    select: { id: true, key: true, name: true },
  });

  // Ultimate fallback: any active group
  const fallbackGroup = standardGroup ?? await prisma.customerGroup.findFirst({
    where:  { isActive: true },
    select: { id: true, key: true, name: true },
  });

  if (!fallbackGroup) throw new Error("no_active_customer_group_found");

  const resolvedGroup   = activeUserGroup ?? fallbackGroup;
  const preferredGroupId = resolvedGroup.id;
  const fallbackGroupId  = fallbackGroup.id;

  // 3. Build product where clause ────────────────────────────────────────────

  const productWhere: Record<string, unknown> = { isActive: true };

  if (params.filters?.type) {
    const validTypes: ProductType[] = ["plan", "addon", "service", "product"];
    if (validTypes.includes(params.filters.type as ProductType)) {
      productWhere.type = params.filters.type;
    }
  }

  if (params.filters?.category) {
    productWhere.category = { key: params.filters.category };
  }

  if (params.filters?.tags && params.filters.tags.length > 0) {
    // OR logic — product must have at least one of the requested tag keys
    productWhere.tags = { some: { key: { in: params.filters.tags } } };
  }

  // 4. Fetch categories + products ───────────────────────────────────────────

  const categories = await prisma.category.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select: {
      id:   true,
      key:  true,
      name: true,
      products: {
        where:   productWhere,
        orderBy: { name: "asc" },
        select: {
          id:             true,
          key:            true,
          name:           true,
          type:           true,
          billingPeriods: true,
          category:       { select: { id: true, key: true, name: true } },
          tags:           { select: { id: true, key: true, name: true } },
        },
      },
    },
  });

  // Collect all product IDs across all categories
  const allProducts  = categories.flatMap((c) => c.products);
  const productIds   = allProducts.map((p) => p.id);

  if (productIds.length === 0) {
    return {
      market:        { key: market.key, defaultCurrency: market.defaultCurrency, zohoOrgId: market.zohoOrgId ?? null },
      customerGroup: resolvedGroup.key,
      currency,
      categories:    [],
    };
  }

  // 5. Fetch group pricing ────────────────────────────────────────────────────
  //    Fetch both preferred group and fallback in one query

  const groupIds = Array.from(new Set([preferredGroupId, fallbackGroupId]));

  const allGroupPricing = await prisma.pricing.findMany({
    where: {
      productId:       { in: productIds },
      marketId:        market.id,
      customerGroupId: { in: groupIds },
      isActive:        true,
    },
    select: {
      productId:       true,
      customerGroupId: true,
      billingPeriod:   true,
      priceCents:      true,
    },
  });

  // 6. Fetch enterprise per-customer overrides ───────────────────────────────

  const overrides = await prisma.customerPricingOverride.findMany({
    where: {
      productId: { in: productIds },
      marketId:  market.id,
      userId:    params.userId,
    },
    select: {
      productId:     true,
      billingPeriod: true,
      priceCents:    true,
    },
  });

  // 7. Build lookup maps ─────────────────────────────────────────────────────

  // `productId:groupId:period` → cents
  const groupPriceMap = new Map<string, number>();
  for (const p of allGroupPricing) {
    groupPriceMap.set(`${p.productId}:${p.customerGroupId}:${p.billingPeriod}`, p.priceCents);
  }

  // `productId:period` → cents  (enterprise override wins over everything)
  const overrideMap = new Map<string, number>();
  for (const o of overrides) {
    overrideMap.set(`${o.productId}:${o.billingPeriod}`, o.priceCents);
  }

  // 8. Assemble catalog ──────────────────────────────────────────────────────

  const resolvedCategories: CatalogCategory[] = categories
    .map((category) => {
      const resolvedProducts: CatalogProduct[] = category.products.map((product) => {
        const prices: CatalogPrice[] = [];

        for (const period of product.billingPeriods) {
          const overrideKey  = `${product.id}:${period}`;
          const preferredKey = `${product.id}:${preferredGroupId}:${period}`;
          const fallbackKey  = `${product.id}:${fallbackGroupId}:${period}`;

          const overrideCents  = overrideMap.get(overrideKey);
          const preferredCents = groupPriceMap.get(preferredKey);
          const fallbackCents  = groupPriceMap.get(fallbackKey);

          const priceCents = overrideCents ?? preferredCents ?? fallbackCents;

          if (priceCents !== undefined) {
            prices.push({
              billingPeriod: period,
              priceCents,
              currency,
              isOverride: overrideCents !== undefined,
            });
          }
        }

        return {
          id:             product.id,
          key:            product.key,
          name:           product.name,
          type:           product.type,
          billingPeriods: product.billingPeriods,
          category:       product.category,
          tags:           product.tags,
          prices,
        };
      });

      return {
        id:       category.id,
        key:      category.key,
        name:     category.name,
        products: resolvedProducts,
      };
    })
    // Drop categories that have no products after filtering
    .filter((c) => c.products.length > 0);

  return {
    market: {
      key:             market.key,
      defaultCurrency: market.defaultCurrency,
      zohoOrgId:       market.zohoOrgId ?? null,
    },
    customerGroup: resolvedGroup.key,
    currency,
    categories:    resolvedCategories,
  };
}