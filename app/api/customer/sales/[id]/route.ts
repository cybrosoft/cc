// app/api/customer/sales/[id]/route.ts
// Returns full detail for a single SalesDocument belonging to the customer.
// Includes lines, payments, origin chain, and derived docs.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.salesDocument.findFirst({
    where: {
      id:         params.id,
      customerId: user.id,
      // Do not expose internal-only statuses
      status: { notIn: ["WRITTEN_OFF"] },
    },
    include: {
      lines: {
        orderBy: { sortOrder: "asc" },
        select: {
          id:            true,
          description:   true,
          descriptionAr: true,
          billingPeriod: true,
          quantity:      true,
          unitPrice:     true,
          discount:      true,
          lineTotal:     true,
          sortOrder:     true,
          product: { select: { id: true, name: true, key: true } },
        },
      },
      payments: {
        orderBy: { paidAt: "desc" },
        select: {
          id:          true,
          method:      true,
          amountCents: true,
          currency:    true,
          reference:   true,
          paidAt:      true,
        },
      },
      originDoc: {
        select: { id: true, docNum: true, type: true, status: true },
      },
      // Docs derived from this one (e.g. invoice generated from this quotation)
      derivedDocs: {
        where: { status: { notIn: ["DRAFT", "VOID", "WRITTEN_OFF"] } },
        select: { id: true, docNum: true, type: true, status: true },
      },
    },
  });

  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const amountPaid = doc.payments.reduce((sum, p) => sum + p.amountCents, 0);
  const balance    = doc.total - amountPaid;

  return NextResponse.json({
    document: {
      id:                doc.id,
      docNum:            doc.docNum,
      type:              String(doc.type),
      status:            String(doc.status),
      currency:          doc.currency,
      subtotal:          doc.subtotal,
      vatPercent:        Number(doc.vatPercent),
      vatAmount:         doc.vatAmount,
      total:             doc.total,
      amountPaid,
      balance,
      subject:           doc.subject           ?? null,
      notes:             doc.notes             ?? null,
      termsAndConditions:doc.termsAndConditions ?? null,
      referenceNumber:   doc.referenceNumber   ?? null,
      rfqTitle:          doc.rfqTitle          ?? null,
      pdfKey:            doc.pdfKey            ?? null,
      language:          doc.language,
      issueDate:         doc.issueDate.toISOString(),
      dueDate:           doc.dueDate?.toISOString()    ?? null,
      validUntil:        doc.validUntil?.toISOString() ?? null,
      paidAt:            doc.paidAt?.toISOString()     ?? null,
      createdAt:         doc.createdAt.toISOString(),
      lines: doc.lines.map(l => ({
        id:            l.id,
        description:   l.description,
        descriptionAr: l.descriptionAr ?? null,
        billingPeriod: l.billingPeriod ?? null,
        quantity:      Number(l.quantity),
        unitPrice:     l.unitPrice,
        discount:      Number(l.discount),
        lineTotal:     l.lineTotal,
        product:       l.product
          ? { id: l.product.id, name: l.product.name, key: l.product.key }
          : null,
      })),
      payments: doc.payments.map(p => ({
        id:          p.id,
        method:      String(p.method),
        amountCents: p.amountCents,
        currency:    p.currency,
        reference:   p.reference ?? null,
        paidAt:      p.paidAt.toISOString(),
      })),
      originDoc: doc.originDoc
        ? { id: doc.originDoc.id, docNum: doc.originDoc.docNum, type: String(doc.originDoc.type), status: String(doc.originDoc.status) }
        : null,
      derivedDocs: doc.derivedDocs.map(d => ({
        id: d.id, docNum: d.docNum, type: String(d.type), status: String(d.status),
      })),
    },
  });
}
