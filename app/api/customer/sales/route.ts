// app/api/customer/sales/route.ts
// Lists SalesDocuments for the current customer.
// DRAFT is never shown to customers — for any document type.
// WRITTEN_OFF is admin-only, shown as OVERDUE to customer.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { SalesDocumentType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const typeParam  = searchParams.get("type");
  const limitParam = searchParams.get("limit");

  const type = typeParam && Object.values(SalesDocumentType).includes(typeParam as SalesDocumentType)
    ? (typeParam as SalesDocumentType) : undefined;
  const take = limitParam ? Math.min(parseInt(limitParam), 100) : 50;

  const visibleTypes: SalesDocumentType[] = [
    "INVOICE", "QUOTATION", "PO", "DELIVERY_NOTE",
    "PROFORMA", "CREDIT_NOTE", "RFQ",
  ];

  const docs = await prisma.salesDocument.findMany({
    where: {
      customerId: user.id,
      type:       type ? type : { in: visibleTypes },
      // DRAFT never shown — no exceptions
      // WRITTEN_OFF is admin-only
      status: { notIn: ["DRAFT", "WRITTEN_OFF"] },
    },
    select: {
      id:         true,
      docNum:     true,
      type:       true,
      status:     true,
      currency:   true,
      subtotal:   true,
      vatPercent: true,
      vatAmount:  true,
      total:      true,
      subject:    true,
      rfqTitle:   true,
      pdfKey:     true,
      issueDate:  true,
      dueDate:    true,
      validUntil: true,
      paidAt:     true,
      createdAt:  true,
      payments: {
        select: { amountCents: true, paidAt: true, method: true },
        orderBy: { paidAt: "desc" },
      },
      originDoc: {
        select: { id: true, docNum: true, type: true },
      },
    },
    orderBy: { issueDate: "desc" },
    take,
  });

  const serialized = docs.map(doc => {
    const amountPaid = doc.payments.reduce((sum, p) => sum + p.amountCents, 0);
    return {
      id:         doc.id,
      docNum:     doc.docNum,
      type:       String(doc.type),
      status:     String(doc.status),
      currency:   doc.currency,
      subtotal:   doc.subtotal,
      vatPercent: Number(doc.vatPercent),
      vatAmount:  doc.vatAmount,
      total:      doc.total,
      amountPaid,
      balance:    doc.total - amountPaid,
      subject:    doc.subject   ?? null,
      rfqTitle:   doc.rfqTitle  ?? null,
      pdfKey:     doc.pdfKey    ?? null,
      issueDate:  doc.issueDate.toISOString(),
      dueDate:    doc.dueDate?.toISOString()    ?? null,
      validUntil: doc.validUntil?.toISOString() ?? null,
      paidAt:     doc.paidAt?.toISOString()     ?? null,
      createdAt:  doc.createdAt.toISOString(),
      originDoc:  doc.originDoc
        ? { id: doc.originDoc.id, docNum: doc.originDoc.docNum, type: String(doc.originDoc.type) }
        : null,
      payments: doc.payments.map(p => ({
        amountCents: p.amountCents,
        method:      String(p.method),
        paidAt:      p.paidAt.toISOString(),
      })),
    };
  });

  return NextResponse.json({ documents: serialized });
}
