// app/api/admin/settings/number-series/route.ts
// GET all number series rows.
// PATCH update prefix or nextNum for a specific series.

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  try {
    await requireAdmin();
    const series = await prisma.numberSeries.findMany({
      include: { market: { select: { id: true, key: true, name: true } } },
      orderBy: [{ market: { key: "asc" } }, { docType: "asc" }],
    });
    return NextResponse.json({ ok: true, series });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json(); // { id, prefix?, nextNum? }

    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updated = await prisma.numberSeries.update({
      where: { id: body.id },
      data: {
        ...(body.prefix  !== undefined ? { prefix:  body.prefix }           : {}),
        ...(body.nextNum !== undefined ? { nextNum: Number(body.nextNum) }   : {}),
      },
    });

    return NextResponse.json({ ok: true, series: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
