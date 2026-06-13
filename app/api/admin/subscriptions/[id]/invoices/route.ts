// app/api/admin/subscriptions/[id]/invoices/route.ts
// GET  — returns invoices linked to this subscription (auto or manually linked)
// POST — links a manual invoice by docNum, fetches its lines for selection
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

function serializeDoc(d: {
  id: string; docNum: string; status: string; total: number; currency: string;
  issueDate: Date; subject: string | null; internalNote: string | null;
  lines: {
    id: string; description: string; quantity: unknown;
    unitPrice: number; lineTotal: number; discount: unknown;
    product: { id: string; name: string } | null;
  }[];
}) {
  return {
    id:           d.id,
    docNum:       d.docNum,
    status:       String(d.status),
    total:        d.total,
    currency:     d.currency,
    issueDate:    d.issueDate.toISOString(),
    subject:      d.subject      ?? null,
    internalNote: d.internalNote ?? null,
    lines: d.lines.map(l => ({
      id:          l.id,
      description: l.description,
      quantity:    Number(l.quantity),
      unitPrice:   l.unitPrice,
      lineTotal:   l.lineTotal,
      discount:    Number(l.discount),
      product:     l.product ? { id: l.product.id, name: l.product.name } : null,
    })),
  };
}

const LINE_SELECT = {
  id: true, description: true, quantity: true,
  unitPrice: true, lineTotal: true, discount: true,
  product: { select: { id: true, name: true } },
} as const;

const DOC_SELECT = {
  id: true, docNum: true, status: true, total: true,
  currency: true, issueDate: true, subject: true, internalNote: true,
  lines: { select: LINE_SELECT, orderBy: { sortOrder: "asc" as const } },
} as const;

// GET — fetch all linked invoices for this subscription
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;

  // Fetch sub to get invoiceMetaJson
  const sub = await prisma.subscription.findUnique({
    where:  { id },
    select: { invoiceMetaJson: true },
  });

  if (!sub)
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  // Auto-linked invoices (referenceNumber = sub.id)
  const autoDocs = await prisma.salesDocument.findMany({
    where:   { referenceNumber: id, type: "INVOICE" },
    orderBy: { createdAt: "desc" },
    select:  DOC_SELECT,
  });

  // Manually linked invoice (stored in invoiceMetaJson)
  let manualDoc: ReturnType<typeof serializeDoc> | null = null;
  let selectedLineIds: string[] = [];

  if (sub.invoiceMetaJson) {
    try {
      const meta = JSON.parse(sub.invoiceMetaJson) as { linkedDocNum?: string; selectedLineIds?: string[] };
      selectedLineIds = meta.selectedLineIds ?? [];

      if (meta.linkedDocNum) {
        const found = await prisma.salesDocument.findUnique({
          where:  { docNum: meta.linkedDocNum },
          select: DOC_SELECT,
        });
        if (found) manualDoc = serializeDoc(found as any);
      }
    } catch { /* ignore malformed JSON */ }
  }

  return NextResponse.json({
    ok:              true,
    invoices:        autoDocs.map(d => serializeDoc(d as any)),
    manualInvoice:   manualDoc,
    selectedLineIds,
  });
}

// POST — look up an invoice by docNum (for manual link preview)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as { docNum?: unknown } | null;
  const docNum = typeof body?.docNum === "string" ? body.docNum.trim().toUpperCase() : "";

  if (!docNum)
    return NextResponse.json({ ok: false, error: "DOC_NUM_REQUIRED" }, { status: 400 });

  const doc = await prisma.salesDocument.findUnique({
    where:  { docNum },
    select: DOC_SELECT,
  });

  if (!doc)
    return NextResponse.json({ ok: false, error: "INVOICE_NOT_FOUND" }, { status: 404 });

  if (String(doc.status) === "VOID")
    return NextResponse.json({ ok: false, error: "INVOICE_IS_VOID" }, { status: 400 });

  return NextResponse.json({ ok: true, invoice: serializeDoc(doc as any) });
}
