// app/api/admin/catalog/pricing/override/upsert/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { BillingPeriod } from "@prisma/client";

const VALID_PERIODS: BillingPeriod[] = ["MONTHLY", "SIX_MONTHS", "YEARLY", "ONE_TIME"];

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    productId?:     string;
    marketId?:      string;
    userId?:        string;
    billingPeriod?: BillingPeriod;
    priceCents?:    number;
  } | null;

  const { productId, marketId, userId, billingPeriod, priceCents } = body ?? {};

  if (!productId || !marketId || !userId || !billingPeriod || typeof priceCents !== "number" || priceCents < 0) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  if (!VALID_PERIODS.includes(billingPeriod)) {
    return NextResponse.json({ ok: false, error: `Invalid billing period: ${billingPeriod}` }, { status: 400 });
  }

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) {
    return NextResponse.json({ ok: false, error: "Customer not found" }, { status: 404 });
  }

  try {
    const result = await prisma.customerPricingOverride.upsert({
      where: {
        productId_marketId_userId_billingPeriod: { productId, marketId, userId, billingPeriod },
      },
      update: { priceCents },
      create: { productId, marketId, userId, billingPeriod, priceCents },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId:  admin.id,
        action:       "PRICING_OVERRIDE_UPSERTED",
        entityType:   "CustomerPricingOverride",
        entityId:     result.id,
        metadataJson: JSON.stringify({ productId, marketId, userId, billingPeriod, priceCents }),
      },
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[pricing/override/upsert]", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}