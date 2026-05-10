// app/api/admin/customers/[id]/statement/route.ts
// Admin-side statement of accounts for a specific customer.
// Same logic as /api/customer/statement but admin-authenticated.
// Supports optional date range: ?from=2024-01-01&to=2024-12-31

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: customerId } = await context.params;

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam   = searchParams.get("to");

  const from = fromParam ? new Date(fromParam) : undefined;
  const to   = toParam   ? new Date(toParam)   : undefined;

  // ── Opening balance — all transactions strictly before `from` ─────────────
  let openingBalance = 0;
  if (from) {
    const priorDocs = await prisma.salesDocument.findMany({
      where: {
        customerId,
        type:      { in: ["INVOICE", "CREDIT_NOTE"] },
        status:    { notIn: ["DRAFT", "VOID"] },
        issueDate: { lt: from },
      },
      select: { type: true, total: true, payments: { select: { amountCents: true } } },
    });
    for (const d of priorDocs) {
      if (d.type === "INVOICE")     openingBalance += d.total;
      if (d.type === "CREDIT_NOTE") openingBalance -= d.total;
      for (const p of d.payments)  openingBalance -= p.amountCents;
    }
  }

  // ── Main docs ─────────────────────────────────────────────────────────────
  const docs = await prisma.salesDocument.findMany({
    where: {
      customerId,
      type:   { in: ["INVOICE", "CREDIT_NOTE"] },
      status: { notIn: ["DRAFT", "VOID"] },
      ...(from || to ? {
        issueDate: {
          ...(from ? { gte: from } : {}),
          ...(to   ? { lte: to   } : {}),
        },
      } : {}),
    },
    select: {
      id:        true,
      docNum:    true,
      type:      true,
      status:    true,
      currency:  true,
      total:     true,
      issueDate: true,
      dueDate:   true,
      subject:   true,
      createdAt: true,
      originDoc: { select: { docNum: true } },
      payments: {
        select: { amountCents: true, method: true, paidAt: true, createdAt: true },
        orderBy: { paidAt: "asc" },
      },
    },
    orderBy: { issueDate: "asc" },
  });

  // ── Build entries ─────────────────────────────────────────────────────────
  type Entry = {
    createdAt:  string;
    docType:    "INVOICE" | "CREDIT_NOTE" | "PAYMENT";
    subType?:   "REFUND";
    docNum:     string;
    docId:      string;
    detailMain: string;
    detailSub:  string;
    amount:     number;
    payment:    number;
    currency:   string;
    status:     string;
  };

  const entries: Entry[] = [];

  for (const doc of docs) {
    const currency = doc.currency;

    if (doc.type === "INVOICE") {
      entries.push({
        createdAt:  doc.createdAt.toISOString(),
        docType:    "INVOICE",
        docNum:     doc.docNum,
        docId:      doc.id,
        detailMain: doc.docNum,
        detailSub:  doc.dueDate
          ? `Due on ${new Date(doc.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
          : doc.subject ?? "",
        amount:  doc.total,
        payment: 0,
        currency,
        status:  String(doc.status),
      });
      for (const p of doc.payments) {
        const method = String(p.method).replace(/_/g, " ");
        entries.push({
          createdAt:  p.createdAt.toISOString(),
          docType:    "PAYMENT",
          docNum:     doc.docNum,
          docId:      doc.id,
          detailMain: method.charAt(0).toUpperCase() + method.slice(1).toLowerCase(),
          detailSub:  `${new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(p.amountCents / 100)} for ${doc.docNum}`,
          amount:  0,
          payment: p.amountCents,
          currency,
          status:  "PAID",
        });
      }
    }

    if (doc.type === "CREDIT_NOTE") {
      const originDocNum = doc.originDoc?.docNum ?? null;
      entries.push({
        createdAt:  doc.createdAt.toISOString(),
        docType:    "CREDIT_NOTE",
        docNum:     doc.docNum,
        docId:      doc.id,
        detailMain: doc.docNum,
        detailSub:  originDocNum ? `Credit for ${originDocNum}` : (doc.subject ?? `Credit Note ${doc.docNum}`),
        amount:  doc.total,
        payment: 0,
        currency,
        status:  String(doc.status),
      });
      // Refund payments on credit note
      for (const p of doc.payments) {
        const method = String(p.method).replace(/_/g, " ");
        entries.push({
          createdAt:  p.createdAt.toISOString(),
          docType:    "PAYMENT",
          subType:    "REFUND",
          docNum:     doc.docNum,
          docId:      doc.id,
          detailMain: method.charAt(0).toUpperCase() + method.slice(1).toLowerCase(),
          detailSub:  `Refund for ${doc.docNum}`,
          amount:  0,
          payment: p.amountCents,
          currency,
          status:  "REFUNDED",
        });
      }
    }
  }

  // Sort by createdAt
  entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // ── Running balance ───────────────────────────────────────────────────────
  let runningBalance = openingBalance;
  const entriesWithBalance = entries.map(e => {
    if (e.docType === "INVOICE")                           runningBalance += e.amount;
    if (e.docType === "PAYMENT" && !e.subType)             runningBalance -= e.payment;
    if (e.docType === "PAYMENT" && e.subType === "REFUND") runningBalance += e.payment;
    if (e.docType === "CREDIT_NOTE")                       runningBalance -= e.amount;
    return { ...e, balance: runningBalance };
  });

  // ── Totals ────────────────────────────────────────────────────────────────
  const totalCharged  = entries.filter(e => e.docType === "INVOICE").reduce((s, e) => s + e.amount,  0);
  const totalPayments = entries.filter(e => e.docType === "PAYMENT" && !e.subType).reduce((s, e) => s + e.payment, 0);
  const totalRefunds  = entries.filter(e => e.subType === "REFUND").reduce((s, e) => s + e.payment, 0);
  const totalCredits  = entries.filter(e => e.docType === "CREDIT_NOTE").reduce((s, e) => s + e.amount, 0);
  const outstandingBalance = openingBalance + totalCharged - totalPayments - totalCredits + totalRefunds;

  const currency = docs[0]?.currency ?? "SAR";

  return NextResponse.json({
    statement: {
      currency,
      openingBalance,
      totalCharged,
      totalPayments,
      totalCredits,
      totalRefunds,
      outstandingBalance,
      entries: entriesWithBalance,
    },
  });
}
