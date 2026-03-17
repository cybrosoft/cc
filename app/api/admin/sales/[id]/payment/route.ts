// app/api/admin/sales/[id]/payment/route.ts
// POST — record a payment against a document.
// Auto-sets status to PARTIALLY_PAID or PAID based on total paid vs total.
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { PaymentMethod } from "@prisma/client";

const VALID_METHODS: PaymentMethod[] = ["BANK_TRANSFER", "STRIPE", "CASH", "OTHER"];

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const body   = await req.json().catch(() => null);

    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const { method, amountCents, currency, reference, notes, receiptUrl, paidAt } = body;

    if (!method || !VALID_METHODS.includes(method))
      return NextResponse.json({ error: `method must be one of: ${VALID_METHODS.join(", ")}` }, { status: 400 });
    if (!amountCents || amountCents <= 0)
      return NextResponse.json({ error: "amountCents must be > 0" }, { status: 400 });

    const doc = await prisma.salesDocument.findUnique({
      where:  { id },
      select: {
        id: true, type: true, status: true, docNum: true,
        total: true, marketId: true, currency: true,
        payments: { select: { amountCents: true } },
      },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    if (doc.type !== "INVOICE" && doc.type !== "PROFORMA") {
      return NextResponse.json({
        error: "Payments can only be recorded against Invoices and Proforma Invoices",
      }, { status: 400 });
    }

    if (doc.status === "VOID") {
      return NextResponse.json({ error: "Cannot record payment on a voided document" }, { status: 400 });
    }

    // Create payment record
    const payment = await prisma.salesPayment.create({
      data: {
        documentId:  id,
        marketId:    doc.marketId,
        method,
        amountCents,
        currency:    currency ?? doc.currency,
        reference:   reference   ?? null,
        notes:       notes       ?? null,
        receiptUrl:  receiptUrl  ?? null,
        paidAt:      paidAt ? new Date(paidAt) : new Date(),
      },
    });

    // Compute new total paid
    const prevPaid   = doc.payments.reduce((s, p) => s + p.amountCents, 0);
    const totalPaid  = prevPaid + amountCents;
    const isPaid     = totalPaid >= doc.total;
    const isPartial  = totalPaid > 0 && !isPaid;

    // Auto-update status
    let newStatus = doc.status;
    if (isPaid) {
      newStatus = "PAID";
    } else if (isPartial) {
      newStatus = "PARTIALLY_PAID";
    }

    const updated = await prisma.salesDocument.update({
      where: { id },
      data: {
        status: newStatus,
        paidAt: isPaid ? new Date() : null,
      },
      select: { id: true, docNum: true, status: true, total: true },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId:  auth.user.id,
        action:       "SALES_PAYMENT_RECORDED",
        entityType:   "SalesDocument",
        entityId:     id,
        metadataJson: JSON.stringify({
          docNum: doc.docNum,
          amountCents,
          method,
          newStatus,
          totalPaid,
        }),
      },
    });

    return NextResponse.json({ ok: true, payment, doc: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// GET — list payments for a document
export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const payments = await prisma.salesPayment.findMany({
      where:   { documentId: id },
      orderBy: { paidAt: "desc" },
    });

    const totalPaid = payments.reduce((s, p) => s + p.amountCents, 0);

    return NextResponse.json({ ok: true, payments, totalPaid });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
