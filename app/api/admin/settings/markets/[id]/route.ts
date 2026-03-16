// app/api/admin/settings/markets/[id]/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await context.params;   // ← await required in Next.js 15
    const body = await req.json();

    if (!id) {
      return NextResponse.json({ error: "Market ID missing" }, { status: 400 });
    }

    const market = await prisma.market.update({
      where: { id },
      data: {
        ...(body.vatPercent     !== undefined ? { vatPercent:     body.vatPercent }     : {}),
        ...(body.legalInfo      !== undefined ? { legalInfo:      body.legalInfo }      : {}),
        ...(body.companyProfile !== undefined ? { companyProfile: body.companyProfile } : {}),
        ...(body.paymentMethods !== undefined ? { paymentMethods: body.paymentMethods } : {}),
      },
      select: {
        id: true, key: true, name: true, defaultCurrency: true,
        vatPercent: true, legalInfo: true, companyProfile: true, paymentMethods: true,
      },
    });

    return NextResponse.json({ ok: true, market });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
