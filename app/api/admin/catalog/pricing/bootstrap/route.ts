export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

export async function GET() {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const [markets, groups, products, pricing] = await Promise.all([
    prisma.market.findMany({ where: { isActive: true }, select: { id: true, name: true, key: true }, orderBy: { name: "asc" } }),
    prisma.customerGroup.findMany({ where: { isActive: true }, select: { id: true, name: true, key: true }, orderBy: { priority: "desc" } }),
    prisma.product.findMany({ where: { isActive: true }, select: { id: true, name: true, key: true }, orderBy: { name: "asc" } }),
    prisma.productGroupPricing.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        market: { select: { id: true, name: true, key: true } },
        customerGroup: { select: { id: true, name: true, key: true } },
        product: { select: { id: true, name: true, key: true } },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, markets, groups, products, pricing });
}