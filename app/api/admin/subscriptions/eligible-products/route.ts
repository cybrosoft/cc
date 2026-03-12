// app/api/admin/subscriptions/eligible-products/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma }       from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { Role }         from "@prisma/client";

async function getEffectiveGroupId(userGroupId: string | null): Promise<string | null> {
  if (userGroupId) return userGroupId;
  const def = await prisma.customerGroup.findFirst({
    where: { isDefault: true, isActive: true },
    select: { id: true },
  });
  return def?.id ?? null;
}

// ── GET /api/admin/subscriptions/eligible-products?customerId=xxx ─────────────
export async function GET(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customerId")?.trim() ?? "";
    if (!customerId) return NextResponse.json({ ok: false, error: "CUSTOMER_ID_REQUIRED" }, { status: 400 });

    const user = await prisma.user.findUnique({
      where: { id: customerId },
      select: { id: true, role: true, marketId: true, customerGroupId: true },
    });
    if (!user)                       return NextResponse.json({ ok: false, error: "CUSTOMER_NOT_FOUND" }, { status: 404 });
    if (user.role !== Role.CUSTOMER) return NextResponse.json({ ok: false, error: "NOT_A_CUSTOMER" }, { status: 400 });

    const effectiveGroupId = await getEffectiveGroupId(user.customerGroupId);
    if (!effectiveGroupId) return NextResponse.json({ ok: false, error: "DEFAULT_CUSTOMER_GROUP_NOT_FOUND" }, { status: 500 });

    // Use the Pricing model (priceCents + billingPeriod, not yearlyPriceCents)
    const rows = await prisma.pricing.findMany({
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
            id:       true,
            name:     true,
            key:      true,
            category: { select: { id: true, key: true, name: true } },
          },
        },
      },
      orderBy: [{ product: { name: "asc" } }, { billingPeriod: "asc" }],
    });

    // Group by product, pick the best price to show (YEARLY preferred)
    const productMap = new Map<string, {
      id: string; name: string; key: string;
      categoryKey: string | null; categoryName: string | null;
      billingPeriod: string; priceCents: number;
    }>();

    for (const r of rows) {
      const pid = r.product.id;
      const existing = productMap.get(pid);
      // Prefer YEARLY, then MONTHLY — first encounter wins per period priority
      const priority: Record<string, number> = { YEARLY: 0, SIX_MONTHS: 1, MONTHLY: 2, ONE_TIME: 3 };
      const newPrio = priority[r.billingPeriod] ?? 99;
      const curPrio = existing ? (priority[existing.billingPeriod] ?? 99) : 99;
      if (!existing || newPrio < curPrio) {
        productMap.set(pid, {
          id:           r.product.id,
          name:         r.product.name,
          key:          r.product.key,
          categoryKey:  r.product.category?.key  ?? null,
          categoryName: r.product.category?.name ?? null,
          billingPeriod: r.billingPeriod,
          priceCents:   r.priceCents,
        });
      }
    }

    const products = [...productMap.values()];
    return NextResponse.json({ ok: true, products });
  } catch (e: any) {
    console.error("[eligible-products]", e);
    return NextResponse.json({ ok: false, error: e.message ?? "Failed" }, { status: 500 });
  }
}