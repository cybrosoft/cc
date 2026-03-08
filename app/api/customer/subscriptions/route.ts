export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth"; // keep as you have it

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const subs = await prisma.subscription.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      phase: true,
      paymentStatus: true,
      billingProvider: true,
      currency: true,
      yearlyPriceCents: true,
      introMonthCents: true,
      activatedAt: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      canceledAt: true,
      createdAt: true,
      product: { select: { id: true, name: true, key: true, type: true } },
      market: { select: { id: true, name: true, key: true } },
    },
  });

  return NextResponse.json({ ok: true, data: subs });
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const raw = (await req.json().catch(() => null)) as unknown;
    if (!raw || !isRecord(raw)) {
      return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
    }

    const productId = (readString(raw, "productId") ?? "").trim();
    if (!productId) {
      return NextResponse.json({ ok: false, error: "Product required" }, { status: 400 });
    }

    // Ensure user has customer group
    let customerGroupId = user.customerGroupId;
    if (!customerGroupId) {
      const defaultGroup = await prisma.customerGroup.findFirst({
        where: { isDefault: true, isActive: true },
        select: { id: true },
      });

      if (!defaultGroup) {
        return NextResponse.json({ ok: false, error: "No default group configured" }, { status: 500 });
      }

      customerGroupId = defaultGroup.id;
    }

    const market = await prisma.market.findUnique({
      where: { id: user.marketId },
      select: {
        id: true,
        billingProvider: true,
        defaultCurrency: true,
      },
    });

    if (!market) {
      return NextResponse.json({ ok: false, error: "Market not found" }, { status: 500 });
    }

    const pricing = await prisma.productGroupPricing.findFirst({
      where: {
        productId,
        marketId: market.id,
        customerGroupId,
        isActive: true,
      },
      select: {
        currency: true,
        yearlyPriceCents: true,
        introMonthCents: true,
      },
    });

    if (!pricing) {
      return NextResponse.json({ ok: false, error: "Pricing not found" }, { status: 400 });
    }

    const status = market.billingProvider === "MANUAL" ? "PENDING_PAYMENT" : "PENDING_EXTERNAL";

    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        productId,
        marketId: market.id,
        customerGroupId,
        billingProvider: market.billingProvider,
        currency: pricing.currency,
        yearlyPriceCents: pricing.yearlyPriceCents,
        introMonthCents: pricing.introMonthCents,
        status,
        paymentStatus: "UNPAID",
      },
      select: {
        id: true,
        status: true,
      },
    });

    return NextResponse.json({ ok: true, data: subscription });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}