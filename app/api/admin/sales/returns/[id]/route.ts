// app/api/admin/sales/returns/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/sales/returns/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
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

// PATCH /api/admin/sales/returns/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const doc = await prisma.salesDocument.update({
      where: { id },
      data: {
        ...(body.status             !== undefined ? { status:             body.status }                                          : {}),
        ...(body.notes              !== undefined ? { notes:              body.notes }                                           : {}),
        ...(body.internalNote       !== undefined ? { internalNote:       body.internalNote }                                    : {}),
        ...(body.rfqFileUrl         !== undefined ? { rfqFileUrl:         body.rfqFileUrl }                                      : {}),
        ...(body.subject            !== undefined ? { subject:            body.subject }                                         : {}),
        ...(body.referenceNumber    !== undefined ? { referenceNumber:    body.referenceNumber }                                 : {}),
        ...(body.termsAndConditions !== undefined ? { termsAndConditions: body.termsAndConditions }                              : {}),
        ...(body.dueDate            !== undefined ? { dueDate:            body.dueDate   ? new Date(body.dueDate)   : null }    : {}),
        ...(body.issueDate          !== undefined ? { issueDate:          body.issueDate ? new Date(body.issueDate) : null }    : {}),
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
    return NextResponse.json({ doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// DELETE /api/admin/sales/returns/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
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
