// app/api/admin/settings/markets/route.ts
// Returns all markets with their settings fields for the settings UI.

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const markets = await prisma.market.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true, key: true, name: true,
        defaultCurrency: true, billingProvider: true,
        vatPercent: true, legalInfo: true,
        companyProfile: true, paymentMethods: true,
        stripePublicKey: true,
        showPayOnline:   true,
        // stripeSecretKey intentionally omitted — masked below
        numberSeries: {
          select: { id: true, docType: true, prefix: true, nextNum: true },
          orderBy: { docType: "asc" },
        },
      },
    });

    // Mask secret key — indicate presence without exposing value
    const withMask = await Promise.all(
      markets.map(async m => {
        const secret = await prisma.market.findUnique({
          where:  { id: m.id },
          select: { stripeSecretKey: true },
        });
        return {
          ...m,
          stripeSecretKey: secret?.stripeSecretKey ? "••••••••••••••••" : "",
          hasStripeSecret: !!(secret?.stripeSecretKey),
        };
      })
    );

    return NextResponse.json({ ok: true, markets: withMask });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const {
      marketId, vatPercent, legalInfo, companyProfile,
      stripePublicKey, stripeSecretKey, showPayOnline,
    } = body;

    if (!marketId) return NextResponse.json({ error: "marketId required" }, { status: 400 });

    const market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market)  return NextResponse.json({ error: "Market not found" }, { status: 404 });

    const data: Record<string, unknown> = {};

    if (vatPercent     !== undefined) data.vatPercent     = vatPercent;
    if (legalInfo      !== undefined) data.legalInfo      = legalInfo;
    if (companyProfile !== undefined) data.companyProfile = companyProfile;
    if (showPayOnline  !== undefined) data.showPayOnline  = showPayOnline;

    if (stripePublicKey !== undefined)
      data.stripePublicKey = stripePublicKey || null;

    // Only update secret if a real new value — never overwrite with the masked placeholder
    if (stripeSecretKey !== undefined && stripeSecretKey !== "••••••••••••••••")
      data.stripeSecretKey = stripeSecretKey || null;

    const updated = await prisma.market.update({
      where:  { id: marketId },
      data,
      select: {
        id: true, key: true, name: true,
        defaultCurrency: true, vatPercent: true,
        legalInfo: true, companyProfile: true,
        stripePublicKey: true, showPayOnline: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId:  auth.user.id,
        action:       "MARKET_PROFILE_UPDATED",
        entityType:   "Market",
        entityId:     marketId,
        metadataJson: JSON.stringify({ fields: Object.keys(data) }),
      },
    });

    return NextResponse.json({ ok: true, market: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}