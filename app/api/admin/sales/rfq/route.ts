// app/api/admin/sales/rfq/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSalesDocument } from "../shared/create-document";

// GET /api/admin/sales/rfq  — list all RFQs (newest first)
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const status     = searchParams.get("status")     ?? undefined;
    const customerId = searchParams.get("customerId") ?? undefined;
    const marketId   = searchParams.get("marketId")   ?? undefined;
    const q          = searchParams.get("q")           ?? undefined;

    const docs = await prisma.salesDocument.findMany({
      where: {
        type:       "RFQ",
        ...(status     ? { status: status as any }   : {}),
        ...(customerId ? { customerId }               : {}),
        ...(marketId   ? { marketId }                 : {}),
        ...(q ? {
          OR: [
            { docNum:    { contains: q, mode: "insensitive" } },
            { rfqTitle:  { contains: q, mode: "insensitive" } },
            { customer:  { email: { contains: q, mode: "insensitive" } } },
          ],
        } : {}),
      },
      include: {
        customer: { select: { id: true, fullName: true, email: true, customerNumber: true } },
        market:   { select: { id: true, key: true, name: true, defaultCurrency: true } },
        _count:   { select: { lines: true, derivedDocs: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ docs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// POST /api/admin/sales/rfq  — create a new RFQ (manual entry)
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();

    if (!body.customerId || !body.marketId) {
      return NextResponse.json({ error: "customerId and marketId are required" }, { status: 400 });
    }

    const doc = await createSalesDocument({
      type:        "RFQ",
      customerId:  body.customerId,
      marketId:    body.marketId,
      lines:       body.lines ?? [],
      notes:       body.notes,
      internalNote:body.internalNote,
      rfqTitle:    body.rfqTitle,
      rfqFileUrl:  body.rfqFileUrl,
      status:      "DRAFT",
    });

    return NextResponse.json({ doc }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
