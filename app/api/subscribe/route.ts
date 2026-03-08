import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { resolveCatalogForUser } from "@/lib/billing/resolve-pricing";
import { createZohoSubscription } from "@/lib/billing/zoho-client";
import {
  SubscriptionStatus,
  PaymentStatus,
  SubscriptionPhase,
} from "@prisma/client";

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => null);
  const productKey = body?.productKey as string | undefined;

  if (!productKey) {
    return NextResponse.json(
      { ok: false, error: "product_required" },
      { status: 400 }
    );
  }

  //////////////////////////////////////////////////////
  // 1️⃣ Load product
  //////////////////////////////////////////////////////
  const product = await prisma.product.findUnique({
    where: { key: productKey },
  });

  if (!product || !product.isActive) {
    return NextResponse.json(
      { ok: false, error: "invalid_product" },
      { status: 400 }
    );
  }

  //////////////////////////////////////////////////////
  // 2️⃣ Prevent Duplicate ACTIVE Subscription
  //////////////////////////////////////////////////////
  const existingActive = await prisma.subscription.findFirst({
    where: {
      userId: user.id,
      productId: product.id,
      status: SubscriptionStatus.ACTIVE,
    },
  });

  if (existingActive) {
    return NextResponse.json(
      { ok: false, error: "already_active_subscription" },
      { status: 400 }
    );
  }

  //////////////////////////////////////////////////////
  // 3️⃣ Prevent Intro Abuse
  //////////////////////////////////////////////////////
  if (product.billingMode === "YEARLY_WITH_INTRO_MONTH") {
    const usedIntro = await prisma.subscription.findFirst({
      where: {
        userId: user.id,
        productId: product.id,
        introUsed: true,
      },
    });

    if (usedIntro) {
      return NextResponse.json(
        { ok: false, error: "intro_already_used" },
        { status: 400 }
      );
    }
  }

  //////////////////////////////////////////////////////
  // 4️⃣ Resolve pricing
  //////////////////////////////////////////////////////
  const catalog = await resolveCatalogForUser({ userId: user.id });

  const resolvedProduct = catalog.categories
    .flatMap((c) => c.products)
    .find((p) => p.key === productKey);

  if (!resolvedProduct || !resolvedProduct.price) {
    return NextResponse.json(
      { ok: false, error: "pricing_not_configured" },
      { status: 400 }
    );
  }

  const market = user.market;
  const billingProvider = market.billingProvider;

  //////////////////////////////////////////////////////
  // 5️⃣ Determine initial status
  //////////////////////////////////////////////////////
  const initialStatus =
    billingProvider === "MANUAL"
      ? SubscriptionStatus.PENDING_PAYMENT
      : SubscriptionStatus.PENDING_EXTERNAL;

  //////////////////////////////////////////////////////
  // 6️⃣ Resolve Customer Group safely
  //////////////////////////////////////////////////////
  const defaultGroup = await prisma.customerGroup.findFirst({
    where: { isDefault: true, isActive: true },
  });

  if (!defaultGroup) {
    return NextResponse.json(
      { ok: false, error: "default_group_missing" },
      { status: 500 }
    );
  }

  const customerGroupId = user.customerGroupId ?? defaultGroup.id;

  //////////////////////////////////////////////////////
  // 7️⃣ Create subscription snapshot
  //////////////////////////////////////////////////////
  const subscription = await prisma.subscription.create({
    data: {
      userId: user.id,
      productId: product.id,
      marketId: user.marketId,
      customerGroupId,

      billingProvider,
      currency: resolvedProduct.price.currency,
      yearlyPriceCents: resolvedProduct.price.yearlyPriceCents,
      introMonthCents: resolvedProduct.price.introMonthCents,

      status: initialStatus,
      paymentStatus: PaymentStatus.UNPAID,

      phase:
        product.billingMode === "YEARLY_WITH_INTRO_MONTH"
          ? SubscriptionPhase.INTRO
          : SubscriptionPhase.STANDARD,

      introUsed:
        product.billingMode === "YEARLY_WITH_INTRO_MONTH" ? true : false,
    },
  });

  //////////////////////////////////////////////////////
  // GLOBAL - Manual Payment Flow
  //////////////////////////////////////////////////////
  if (billingProvider === "MANUAL") {
    return NextResponse.json({
      ok: true,
      mode: "manual",
      subscriptionId: subscription.id,
      paymentInstructions: market.manualPaymentInstructions,
      amountDueCents:
        subscription.phase === SubscriptionPhase.INTRO &&
        subscription.introMonthCents
          ? subscription.introMonthCents
          : subscription.yearlyPriceCents,
      currency: subscription.currency,
    });
  }

//////////////////////////////////////////////////////
// SAUDI - Zoho Flow
//////////////////////////////////////////////////////

    if (billingProvider === "ZOHO") {
    if (!product.zohoPlanId) {
        return NextResponse.json(
        { ok: false, error: "zoho_plan_not_configured" },
        { status: 500 }
        );
    }

    const zoho = await createZohoSubscription({
        zohoOrgId: market.zohoOrgId!,
        customerEmail: user.email,
        planCode: product.zohoPlanId,
    });

    await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
        zohoSubscriptionId: zoho.subscriptionId,
        zohoCustomerId: zoho.customerId,
        },
    });

    return NextResponse.json({
        ok: true,
        mode: "zoho",
        subscriptionId: subscription.id,
        redirectUrl: zoho.hostedPageUrl,
    });
    }
}