// app/api/admin/sales/rfq/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

type Params = { params: { id: string } };

// GET /api/admin/sales/rfq/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const doc = await prisma.salesDocument.findUniqueOrThrow({
      where:   { id: params.id },
      include: {
        lines:       { include: { product: { select: { id: true, key: true, name: true } } }, orderBy: { sortOrder: "asc" } },
        customer:    { select: { id: true, fullName: true, email: true, customerNumber: true, marketId: true } },
        market:      { select: { id: true, key: true, name: true, defaultCurrency: true } },
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

// PATCH /api/admin/sales/rfq/[id]  — update status / notes / title
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const body = await req.json();

    const doc = await prisma.salesDocument.update({
      where: { id: params.id },
      data: {
        ...(body.status       !== undefined ? { status:       body.status }       : {}),
        ...(body.notes        !== undefined ? { notes:        body.notes }        : {}),
        ...(body.internalNote !== undefined ? { internalNote: body.internalNote } : {}),
        ...(body.rfqTitle     !== undefined ? { rfqTitle:     body.rfqTitle }     : {}),
        ...(body.rfqFileUrl   !== undefined ? { rfqFileUrl:   body.rfqFileUrl }   : {}),
        ...(body.dueDate      !== undefined ? { dueDate:      body.dueDate ? new Date(body.dueDate) : null } : {}),
      },
    });

    return NextResponse.json({ doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// DELETE /api/admin/sales/rfq/[id]  — void / soft delete
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin();
    const doc = await prisma.salesDocument.update({
      where: { id: params.id },
      data:  { status: "VOID" },
    });
    return NextResponse.json({ doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
