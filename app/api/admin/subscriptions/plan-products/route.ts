// FILE: app/api/admin/subscriptions/plan-products/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { ProductType, SubscriptionStatus } from "@prisma/client";

function s(v: string | null): string {
  return typeof v === "string" ? v : "";
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

  // ✅ Return PLAN subscriptions (dropdown value = subscription.id)
  const subscriptions = await prisma.subscription.findMany({
    where: {
      userId: customerId,
      status: { not: SubscriptionStatus.CANCELED },
      product: { type: ProductType.plan },
    },
    select: {
      id: true, // ✅ plan subscription id (this is what addon saves as parentSubscriptionId)
      status: true,
      product: { select: { name: true, key: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json({ ok: true, subscriptions });
}