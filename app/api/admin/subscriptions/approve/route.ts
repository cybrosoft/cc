export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import {
  SubscriptionStatus,
  PaymentStatus,
} from "@prisma/client";

export async function POST(req: Request) {
  const admin = await getSessionUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json(
      { ok: false, error: "FORBIDDEN" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const subscriptionId = body?.subscriptionId as string | undefined;

  if (!subscriptionId) {
    return NextResponse.json(
      { ok: false, error: "SUBSCRIPTION_REQUIRED" },
      { status: 400 }
    );
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    return NextResponse.json(
      { ok: false, error: "SUBSCRIPTION_NOT_FOUND" },
      { status: 404 }
    );
  }

  if (subscription.billingProvider !== "MANUAL") {
    return NextResponse.json(
      { ok: false, error: "NOT_MANUAL_SUBSCRIPTION" },
      { status: 400 }
    );
  }

  if (subscription.status !== SubscriptionStatus.PENDING_PAYMENT) {
    return NextResponse.json(
      { ok: false, error: "INVALID_SUBSCRIPTION_STATE" },
      { status: 400 }
    );
  }

  const now = new Date();
  const oneYearLater = new Date(now);
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      paymentStatus: PaymentStatus.PAID,
      status: SubscriptionStatus.ACTIVE,
      activatedAt: now,
      currentPeriodStart: now,
      currentPeriodEnd: oneYearLater,
      approvedByUserId: admin.id,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: "SUBSCRIPTION_APPROVED",
      entityType: "Subscription",
      entityId: updated.id,
      metadataJson: JSON.stringify({
        userId: updated.userId,
        amount: updated.yearlyPriceCents,
        currency: updated.currency,
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    subscriptionId: updated.id,
    status: updated.status,
  });
}