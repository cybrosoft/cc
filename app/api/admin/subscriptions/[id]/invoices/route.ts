// app/api/admin/subscriptions/[id]/invoices/route.ts
// Returns all SalesDocument invoices linked to this subscription
// via referenceNumber = subscription id.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma }       from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;

  const docs = await prisma.salesDocument.findMany({
    where: {
      referenceNumber: id,
      type:            "INVOICE",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id:          true,
      docNum:      true,
      status:      true,
      total:       true,
      currency:    true,
      issueDate:   true,
      subject:     true,
      internalNote: true,
    },
  });

  return NextResponse.json({
    ok:       true,
    invoices: docs.map(d => ({
      id:          d.id,
      docNum:      d.docNum,
      status:      String(d.status),
      total:       d.total,
      currency:    d.currency,
      issueDate:   d.issueDate.toISOString(),
      subject:     d.subject      ?? null,
      internalNote: d.internalNote ?? null,
    })),
  });
}
