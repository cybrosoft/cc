// app/api/customer/statement/route.ts
// Statement of accounts: invoices + credit notes + payments with running balance.
// Supports optional date range: ?from=2024-01-01&to=2024-12-31
// Entry shape: { type, docType, docNum, docId, detailMain, detailSub, amount, payment, currency, balance }

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam   = searchParams.get("to");

  const from = fromParam ? new Date(fromParam) : undefined;
  const to   = toParam   ? new Date(toParam)   : undefined;

  // ── Opening balance — sum of all transactions strictly before `from` ──────
  // Only needed when a from-date filter is applied.
  let openingBalance = 0;
  if (from) {
    const priorDocs = await prisma.salesDocument.findMany({
      where: {
        customerId: user.id,
        type:       { in: ["INVOICE", "CREDIT_NOTE"] },
        status:     { notIn: ["DRAFT", "VOID"] },
        issueDate:  { lt: from },
      },
      select: {
        type:  true,
        total: true,
        payments: {
          select: { amountCents: true },
        },
      },
    });
    for (const d of priorDocs) {
      if (d.type === "INVOICE")     openingBalance += d.total;
      if (d.type === "CREDIT_NOTE") openingBalance -= d.total;
      for (const p of d.payments)  openingBalance -= p.amountCents;
    }
  }

  // ── Invoices & credit notes ───────────────────────────────────────────────
  const docs = await prisma.salesDocument.findMany({
    where: {
      customerId: user.id,
      type:       { in: ["INVOICE", "CREDIT_NOTE"] },
      status:     { notIn: ["DRAFT", "VOID"] },
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
      originDoc: {
        select: { docNum: true },
      },
      payments: {
        select: { id: true, amountCents: true, method: true, paidAt: true, currency: true, createdAt: true },
        orderBy: { paidAt: "asc" },
      },
    },
    orderBy: { issueDate: "asc" },
  });

  // ── Build statement entries ───────────────────────────────────────────────
  type StatementEntry = {
    date:       string;
    createdAt:  string;
    docType:    "INVOICE" | "CREDIT_NOTE" | "PAYMENT";
    docNum:     string;
    docId:      string;
    detailMain: string;
    detailSub:  string;
    amount:     number;
    payment:    number;
    currency:   string;
    status:     string;
  };

  const entries: StatementEntry[] = [];

  for (const doc of docs) {
    const currency = doc.currency;

    if (doc.type === "INVOICE") {
      entries.push({
        date:       doc.issueDate.toISOString(),
        createdAt:  doc.createdAt.toISOString(),
        docType:    "INVOICE",
        docNum:     doc.docNum,
        docId:      doc.id,
        detailMain: doc.docNum,
        detailSub:  doc.dueDate
          ? `Due on ${new Date(doc.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
          : doc.subject ?? "",
        amount:     doc.total,
        payment:    0,
        currency,
        status:     String(doc.status),
      });

      for (const p of doc.payments) {
        const method = String(p.method).replace(/_/g, " ");
        entries.push({
          date:       p.paidAt.toISOString(),
          createdAt:  p.createdAt.toISOString(),
          docType:    "PAYMENT",
          docNum:     doc.docNum,
          docId:      doc.id,
          detailMain: method.charAt(0).toUpperCase() + method.slice(1).toLowerCase(),
          detailSub:  `${new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(p.amountCents / 100)} for ${doc.docNum}`,
          amount:     0,
          payment:    p.amountCents,
          currency,
          status:     "PAID",
        });
      }
    }

    if (doc.type === "CREDIT_NOTE") {
      const originDocNum = doc.originDoc?.docNum ?? null;
      entries.push({
        date:       doc.issueDate.toISOString(),
        createdAt:  doc.createdAt.toISOString(),
        docType:    "CREDIT_NOTE",
        docNum:     doc.docNum,
        docId:      doc.id,
        detailMain: doc.docNum,
        detailSub:  originDocNum ? `Credit for ${originDocNum}` : (doc.subject ?? `Credit Note ${doc.docNum}`),
        amount:     doc.total,
        payment:    0,
        currency,
        status:     String(doc.status),
      });
    }
  }

  // Sort by createdAt timestamp — the actual time the document or action was created.
  entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  // ── Running balance ───────────────────────────────────────────────────────
  // Start from opening balance (0 if no filter, prior balance if filtered)
  let runningBalance = openingBalance;
  const entriesWithBalance = entries.map(e => {
    if (e.docType === "INVOICE")     runningBalance += e.amount;
    if (e.docType === "PAYMENT")     runningBalance -= e.payment;
    if (e.docType === "CREDIT_NOTE") runningBalance -= e.amount;
    return { ...e, balance: runningBalance };
  });

  // ── Summary totals ────────────────────────────────────────────────────────
  const totalCharged  = entries.filter(e => e.docType === "INVOICE").reduce((s, e) => s + e.amount,  0);
  const totalPayments = entries.filter(e => e.docType === "PAYMENT").reduce((s, e) => s + e.payment, 0);
  const totalCredits  = entries.filter(e => e.docType === "CREDIT_NOTE").reduce((s, e) => s + e.amount, 0);
  const outstandingBalance = openingBalance + totalCharged - totalPayments - totalCredits;

  // Currency — use market default (all docs for a customer are same currency)
  const currency = docs[0]?.currency ?? "USD";

  return NextResponse.json({
    statement: {
      currency,
      openingBalance,
      totalCharged,
      totalPayments,
      totalCredits,
      outstandingBalance,
      entries: entriesWithBalance,
    },
  });
}
