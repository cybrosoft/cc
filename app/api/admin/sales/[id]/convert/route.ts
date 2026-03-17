// app/api/admin/sales/[id]/convert/route.ts
// POST — converts a document to another type.
// Marks source as CONVERTED, creates new doc copying lines + customer + market.
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createDocument } from "@/lib/sales/create-document";
import { SalesDocumentType } from "@prisma/client";

const CONVERT_OPTIONS: Record<string, SalesDocumentType[]> = {
  RFQ:           ["QUOTATION","PROFORMA","DELIVERY_NOTE","INVOICE"],
  QUOTATION:     ["PROFORMA","DELIVERY_NOTE","INVOICE"],
  PO:            ["INVOICE"],
  DELIVERY_NOTE: ["PROFORMA","INVOICE"],
  PROFORMA:      ["DELIVERY_NOTE","INVOICE"],
  INVOICE:       ["CREDIT_NOTE"],
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    const targetType: SalesDocumentType = body?.targetType;

    if (!targetType) return NextResponse.json({ error: "targetType required" }, { status: 400 });

    const source = await prisma.salesDocument.findUnique({
      where: { id },
      include: {
        lines: { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!source) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (source.status === "VOID") return NextResponse.json({ error: "Cannot convert a voided document" }, { status: 400 });
    if (source.status === "CONVERTED") return NextResponse.json({ error: "Document already converted" }, { status: 400 });

    const allowed = CONVERT_OPTIONS[source.type] ?? [];
    if (!allowed.includes(targetType)) {
      return NextResponse.json({
        error: `Cannot convert ${source.type} to ${targetType}. Allowed: ${allowed.join(", ")}`,
      }, { status: 400 });
    }

    // Create new document copying lines from source
    const newDoc = await createDocument({
      type:        targetType,
      marketId:    source.marketId,
      customerId:  source.customerId,
      createdByAdminId: auth.user.id,
      originDocId: source.id,
      subject:     source.subject,
      referenceNumber: source.referenceNumber,
      notes:       source.notes,
      internalNote:source.internalNote,
      termsAndConditions: source.termsAndConditions,
      language:    source.language,
      lines: source.lines.map(l => ({
        productId:     l.productId,
        description:   l.description,
        descriptionAr: l.descriptionAr ?? null,
        billingPeriod: l.billingPeriod ?? null,
        productDetails:l.productDetails ?? null,
        detailsAr:     l.detailsAr ?? null,
        quantity:      Number(l.quantity),
        unitPrice:     l.unitPrice,
        discount:      Number(l.discount),
      })),
    });

    // Mark source as CONVERTED
    await prisma.salesDocument.update({
      where: { id: source.id },
      data:  { status: "CONVERTED" },
    });

    return NextResponse.json({ ok: true, doc: newDoc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
