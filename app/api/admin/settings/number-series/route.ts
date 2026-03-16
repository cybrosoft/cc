// app/api/admin/settings/number-series/route.ts
// GET  — returns all number series rows, auto-creating missing market × docType combinations
// PATCH — update prefix or nextNum — prefix required, nextNum can only increase

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

const DOC_TYPES = [
  "RFQ", "QUOTATION", "PO", "DELIVERY_NOTE", "PROFORMA", "INVOICE", "CREDIT_NOTE"
] as const;

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const markets = await prisma.market.findMany({
      where:   { isActive: true },
      select:  { id: true, key: true, name: true },
      orderBy: { name: "asc" },
    });

    const existing    = await prisma.numberSeries.findMany({
      include: { market: { select: { id: true, key: true, name: true } } },
    });
    const existingSet = new Set(existing.map(e => `${e.marketId}__${e.docType}`));

    // Auto-create missing rows with blank prefix — admin must configure before use
    const toCreate: { marketId: string; docType: string; prefix: string; nextNum: number }[] = [];
    for (const market of markets) {
      for (const docType of DOC_TYPES) {
        if (!existingSet.has(`${market.id}__${docType}`)) {
          toCreate.push({ marketId: market.id, docType, prefix: "", nextNum: 1000 });
        }
      }
    }
    if (toCreate.length > 0) {
      await prisma.numberSeries.createMany({ data: toCreate, skipDuplicates: true });
    }

    const series = await prisma.numberSeries.findMany({
      include: { market: { select: { id: true, key: true, name: true } } },
      orderBy: [{ market: { name: "asc" } }, { docType: "asc" }],
    });

    return NextResponse.json({ ok: true, series });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, prefix, nextNum } = body;

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const current = await prisma.numberSeries.findUnique({ where: { id } });
    if (!current)  return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (prefix !== undefined) {
      const trimmed = String(prefix).trim().toUpperCase();
      if (!trimmed)
        return NextResponse.json({ error: "Prefix cannot be blank" }, { status: 400 });
      if (!/^[A-Z0-9\-]+$/.test(trimmed))
        return NextResponse.json({ error: "Only letters, numbers and hyphens allowed" }, { status: 400 });
    }

    if (nextNum !== undefined) {
      const newNum = Number(nextNum);
      if (isNaN(newNum) || newNum < 1)
        return NextResponse.json({ error: "Next number must be at least 1" }, { status: 400 });
      if (newNum < current.nextNum)
        return NextResponse.json({
          error: `Cannot decrease — current value is ${current.nextNum}. Only increases are allowed.`,
        }, { status: 400 });
    }

    const updated = await prisma.numberSeries.update({
      where: { id },
      data: {
        ...(prefix  !== undefined ? { prefix:  String(prefix).trim().toUpperCase() } : {}),
        ...(nextNum !== undefined ? { nextNum: Number(nextNum) }                    : {}),
      },
      include: { market: { select: { id: true, key: true, name: true } } },
    });

    return NextResponse.json({ ok: true, series: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}