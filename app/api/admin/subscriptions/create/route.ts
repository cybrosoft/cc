// app/api/admin/subscriptions/create/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { BillingPeriod, Role, SubscriptionStatus, PaymentStatus } from "@prisma/client";

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

// ── Location constants (stored in Subscription.locationCode) ─────────────────

const LOCATIONS_SERVERS_G = ["Europe Central"] as const;
type ServersGLocation = (typeof LOCATIONS_SERVERS_G)[number];

const LOCATIONS_SERVERS_O = [
  "Saudi Arabia - Jeddah",
  "Saudi Arabia - Riyadh",
  "United States",
  "United Kingdom",
  "United Arab Emirates",
  "Australia",
  "India",
  "Japan",
  "Malaysia",
  "Singapore",
  "South Korea",
] as const;
type ServersOLocation = (typeof LOCATIONS_SERVERS_O)[number];

function isServersGLocation(v: string): v is ServersGLocation {
  return (LOCATIONS_SERVERS_G as readonly string[]).includes(v);
}
function isServersOLocation(v: string): v is ServersOLocation {
  return (LOCATIONS_SERVERS_O as readonly string[]).includes(v);
}

// ─────────────────────────────────────────────────────────────────────────────

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
        productDetails?: unknown;
        productNote?: unknown;
      }
    | null;

  const customerId = s(body?.customerId).trim();
  const productId = s(body?.productId).trim();
  const locationInput = s(body?.location).trim();
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
    },
  });

  if (!user) return NextResponse.json({ ok: false, error: "CUSTOMER_NOT_FOUND" }, { status: 404 });
  if (user.role !== Role.CUSTOMER) return NextResponse.json({ ok: false, error: "NOT_A_CUSTOMER" }, { status: 400 });

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

  // ── Location validation ───────────────────────────────────────────────────
  const categoryKey = product.category?.key ?? "";
  let locationCode: string | null = null;

  if (categoryKey === "servers-g") {
    if (!locationInput) locationCode = LOCATIONS_SERVERS_G[0];
    else if (!isServersGLocation(locationInput)) {
      return NextResponse.json({ ok: false, error: "INVALID_LOCATION_FOR_SERVERS_G" }, { status: 400 });
    } else locationCode = locationInput;
  } else if (categoryKey === "servers-o") {
    if (!locationInput) locationCode = LOCATIONS_SERVERS_O[0];
    else if (!isServersOLocation(locationInput)) {
      return NextResponse.json({ ok: false, error: "INVALID_LOCATION_FOR_SERVERS_O" }, { status: 400 });
    } else locationCode = locationInput;
  }

  // ── Verify pricing exists for this product + market ───────────────────────
  const pricing = await prisma.pricing.findFirst({
    where: {
      isActive: true,
      productId,
      marketId: user.marketId,
      billingPeriod: BillingPeriod.YEARLY,
    },
    select: { id: true },
  });

  if (!pricing) {
    return NextResponse.json(
      { ok: false, error: "PRICING_NOT_FOUND_FOR_PRODUCT_AND_MARKET" },
      { status: 400 }
    );
  }

  // ── Create subscription (only fields that exist on the current schema) ────
  const sub = await prisma.subscription.create({
    data: {
      userId: user.id,
      productId,
      marketId: user.marketId,

      billingPeriod: BillingPeriod.YEARLY,
      status: SubscriptionStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.UNPAID,

      locationCode: locationCode ?? null,

      productDetails: productDetails.length > 0 ? productDetails : null,
      productNote: productNote.length > 0 ? productNote : null,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, subscriptionId: sub.id });
}