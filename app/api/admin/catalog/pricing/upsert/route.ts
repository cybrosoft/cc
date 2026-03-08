// app/api/admin/catalog/pricing/upsert/route.ts
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
    productId:       string;
    marketId:        string;
    customerGroupId: string;
    entries: { period: BillingPeriod; cents: number }[];
  } | null;

  if (
    !body?.productId || !body?.marketId || !body?.customerGroupId ||
    !Array.isArray(body.entries) || body.entries.length === 0
  ) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  for (const e of body.entries) {
    if (!VALID_PERIODS.includes(e.period)) {
      return NextResponse.json({ ok: false, error: `Invalid period: ${e.period}` }, { status: 400 });
    }
    if (typeof e.cents !== "number" || e.cents < 0) {
      return NextResponse.json({ ok: false, error: "priceCents must be a non-negative number" }, { status: 400 });
    }
  }

  // Upsert each period entry
  const results = await Promise.all(
    body.entries.map((e) =>
      prisma.pricing.upsert({
        where: {
          productId_marketId_customerGroupId_billingPeriod: {
            productId:       body.productId,
            marketId:        body.marketId,
            customerGroupId: body.customerGroupId,
            billingPeriod:   e.period,
          },
        },
        update: { priceCents: e.cents, isActive: true },
        create: {
          productId:       body.productId,
          marketId:        body.marketId,
          customerGroupId: body.customerGroupId,
          billingPeriod:   e.period,
          priceCents:      e.cents,
          isActive:        true,
        },
      })
    )
  );

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "PRICING_UPSERTED",
      entityType:   "Pricing",
      entityId:     body.productId,
      metadataJson: JSON.stringify({
        productId: body.productId,
        marketId:  body.marketId,
        groupId:   body.customerGroupId,
        entries:   body.entries,
      }),
    },
  });

  return NextResponse.json({ ok: true, data: results });
}