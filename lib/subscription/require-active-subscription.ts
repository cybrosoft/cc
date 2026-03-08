import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { SubscriptionStatus, PaymentStatus } from "@prisma/client";

export async function requireActiveSubscription(options?: {
  productKey?: string; // optional restriction
}) {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("unauthorized");
  }

  const now = new Date();

  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      status: SubscriptionStatus.ACTIVE,
      paymentStatus: PaymentStatus.PAID,
      currentPeriodEnd: {
        gt: now,
      },
      ...(options?.productKey && {
        product: {
          key: options.productKey,
        },
      }),
    },
    include: {
      product: true,
    },
  });

  if (!subscription) {
    throw new Error("subscription_required");
  }

  return subscription;
}