// app/api/admin/sales/shared/list-create-handler.ts
// Generic GET (list) + POST (create) handler factory.
// Used by: quotations, po, delivery-notes, proforma, invoices, returns.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSalesDocument } from "./create-document";
import type { SalesDocumentType } from "@prisma/client";

export function makeListHandler(docType: SalesDocumentType) {
  return async function GET(req: NextRequest) {
    try {
      await requireAdmin();
      const { searchParams } = new URL(req.url);
      const status     = searchParams.get("status")     ?? undefined;
      const customerId = searchParams.get("customerId") ?? undefined;
      const marketId   = searchParams.get("marketId")   ?? undefined;
      const q          = searchParams.get("q")           ?? undefined;

      const docs = await prisma.salesDocument.findMany({
        where: {
          type: docType,
          ...(status     ? { status: status as any } : {}),
          ...(customerId ? { customerId }             : {}),
          ...(marketId   ? { marketId }               : {}),
          ...(q ? {
            OR: [
              { docNum:   { contains: q, mode: "insensitive" } },
              { customer: { email:       { contains: q, mode: "insensitive" } } },
              { customer: { fullName:    { contains: q, mode: "insensitive" } } },
              { customer: { companyName: { contains: q, mode: "insensitive" } } },
            ],
          } : {}),
        },
        include: {
          customer:  { select: { id: true, fullName: true, companyName: true, email: true, customerNumber: true } },
          market:    { select: { id: true, key: true, name: true, defaultCurrency: true } },
          originDoc: { select: { id: true, docNum: true, type: true } },
          _count:    { select: { lines: true, payments: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({ docs });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
  };
}

export function makeCreateHandler(docType: SalesDocumentType) {
  return async function POST(req: NextRequest) {
    try {
      await requireAdmin();
      const body = await req.json();

      if (!body.customerId || !body.marketId) {
        return NextResponse.json({ error: "customerId and marketId are required" }, { status: 400 });
      }

      const doc = await createSalesDocument({
        type:         docType,
        customerId:   body.customerId,
        marketId:     body.marketId,
        lines:        body.lines ?? [],
        notes:        body.notes,
        internalNote: body.internalNote,
        issueDate:    body.issueDate,
        dueDate:      body.dueDate,
        originDocId:  body.originDocId,
        status:       body.status,
      });

      return NextResponse.json({ doc }, { status: 201 });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
    }
  };
}