// app/api/customer/rfq/route.ts
// Customer submits a new RFQ.
// Creates a SalesDocument of type RFQ with status PENDING.
// Auto-allocates a document number from NumberSeries.
// Notifies all admins.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { invalidateCustomer } from "@/lib/cache/customer-cache";

async function allocateDocNum(marketId: string): Promise<string> {
  // Atomically increment nextNum for RFQ in this market
  const series = await prisma.numberSeries.findUnique({
    where: { marketId_docType: { marketId, docType: "RFQ" } },
  });

  if (!series) {
    throw new Error("Number series not configured for RFQ in this market. Please contact support.");
  }

  // Increment atomically
  const updated = await prisma.numberSeries.update({
    where: { marketId_docType: { marketId, docType: "RFQ" } },
    data:  { nextNum: { increment: 1 } },
  });

  return `${series.prefix}-${series.nextNum}`;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { title?: string; notes?: string } = {};
  try { body = await req.json(); } catch { /* empty body ok */ }

  const { title, notes } = body;

  if (!title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  // Get user's full profile for market
  const fullUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { id: true, marketId: true, market: { select: { defaultCurrency: true } } },
  });

  if (!fullUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Allocate document number
  let docNum: string;
  try {
    docNum = await allocateDocNum(fullUser.marketId);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Failed to allocate document number";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Create the RFQ document
  const doc = await prisma.salesDocument.create({
    data: {
      docNum,
      type:       "RFQ",
      status:     "PENDING",
      marketId:   fullUser.marketId,
      customerId: user.id,
      currency:   fullUser.market.defaultCurrency,
      rfqTitle:   title.trim(),
      notes:      notes?.trim() ?? null,
      issueDate:  new Date(),
      subtotal:   0,
      vatPercent: 0,
      vatAmount:  0,
      total:      0,
    },
    select: { id: true, docNum: true },
  });

  // Log creation
  await prisma.salesDocumentLog.create({
    data: {
      documentId:  doc.id,
      field:       "status",
      oldValue:    null,
      newValue:    "PENDING",
      note:        "RFQ submitted by customer via portal",
      changedById: user.id,
    },
  });

  // Notify admins
  try {
    const admins = await prisma.user.findMany({
      where:  { role: "ADMIN" },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId:    admin.id,
          type:      "INFO" as const,
          title:     "New RFQ received",
          body:      `${user.fullName ?? user.email} submitted RFQ ${doc.docNum}: "${title.trim()}"`,
          link:      `/admin/sales/rfq/${doc.id}`,
          eventType: "RFQ_SUBMITTED",
        })),
      });
    }
  } catch {
    // Non-critical
  }

  // Bust customer cache
  await invalidateCustomer(user.id);

  return NextResponse.json({ ok: true, docNum: doc.docNum, id: doc.id }, { status: 201 });
}

// GET — list customer's own RFQs
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rfqs = await prisma.salesDocument.findMany({
    where:   { customerId: user.id, type: "RFQ" },
    orderBy: { createdAt: "desc" },
    take:    50,
    select: {
      id:        true,
      docNum:    true,
      status:    true,
      rfqTitle:  true,
      notes:     true,
      issueDate: true,
      createdAt: true,
      // Derived doc (quotation generated from this RFQ)
      derivedDocs: {
        where:  { type: "QUOTATION", status: { notIn: ["DRAFT", "VOID"] } },
        select: { id: true, docNum: true, type: true, status: true },
        take:   1,
      },
    },
  });

  return NextResponse.json({
    rfqs: rfqs.map(r => ({
      id:          r.id,
      docNum:      r.docNum,
      status:      String(r.status),
      title:       r.rfqTitle ?? null,
      notes:       r.notes    ?? null,
      issueDate:   r.issueDate.toISOString(),
      createdAt:   r.createdAt.toISOString(),
      quotation:   r.derivedDocs[0]
        ? { id: r.derivedDocs[0].id, docNum: r.derivedDocs[0].docNum, status: String(r.derivedDocs[0].status) }
        : null,
    })),
  });
}
