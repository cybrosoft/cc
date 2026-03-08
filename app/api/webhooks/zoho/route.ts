import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SubscriptionStatus, PaymentStatus } from "@prisma/client";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);

  // TODO: Verify Zoho webhook signature in production

  const eventType = body?.event_type as string | undefined;
  const zohoSubscriptionId =
    body?.data?.subscription?.subscription_id as string | undefined;

  if (!eventType || !zohoSubscriptionId) {
    return NextResponse.json(
      { ok: false, error: "invalid_payload" },
      { status: 400 }
    );
  }

  const subscription = await prisma.subscription.findFirst({
    where: { zohoSubscriptionId },
  });

  if (!subscription) {
    return NextResponse.json(
      { ok: false, error: "subscription_not_found" },
      { status: 404 }
    );
  }

  //////////////////////////////////////////////////////
  // ACTIVATED (Payment success)
  //////////////////////////////////////////////////////
  if (eventType === "subscription_activated") {
    const now = new Date();
    const oneYearLater = new Date(now);
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        paymentStatus: PaymentStatus.PAID,
        activatedAt: now,
        currentPeriodStart: now,
        currentPeriodEnd: oneYearLater,
      },
    });

    // ❌ NO provisioning
    // ❌ NO infra actions

    return NextResponse.json({ ok: true });
  }

  //////////////////////////////////////////////////////
  // PAYMENT FAILED
  //////////////////////////////////////////////////////
  if (eventType === "subscription_payment_failed") {
    await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          paymentStatus: PaymentStatus.FAILED,
        },
      });

    return NextResponse.json({ ok: true });
  }

  //////////////////////////////////////////////////////
  // CANCELED
  //////////////////////////////////////////////////////
  if (eventType === "subscription_cancelled") {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.CANCELED,
      },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: true });
}