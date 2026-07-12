// app/api/customer/services/[page]/route.ts
// Lists subscriptions for one customer-portal category page.
// Source of truth: Subscription model, filtered by product.category.key.
// "services" (Other Services) = anything not covered by a dedicated page.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

// Page key → DB category keys. Pages with no categories yet return empty.
const PAGE_CATEGORIES: Record<string, string[]> = {
  gpu:        ["servers-g"],
  storage:    ["storage"],
  backup:     ["backups"],
  network:    ["ip"],
  email:      ["email"],
  security:   ["ssl"],
  domains:    ["domain", "dns"],
  database:   [],
  multicloud: [],
  aai:        [],
};

// Every key claimed by a dedicated page (incl. servers page).
// "Other Services" shows everything outside this list — future categories
// appear there automatically until they get their own page.
const COVERED_KEYS = ["server", ...Object.values(PAGE_CATEGORIES).flat()];

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ page: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const { page } = await ctx.params;

    if (page !== "services" && !(page in PAGE_CATEGORIES)) {
      return NextResponse.json({ ok: false, error: "Unknown page" }, { status: 404 });
    }

    const categoryFilter =
      page === "services"
        ? { NOT: { category: { key: { in: COVERED_KEYS } } } }
        : PAGE_CATEGORIES[page].length > 0
          ? { category: { key: { in: PAGE_CATEGORIES[page] } } }
          : null;

    // Pages whose categories don't exist yet → empty list, no query
    if (!categoryFilter) return NextResponse.json({ ok: true, data: [] });

    const [subscriptions, allLocations] = await Promise.all([
      prisma.subscription.findMany({
        where: {
          userId: user.id,
          product: categoryFilter,
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id:                 true,
          status:             true,
          paymentStatus:      true,
          billingPeriod:      true,
          currentPeriodEnd:   true,
          locationCode:       true,
          productDetails:     true,
          quantity:           true,
          createdAt:          true,
          product: {
            select: { key: true, name: true, unitLabel: true, category: { select: { key: true, name: true } } },
          },
        },
      }),
      prisma.location.findMany({
        select: { code: true, name: true, countryCode: true },
      }),
    ]);

    const locationMap = new Map(allLocations.map(l => [l.code, l]));

    const data = subscriptions.map(sub => {
      // Same custom-name derivation as /api/servers/me
      const firstLine  = sub.productDetails ? sub.productDetails.split("\n")[0].trim() : null;
      const serverName = !firstLine || firstLine === sub.product?.name ? null : firstLine;

      const loc = sub.locationCode ? locationMap.get(sub.locationCode) : null;
      const locationDisplay = loc
        ? (loc.countryCode ? `${loc.countryCode} - ${loc.name}` : loc.name)
        : (sub.locationCode ?? null);

      return {
        subscriptionId: sub.id,
        name:           serverName,
        productName:    sub.product?.name ?? "—",
        productKey:     sub.product?.key  ?? null,
        categoryName:   sub.product?.category?.name ?? null,
        unitLabel:      sub.product?.unitLabel ?? null,
        quantity:       sub.quantity,
        status:         String(sub.status),
        paymentStatus:  String(sub.paymentStatus),
        billingPeriod:  String(sub.billingPeriod),
        periodEnd:      sub.currentPeriodEnd?.toISOString() ?? null,
        locationDisplay,
        createdAt:      sub.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "Request failed" }, { status: 500 });
  }
}
