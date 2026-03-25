// app/api/admin/sales/quotations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { calcTotals } from "@/lib/sales/document-helpers";
import { invalidatePdf } from "@/lib/sales/invalidate-pdf";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/sales/quotations/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const doc = await prisma.salesDocument.findUniqueOrThrow({
      where:   { id },
      include: {
        lines:       { include: { product: { select: { id: true, key: true, name: true } } }, orderBy: { sortOrder: "asc" } },
        customer:    { select: { id: true, fullName: true, email: true, customerNumber: true, marketId: true, companyName: true } },
        market:      { select: { id: true, key: true, name: true, defaultCurrency: true, vatPercent: true, legalInfo: true, companyProfile: true } },
        originDoc:   { select: { id: true, docNum: true, type: true } },
        derivedDocs: { select: { id: true, docNum: true, type: true, status: true } },
        payments:    true,
      },
    });
    return NextResponse.json({ doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// PATCH /api/admin/sales/quotations/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = await req.json();
    const current = await prisma.salesDocument.findUnique({ where: { id }, select: { status: true } });
    const autoRevise = body.lines !== undefined && ["SENT", "ACCEPTED"].includes(current?.status ?? "");

    // Recalculate totals if lines are being updated
    let recalcTotals: { subtotal: number; vatAmount: number; total: number } | null = null;
    if (body.lines !== undefined) {
      const mkt = await prisma.market.findFirst({ where: { salesDocuments: { some: { id } } }, select: { vatPercent: true } });
      const vatPct = Number(mkt?.vatPercent ?? 0);
      recalcTotals = calcTotals(
        (body.lines ?? []).map((l: any) => ({ unitPrice: l.unitPrice, quantity: l.quantity, discount: l.discount ?? 0 })),
        vatPct
      );
    }
    const doc = await prisma.salesDocument.update({
      where: { id },
      data: {
        ...(autoRevise ? { status: "REVISED" } : {}),
        ...(recalcTotals ? { subtotal: recalcTotals.subtotal, vatAmount: recalcTotals.vatAmount, total: recalcTotals.total } : {}),
        ...(body.status             !== undefined ? { status:             body.status }                                         : {}),
        ...(body.notes              !== undefined ? { notes:              body.notes }                                          : {}),
        ...(body.internalNote       !== undefined ? { internalNote:       body.internalNote }                                   : {}),
        ...(body.rfqFileUrl         !== undefined ? { rfqFileUrl:         body.rfqFileUrl }                                     : {}),
        ...(body.subject            !== undefined ? { subject:            body.subject }                                        : {}),
        ...(body.referenceNumber    !== undefined ? { referenceNumber:    body.referenceNumber }                                : {}),
        ...(body.termsAndConditions !== undefined ? { termsAndConditions: body.termsAndConditions }                             : {}),
        ...(body.dueDate            !== undefined ? { dueDate:            body.dueDate    ? new Date(body.dueDate)    : null }  : {}),
        ...(body.issueDate          !== undefined ? { issueDate:          body.issueDate  ? new Date(body.issueDate)  : null }  : {}),
        ...(body.validUntil         !== undefined ? { validUntil:         body.validUntil ? new Date(body.validUntil) : null }  : {}),
        ...(body.lines !== undefined ? {
          lines: {
            deleteMany: {},
            create: (body.lines ?? []).map((l: any, idx: number) => ({
              productId:      l.productId      ?? null,
              description:    l.description,
              descriptionAr:  l.descriptionAr  ?? null,
              billingPeriod:  l.billingPeriod  ?? null,
              productDetails: l.productDetails ?? null,
              detailsAr:      l.detailsAr      ?? null,
              quantity:       l.quantity,
              unitPrice:      l.unitPrice,
              discount:       l.discount,
              lineTotal:      Math.round(l.unitPrice * l.quantity * (1 - l.discount / 100)),
              sortOrder:      idx,
            })),
          },
        } : {}),
      },
    });

    if (autoRevise) {
      await prisma.salesDocumentLog.create({
        data: {
          documentId:  id,
          field:       "status",
          oldValue:    current!.status,
          newValue:    "REVISED",
          note:        "Auto-set to Revised on edit",
          changedById: auth.user.id,
        },
      }).catch(() => {});
    }

    // Invalidate cached PDF — doc content changed
    await invalidatePdf(id);

    return NextResponse.json({ doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// DELETE /api/admin/sales/quotations/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const doc = await prisma.salesDocument.update({
      where: { id },
      data:  { status: "VOID" },
    });
    return NextResponse.json({ doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}