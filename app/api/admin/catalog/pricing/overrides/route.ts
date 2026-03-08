// app/api/admin/catalog/pricing/overrides/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

export async function GET() {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const data = await prisma.customerPricingOverride.findMany({
    select: {
      id:            true,
      productId:     true,
      marketId:      true,
      userId:        true,
      billingPeriod: true,
      priceCents:    true,
      user: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, data });
}