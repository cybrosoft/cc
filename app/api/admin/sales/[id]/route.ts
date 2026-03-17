// app/api/admin/sales/[id]/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const doc = await prisma.salesDocument.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true, fullName: true, email: true, mobile: true,
            customerNumber: true, companyName: true,
            market: {
              select: {
                id: true, key: true, name: true,
                defaultCurrency: true, vatPercent: true,
                legalInfo: true,
              },
            },
          },
        },
        market: {
          select: {
            id: true, key: true, name: true,
            defaultCurrency: true, vatPercent: true,
            legalInfo: true,
          },
        },
        lines: {
          orderBy: { sortOrder: "asc" },
          include: {
            product: { select: { id: true, key: true, name: true, nameAr: true } },
          },
        },
        payments: { orderBy: { paidAt: "desc" } },
        originDoc: { select: { id: true, docNum: true, type: true } },
        derivedDocs: { select: { id: true, docNum: true, type: true, status: true } },
      },
    });

    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ ok: true, doc });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
