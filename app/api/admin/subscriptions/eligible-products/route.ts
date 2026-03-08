export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { Role } from "@prisma/client";

function s(v: string | null): string {
  return typeof v === "string" ? v : "";
}

async function getEffectiveCustomerGroupId(userCustomerGroupId: string | null): Promise<string | null> {
  if (userCustomerGroupId) return userCustomerGroupId;

  const def = await prisma.customerGroup.findFirst({
    where: { isDefault: true, isActive: true },
    select: { id: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return def?.id ?? null;
}

export async function GET(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const customerId = s(searchParams.get("customerId")).trim();
  if (!customerId) {
    return NextResponse.json({ ok: false, error: "CUSTOMER_ID_REQUIRED" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: { id: true, role: true, marketId: true, customerGroupId: true },
  });

  if (!user) return NextResponse.json({ ok: false, error: "CUSTOMER_NOT_FOUND" }, { status: 404 });
  if (user.role !== Role.CUSTOMER) return NextResponse.json({ ok: false, error: "NOT_A_CUSTOMER" }, { status: 400 });

  const effectiveGroupId = await getEffectiveCustomerGroupId(user.customerGroupId);
  if (!effectiveGroupId) {
    return NextResponse.json({ ok: false, error: "DEFAULT_CUSTOMER_GROUP_NOT_FOUND" }, { status: 500 });
  }

  const rows = await prisma.productGroupPricing.findMany({
    where: {
      isActive: true,
      marketId: user.marketId,
      customerGroupId: effectiveGroupId,
      product: { isActive: true },
    },
    select: {
      product: {
        select: {
          id: true,
          name: true,
          key: true,
          category: { select: { key: true } }, // ✅ NEW
        },
      },
      currency: true,
      yearlyPriceCents: true,
      introMonthCents: true,
    },
    orderBy: [{ product: { name: "asc" } }],
  });

  const products = rows.map((r) => ({
    id: r.product.id,
    name: r.product.name,
    key: r.product.key,
    categoryKey: r.product.category?.key ?? null, // ✅ NEW
    currency: r.currency,
    yearlyPriceCents: r.yearlyPriceCents,
    introMonthCents: r.introMonthCents ?? null,
  }));

  return NextResponse.json({ ok: true, products });
}