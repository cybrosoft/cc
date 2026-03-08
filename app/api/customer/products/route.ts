export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { ProductType } from "@prisma/client";

type Out = {
  id: string;
  name: string;
  currency: string;
  yearlyPriceCents: number;
  introMonthCents: number | null;
};

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // resolve customer group: user's group or default
  let customerGroupId = user.customerGroupId;

  if (!customerGroupId) {
    const def = await prisma.customerGroup.findFirst({
      where: { isDefault: true, isActive: true },
      select: { id: true },
    });

    if (!def) {
      return NextResponse.json({ ok: false, error: "NO_DEFAULT_GROUP" }, { status: 500 });
    }

    customerGroupId = def.id;
  }

  // Find pricing rows for this customer (market + group), and map to products
  const priced = await prisma.productGroupPricing.findMany({
    where: {
      isActive: true,
      marketId: user.marketId,
      customerGroupId,
      product: {
        isActive: true,
        type: ProductType.plan,
      },
    },
    orderBy: { product: { createdAt: "asc" } },
    select: {
      currency: true,
      yearlyPriceCents: true,
      introMonthCents: true,
      product: { select: { id: true, name: true } },
    },
  });

  const data: Out[] = priced.map((p) => ({
    id: p.product.id,
    name: p.product.name,
    currency: p.currency,
    yearlyPriceCents: p.yearlyPriceCents,
    introMonthCents: p.introMonthCents,
  }));

  return NextResponse.json({ ok: true, data });
}