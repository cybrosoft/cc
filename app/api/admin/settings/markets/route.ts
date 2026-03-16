// app/api/admin/settings/markets/route.ts
// Returns all markets with their settings fields for the settings UI.

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  try {
    await requireAdmin();
    const markets = await prisma.market.findMany({
      where:   { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true, key: true, name: true,
        defaultCurrency: true, billingProvider: true,
        vatPercent: true, legalInfo: true,
        companyProfile: true, paymentMethods: true,
        numberSeries: {
          select: { id: true, docType: true, prefix: true, nextNum: true },
          orderBy: { docType: "asc" },
        },
      },
    });
    return NextResponse.json({ ok: true, markets });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
