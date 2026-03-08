// app/api/me/subscription/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { ok: false, error: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      billingProvider: true,
      currency: true,
      yearlyPriceCents: true,
      activatedAt: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      canceledAt: true,
      invoiceNumber: true,
      receiptFileName: true,
      receiptUploadedAt: true,
      createdAt: true,
    },
  });

  if (!subscription) {
    return NextResponse.json({ ok: true, subscription: null });
  }

  const now = new Date();
  const renewalDate = subscription.currentPeriodEnd ?? null;

  const isExpired =
    subscription.currentPeriodEnd !== null &&
    subscription.currentPeriodEnd.getTime() < now.getTime();

  return NextResponse.json({
    ok: true,
    subscription: {
      ...subscription,
      renewalDate,
      isExpired,
    },
  });
}