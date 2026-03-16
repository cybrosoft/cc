// app/api/admin/sales/[id]/convert/route.ts
// Converts a source document (RFQ / Quotation / Proforma / PO) into a new
// target document type, copying lines + customer + market.
// The origin doc gets status CONVERTED (unless it's an RFQ → QUOTED).

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSalesDocument } from "../../shared/create-document";
import type { SalesDocumentType, SalesDocumentStatus } from "@prisma/client";

type Params = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { targetType } = await req.json() as { targetType: SalesDocumentType };

    if (!targetType) {
      return NextResponse.json({ error: "targetType is required" }, { status: 400 });
    }

    // Load source doc with lines
    const source = await prisma.salesDocument.findUniqueOrThrow({
      where:   { id: params.id },
      include: { lines: { orderBy: { sortOrder: "asc" } } },
    });

    // Create the new doc (copy lines + origin pointer)
    const newDoc = await createSalesDocument({
      type:        targetType,
      customerId:  source.customerId,
      marketId:    source.marketId,
      originDocId: source.id,
      lines: source.lines.map((l) => ({
        productId:   l.productId ?? undefined,
        description: l.description,
        quantity:    Number(l.quantity),
        unitPrice:   l.unitPrice,
        discount:    Number(l.discount),
        sortOrder:   l.sortOrder,
      })),
      notes:       source.notes ?? undefined,
      internalNote:source.internalNote ?? undefined,
    });

    // Update source status
    const nextStatus: SalesDocumentStatus =
      source.type === "RFQ" && targetType === "QUOTATION" ? "CONVERTED" : "CONVERTED";

    await prisma.salesDocument.update({
      where: { id: source.id },
      data:  { status: nextStatus },
    });

    return NextResponse.json({ doc: newDoc }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
