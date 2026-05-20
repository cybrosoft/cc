// app/api/admin/sales/po/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createDocument } from "@/lib/sales/create-document";
import { prisma } from "@/lib/prisma";

const DOC_SELECT = {
  id: true, docNum: true, type: true, status: true, currency: true,
  subtotal: true, vatAmount: true, total: true, subject: true,
  referenceNumber: true, emailSentAt: true, emailSentCount: true,
  issueDate: true, dueDate: true, validUntil: true, paidAt: true,
  createdAt: true, officialInvoiceUrl: true, rfqFileUrl: true,
  customer: { select: { id: true, fullName: true, companyName: true, email: true, customerNumber: true } },
  market:   { select: { id: true, key: true, name: true, defaultCurrency: true } },
  originDoc:{ select: { id: true, docNum: true, type: true } },
  _count:   { select: { derivedDocs: true, payments: true } },
} as const;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const q        = searchParams.get("q")?.trim()       ?? "";
    const status   = searchParams.get("status")?.trim()  ?? "";
    const marketId = searchParams.get("marketId")?.trim()?? "";
    const page     = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));

    function buildWhere(type: "PO" | "QUOTATION") {
      const where: Record<string, any> = { type };
      if (type === "QUOTATION") where.status = "ACCEPTED";
      else if (status)          where.status = status;
      if (marketId) where.marketId = marketId;
      if (q) {
        where.OR = [
          { docNum:   { contains: q, mode: "insensitive" } },
          { customer: { email:       { contains: q, mode: "insensitive" } } },
          { customer: { fullName:    { contains: q, mode: "insensitive" } } },
          { customer: { companyName: { contains: q, mode: "insensitive" } } },
        ];
      }
      return where;
    }

    const [pos, acceptedQuotes] = await Promise.all([
      prisma.salesDocument.findMany({
        where:   buildWhere("PO"),
        select:  DOC_SELECT,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
      prisma.salesDocument.findMany({
        where:   buildWhere("QUOTATION"),
        select:  DOC_SELECT,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
      }),
    ]);

    // Combine and sort latest first
    const docs = [...pos, ...acceptedQuotes].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({ ok: true, docs, total: docs.length, page, pageSize, pages: 1 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const { customerId, marketId, lines, subject, referenceNumber,
            notes, internalNote, termsAndConditions, language,
            issueDate, dueDate, originDocId } = body;

    if (!customerId)    return NextResponse.json({ error: "customerId required" }, { status: 400 });
    if (!marketId)      return NextResponse.json({ error: "marketId required" },   { status: 400 });
    if (!lines?.length) return NextResponse.json({ error: "At least one line required" }, { status: 400 });

    const doc = await createDocument({
      type: "PO",
      marketId, customerId,
      createdByAdminId: auth.user.id,
      subject, referenceNumber, notes, internalNote,
      termsAndConditions, language,
      issueDate, dueDate, originDocId,
      lines,
    });

    return NextResponse.json({ ok: true, doc }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
