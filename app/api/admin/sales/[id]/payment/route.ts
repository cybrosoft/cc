// app/api/admin/sales/[id]/payment/route.ts
// POST — record a payment against a document.
// Invoices/Proforma: auto-sets PARTIALLY_PAID or PAID.
// Credit Notes: records a refund, auto-sets APPLIED.
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
        originDoc: { select: { id: true, docNum: true, status: true } },
      },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    if (!["INVOICE", "PROFORMA", "CREDIT_NOTE"].includes(doc.type)) {
      return NextResponse.json({
        error: "Payments can only be recorded against Invoices, Proforma Invoices, and Credit Notes",
      }, { status: 400 });
    }

    if (doc.status === "VOID") {
      return NextResponse.json({ error: "Cannot record payment on a voided document" }, { status: 400 });
    }

    // ── Credit note refund guard ──────────────────────────────────────────
    // Only allow refund if the corresponding invoice has been paid
    if (doc.type === "CREDIT_NOTE" && doc.originDoc) {
      const invoicePaid = ["PAID", "PARTIALLY_PAID"].includes(doc.originDoc.status);
      if (!invoicePaid) {
        return NextResponse.json({
          error: `Cannot refund: the original invoice ${doc.originDoc.docNum} has not been paid yet.`,
        }, { status: 400 });
      }
    }

    // Create payment record
    const payment = await prisma.salesPayment.create({
      data: {
        documentId:  id,
        marketId:    doc.marketId,
        method,
        amountCents,
        currency:    currency ?? doc.currency,
        reference:   reference  ?? null,
        notes:       notes      ?? null,
        receiptUrl:  receiptUrl ?? null,
        paidAt:      paidAt ? new Date(paidAt) : new Date(),
      },
    });

    // ── Determine new status ──────────────────────────────────────────────
    let newStatus: string | null = null;

    if (doc.type === "CREDIT_NOTE") {
      // Any refund payment marks the credit note as APPLIED
      newStatus = "APPLIED";
    } else {
      // Invoice / Proforma — check total paid vs total
      const prevPaid  = doc.payments.reduce((s, p) => s + p.amountCents, 0);
      const totalPaid = prevPaid + amountCents;

      if (totalPaid >= doc.total) {
        newStatus = "PAID";
      } else if (totalPaid > 0) {
        newStatus = "PARTIALLY_PAID";
      }
    }

    if (newStatus) {
      await prisma.salesDocument.update({
        where: { id },
        data:  { status: newStatus as any, ...(newStatus === "PAID" ? { paidAt: paidAt ? new Date(paidAt) : new Date() } : {}) },
      });
    }

    // Log the payment
    await prisma.salesDocumentLog.create({
      data: {
        documentId:  id,
        field:       doc.type === "CREDIT_NOTE" ? "refund" : "payment",
        oldValue:    doc.status,
        newValue:    newStatus ?? doc.status,
        note:        doc.type === "CREDIT_NOTE"
          ? `Refund recorded: ${amountCents / 100} ${doc.currency} via ${method}`
          : `Payment recorded: ${amountCents / 100} ${doc.currency} via ${method}`,
        changedById: auth.user.id,
      },
    }).catch(() => { /* best-effort */ });

    return NextResponse.json({ ok: true, payment, newStatus });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
