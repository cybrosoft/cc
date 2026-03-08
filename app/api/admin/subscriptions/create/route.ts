// FILE: app/api/admin/subscriptions/create/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import {
  BillingProvider,
  PaymentStatus,
  Role,
  SubscriptionPhase,
  SubscriptionStatus,
} from "@prisma/client";

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

const LOCATIONS_SERVERS_G = ["Europe Central"] as const;

const LOCATIONS_SERVERS_O = [
  "Saudi Arabia - Jeddah",
  "Saudi Arabia - Riyadh",
  "United States",
  "United Kingdome",
  "United Aarab Emirates",
  "Australia",
  "India",
  "Japan",
  "Malaysia",
  "Singapore",
  "South Korea",
] as const;

type ServersGLocation = (typeof LOCATIONS_SERVERS_G)[number];
type ServersOLocation = (typeof LOCATIONS_SERVERS_O)[number];

function isServersGLocation(v: string): v is ServersGLocation {
  return (LOCATIONS_SERVERS_G as readonly string[]).includes(v);
}

function isServersOLocation(v: string): v is ServersOLocation {
  return (LOCATIONS_SERVERS_O as readonly string[]).includes(v);
}

async function getEffectiveCustomerGroupId(userCustomerGroupId: string | null): Promise<string | null> {
  if (userCustomerGroupId) return userCustomerGroupId;

  const def = await prisma.customerGroup.findFirst({
    where: { isDefault: true, isActive: true },
    select: { id: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  return def?.id ?? null;
}

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        customerId?: unknown;
        productId?: unknown;
        location?: unknown;

        // ✅ NEW
        productDetails?: unknown;
        productNote?: unknown;
      }
    | null;

  const customerId = s(body?.customerId).trim();
  const productId = s(body?.productId).trim();
  const locationInput = s(body?.location).trim();

  // ✅ NEW (trim but allow empty -> store null)
  const productDetails = s(body?.productDetails).trim();
  const productNote = s(body?.productNote).trim();

  if (!customerId) return NextResponse.json({ ok: false, error: "CUSTOMER_ID_REQUIRED" }, { status: 400 });
  if (!productId) return NextResponse.json({ ok: false, error: "PRODUCT_ID_REQUIRED" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      role: true,
      marketId: true,
      customerGroupId: true,
      market: { select: { billingProvider: true } },
    },
  });

  if (!user) return NextResponse.json({ ok: false, error: "CUSTOMER_NOT_FOUND" }, { status: 404 });
  if (user.role !== Role.CUSTOMER) return NextResponse.json({ ok: false, error: "NOT_A_CUSTOMER" }, { status: 400 });

  const effectiveGroupId = await getEffectiveCustomerGroupId(user.customerGroupId);
  if (!effectiveGroupId) {
    return NextResponse.json({ ok: false, error: "DEFAULT_CUSTOMER_GROUP_NOT_FOUND" }, { status: 500 });
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      isActive: true,
      category: { select: { key: true } },
    },
  });

  if (!product || !product.isActive) {
    return NextResponse.json({ ok: false, error: "PRODUCT_NOT_FOUND" }, { status: 404 });
  }

  const categoryKey = product.category?.key ?? "";

  let provisionLocation: string | null = null;

  if (categoryKey === "servers-g") {
    if (!locationInput) provisionLocation = LOCATIONS_SERVERS_G[0];
    else if (!isServersGLocation(locationInput)) {
      return NextResponse.json({ ok: false, error: "INVALID_LOCATION_FOR_SERVERS_G" }, { status: 400 });
    } else provisionLocation = locationInput;
  } else if (categoryKey === "servers-o") {
    if (!locationInput) provisionLocation = LOCATIONS_SERVERS_O[0];
    else if (!isServersOLocation(locationInput)) {
      return NextResponse.json({ ok: false, error: "INVALID_LOCATION_FOR_SERVERS_O" }, { status: 400 });
    } else provisionLocation = locationInput;
  } else {
    provisionLocation = null;
  }

  const pricing = await prisma.productGroupPricing.findFirst({
    where: {
      isActive: true,
      productId,
      marketId: user.marketId,
      customerGroupId: effectiveGroupId,
      product: { isActive: true },
    },
    select: {
      currency: true,
      yearlyPriceCents: true,
      introMonthCents: true,
    },
  });

  if (!pricing) {
    return NextResponse.json({ ok: false, error: "PRICING_NOT_FOUND_FOR_CUSTOMER_MARKET_GROUP" }, { status: 400 });
  }

  const billingProvider: BillingProvider = user.market?.billingProvider ?? BillingProvider.MANUAL;

  const sub = await prisma.subscription.create({
    data: {
      userId: user.id,
      productId,
      marketId: user.marketId,
      customerGroupId: effectiveGroupId,

      billingProvider,
      currency: pricing.currency,
      yearlyPriceCents: pricing.yearlyPriceCents,
      introMonthCents: pricing.introMonthCents ?? null,

      provisionLocation,

      status: SubscriptionStatus.PENDING_PAYMENT,
      phase: SubscriptionPhase.STANDARD,
      paymentStatus: PaymentStatus.UNPAID,

      // ✅ NEW
      productDetails: productDetails.length > 0 ? productDetails : null,
      productNote: productNote.length > 0 ? productNote : null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, subscriptionId: sub.id });
}