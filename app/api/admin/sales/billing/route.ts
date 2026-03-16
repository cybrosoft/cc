// app/api/admin/sales/billing/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

// GET /api/admin/sales/billing — list all SalesPayments
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const marketId = searchParams.get("marketId") ?? undefined;
    const method   = searchParams.get("method")   ?? undefined;
    const q        = searchParams.get("q")         ?? undefined;

    const payments = await prisma.salesPayment.findMany({
      where: {
        ...(marketId ? { marketId }             : {}),
        ...(method   ? { method: method as any } : {}),
        ...(q ? {
          OR: [
            { reference: { contains: q, mode: "insensitive" } },
            { document:  { docNum: { contains: q, mode: "insensitive" } } },
          ],
        } : {}),
      },
      include: {
        document: {
          select: {
            id: true, docNum: true, type: true,
            customer: { select: { id: true, fullName: true, email: true, customerNumber: true } },
          },
        },
        market: { select: { id: true, key: true, name: true } },
      },
      orderBy: { paidAt: "desc" },
    });

    return NextResponse.json({ payments });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// POST /api/admin/sales/billing — record a new payment
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();

    if (!body.documentId || !body.marketId || !body.amountCents || !body.currency) {
      return NextResponse.json(
        { error: "documentId, marketId, amountCents, currency are required" },
        { status: 400 }
      );
    }

    const payment = await prisma.$transaction(async (tx) => {
      const p = await tx.salesPayment.create({
        data: {
          documentId:  body.documentId,
          marketId:    body.marketId,
          method:      body.method ?? "BANK_TRANSFER",
          amountCents: body.amountCents,
          currency:    body.currency,
          reference:   body.reference   ?? null,
          notes:       body.notes       ?? null,
          receiptUrl:  body.receiptUrl  ?? null,
          paidAt:      body.paidAt ? new Date(body.paidAt) : undefined,
        },
      });

      // Update document paidAt if not already set
      await tx.salesDocument.updateMany({
        where: { id: body.documentId, paidAt: null },
        data:  { paidAt: new Date(), status: "PAID" },
      });

      return p;
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
