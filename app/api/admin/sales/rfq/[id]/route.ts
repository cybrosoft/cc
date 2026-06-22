// app/api/admin/sales/rfq/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

type Params = { params: Promise<{ id: string }> };

function toDateOrUndefined(v: unknown): Date | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? undefined : d;
}

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
        assignedTo:  { select: { id: true, fullName: true, email: true } },
      },
    });
    return NextResponse.json({ doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await req.json();
    const doc = await prisma.salesDocument.update({
      where: { id },
      data: {
        ...(body.status               !== undefined ? { status:               body.status }                                  : {}),
        ...(body.notes                !== undefined ? { notes:                body.notes }                                    : {}),
        ...(body.internalNote         !== undefined ? { internalNote:         body.internalNote }                             : {}),
        ...(body.rfqTitle             !== undefined ? { rfqTitle:             body.rfqTitle }                                 : {}),
        ...(body.rfqFileUrl           !== undefined ? { rfqFileUrl:           body.rfqFileUrl }                               : {}),
        ...(body.subject              !== undefined ? { subject:              body.subject }                                  : {}),
        ...(body.referenceNumber      !== undefined ? { referenceNumber:      body.referenceNumber }                          : {}),
        ...(body.termsAndConditions   !== undefined ? { termsAndConditions:   body.termsAndConditions }                       : {}),
        ...(body.dueDate              !== undefined ? { dueDate:              toDateOrUndefined(body.dueDate) }               : {}),
        ...(body.issueDate            !== undefined ? { issueDate:            toDateOrUndefined(body.issueDate) }             : {}),
        ...(body.leadSource           !== undefined ? { leadSource:           body.leadSource }                               : {}),
        ...(body.leadPriority         !== undefined ? { leadPriority:         body.leadPriority }                             : {}),
        ...(body.assignedToId         !== undefined ? { assignedToId:         body.assignedToId }                             : {}),
        ...(body.expectedCloseDate    !== undefined ? { expectedCloseDate:    toDateOrUndefined(body.expectedCloseDate) }     : {}),
        ...(body.followUpDate         !== undefined ? { followUpDate:         toDateOrUndefined(body.followUpDate) }          : {}),
        ...(body.lostReason           !== undefined ? { lostReason:           body.lostReason }                               : {}),
        ...(body.visibleToCustomer    !== undefined ? { visibleToCustomer:    Boolean(body.visibleToCustomer) }               : {}),
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

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const { id } = await params;
    const doc = await prisma.salesDocument.update({ where: { id }, data: { status: "VOID" } });
    return NextResponse.json({ doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
