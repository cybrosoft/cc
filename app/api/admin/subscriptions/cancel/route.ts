// app/api/admin/subscriptions/cancel/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { SubscriptionStatus } from "@prisma/client";

export async function POST(req: Request) {
  const admin = await getSessionUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { subscriptionId?: string; reason?: string }
    | null;

  const subscriptionId = body?.subscriptionId?.trim();
  const reason = body?.reason?.trim();

  if (!subscriptionId) {
    return NextResponse.json(
      { ok: false, error: "SUBSCRIPTION_REQUIRED" },
      { status: 400 }
    );
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      status: true,
      userId: true,
      billingProvider: true,
      currency: true,
      yearlyPriceCents: true,
      canceledAt: true,
    },
  });

  if (!subscription) {
    return NextResponse.json(
      { ok: false, error: "SUBSCRIPTION_NOT_FOUND" },
      { status: 404 }
    );
  }

  if (subscription.status === SubscriptionStatus.CANCELED) {
    return NextResponse.json({
      ok: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      alreadyCanceled: true,
    });
  }

  const now = new Date();

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: SubscriptionStatus.CANCELED,
      canceledAt: now,
    },
    select: {
      id: true,
      status: true,
      canceledAt: true,
      userId: true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: "SUBSCRIPTION_CANCELED",
      entityType: "Subscription",
      entityId: updated.id,
      metadataJson: JSON.stringify({
        reason: reason ?? null,
        canceledAt: updated.canceledAt,
        userId: updated.userId,
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    subscriptionId: updated.id,
    status: updated.status,
    canceledAt: updated.canceledAt,
  });
}