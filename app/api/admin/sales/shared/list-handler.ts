// app/api/admin/sales/shared/list-handler.ts
// Generic GET handler used by all 7 sales document type routes.
// Returns paginated, filtered list of documents.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { SalesDocumentType } from "@prisma/client";

const DOC_SELECT = {
  id:       true,
  docNum:   true,
  type:     true,
  status:   true,
  currency: true,
  subtotal: true,
  vatAmount:true,
  total:    true,
  subject:  true,
  referenceNumber: true,
  emailSentAt:     true,
  emailSentCount:  true,
  issueDate:  true,
  dueDate:    true,
  validUntil: true,
  paidAt:     true,
  customer: {
    select: {
      id: true, fullName: true, email: true, customerNumber: true,
    },
  },
  market: {
    select: { id: true, key: true, name: true, defaultCurrency: true },
  },
  originDoc: {
    select: { id: true, docNum: true, type: true },
  },
  _count: { select: { derivedDocs: true, payments: true } },
} as const;

export async function makeListHandler(docType: SalesDocumentType) {
  return async function GET(req: NextRequest) {
    try {
      const auth = await requireAdmin();
      if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

      const { searchParams } = new URL(req.url);
      const q         = searchParams.get("q")?.trim()        ?? "";
      const status    = searchParams.get("status")?.trim()   ?? "";
      const marketId  = searchParams.get("marketId")?.trim() ?? "";
      const page      = Math.max(1, Number(searchParams.get("page") ?? "1"));
      const pageSize  = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") ?? "50")));

      const where: Record<string, unknown> = { type: docType };

      if (status)   where.status   = status;
      if (marketId) where.marketId = marketId;

      if (q) {
        where.OR = [
          { docNum:            { contains: q, mode: "insensitive" } },
          { subject:           { contains: q, mode: "insensitive" } },
          { referenceNumber:   { contains: q, mode: "insensitive" } },
          { customer: { email:    { contains: q, mode: "insensitive" } } },
          { customer: { fullName: { contains: q, mode: "insensitive" } } },
        ];
      }

      const [total, docs] = await Promise.all([
        prisma.salesDocument.count({ where }),
        prisma.salesDocument.findMany({
          where,
          select:  DOC_SELECT,
          orderBy: { issueDate: "desc" },
          skip:    (page - 1) * pageSize,
          take:    pageSize,
        }),
      ]);

      return NextResponse.json({
        ok: true,
        docs,
        total,
        page,
        pageSize,
        pages: Math.ceil(total / pageSize),
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  };
}
