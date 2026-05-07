// app/api/admin/sales/[id]/convert/route.ts
// POST — converts a document to another type.
// Marks source as CONVERTED (except PAID invoices → credit note, which stay PAID).
// Creates new doc as DRAFT. Returns the new doc so UI can redirect to its detail page.

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createDocument } from "@/lib/sales/create-document";
import { SalesDocumentType } from "@prisma/client";

const CONVERT_OPTIONS: Record<string, SalesDocumentType[]> = {
  RFQ:           ["QUOTATION", "PROFORMA", "DELIVERY_NOTE", "INVOICE"],
  QUOTATION:     ["PROFORMA", "DELIVERY_NOTE", "INVOICE"],
  PO:            ["INVOICE"],
  DELIVERY_NOTE: ["PROFORMA", "INVOICE"],
  PROFORMA:      ["DELIVERY_NOTE", "INVOICE"],
  INVOICE:       ["CREDIT_NOTE"],
};

const ROUTE_MAP: Record<string, string> = {
  QUOTATION:     "/admin/sales/quotations",
  PROFORMA:      "/admin/sales/proforma",
  DELIVERY_NOTE: "/admin/sales/delivery-notes",
  INVOICE:       "/admin/sales/invoices",
  CREDIT_NOTE:   "/admin/sales/returns",
  PO:            "/admin/sales/po",
  RFQ:           "/admin/sales/rfq",
};

// Statuses that block conversion entirely
const BLOCKED_STATUSES = ["VOID", "CONVERTED"];

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const body   = await req.json().catch(() => null);
    const targetType: SalesDocumentType = body?.targetType;

    if (!targetType) return NextResponse.json({ error: "targetType required" }, { status: 400 });

    const source = await prisma.salesDocument.findUnique({
      where:   { id },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });

    if (!source) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    if (BLOCKED_STATUSES.includes(source.status)) {
      return NextResponse.json({ error: `Cannot convert a ${source.status.toLowerCase()} document` }, { status: 400 });
    }

    const allowed = CONVERT_OPTIONS[source.type] ?? [];
    if (!allowed.includes(targetType)) {
      return NextResponse.json({
        error: `Cannot convert ${source.type} to ${targetType}. Allowed: ${allowed.join(", ")}`,
      }, { status: 400 });
    }

    // Create the new document as DRAFT
    const newDoc = await createDocument({
      type:               targetType,
      marketId:           source.marketId,
      customerId:         source.customerId,
      createdByAdminId:   auth.user.id,
      originDocId:        source.id,
      subject:            source.subject,
      referenceNumber:    source.referenceNumber,
      notes:              source.notes,
      internalNote:       source.internalNote,
      termsAndConditions: source.termsAndConditions,
      language:           source.language,
      lines: source.lines.map(l => ({
        productId:      l.productId,
        description:    l.description,
        descriptionAr:  l.descriptionAr  ?? null,
        billingPeriod:  l.billingPeriod  ?? null,
        productDetails: l.productDetails ?? null,
        detailsAr:      l.detailsAr      ?? null,
        quantity:       Number(l.quantity),
        unitPrice:      l.unitPrice,
        discount:       Number(l.discount),
      })),
    });

    // Update source status:
    // - PAID invoice → credit note: keep PAID (invoice was paid, return is separate)
    // - Everything else → CONVERTED
    const isPaidToCredit = source.type === "INVOICE"
      && source.status === "PAID"
      && targetType === "CREDIT_NOTE";

    if (!isPaidToCredit) {
      await prisma.salesDocument.update({
        where: { id: source.id },
        data:  { status: "CONVERTED" },
      });
    }

    // Log the conversion
    await prisma.salesDocumentLog.create({
      data: {
        documentId:  source.id,
        field:       "conversion",
        oldValue:    source.type,
        newValue:    targetType,
        note:        `Converted to ${targetType} — created ${newDoc.docNum}`,
        changedById: auth.user.id,
      },
    });

    const redirectTo = `${ROUTE_MAP[targetType] ?? "/admin/sales"}/${newDoc.id}?edit=1`;

    return NextResponse.json({ ok: true, doc: newDoc, redirectTo });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
