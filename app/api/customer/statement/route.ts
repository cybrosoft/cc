// app/api/customer/statement/route.ts
// Statement of accounts: invoices + credit notes + payments with running balance.
// Supports optional date range: ?from=2024-01-01&to=2024-12-31

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
      paidAt:    true,
      subject:   true,
      payments: {
        select: { id: true, amountCents: true, method: true, paidAt: true, currency: true },
        orderBy: { paidAt: "asc" },
      },
    },
    orderBy: { issueDate: "asc" },
  });

  // ── Build statement entries ───────────────────────────────────────────────
  // Each invoice = a debit entry
  // Each credit note = a credit entry
  // Each payment = a credit entry linked to the invoice

  type StatementEntry = {
    date:        string;
    type:        "INVOICE" | "CREDIT_NOTE" | "PAYMENT";
    docNum:      string;
    docId:       string;
    description: string;
    debit:       number; // amount owed (cents)
    credit:      number; // amount paid/credited (cents)
    currency:    string;
    status:      string;
  };

  const entries: StatementEntry[] = [];

  for (const doc of docs) {
    const currency = doc.currency;

    if (doc.type === "INVOICE") {
      // Debit entry for the invoice
      entries.push({
        date:        doc.issueDate.toISOString(),
        type:        "INVOICE",
        docNum:      doc.docNum,
        docId:       doc.id,
        description: doc.subject ?? `Invoice ${doc.docNum}`,
        debit:       doc.total,
        credit:      0,
        currency,
        status:      String(doc.status),
      });

      // Credit entries for each payment on this invoice
      for (const p of doc.payments) {
        entries.push({
          date:        p.paidAt.toISOString(),
          type:        "PAYMENT",
          docNum:      doc.docNum,
          docId:       doc.id,
          description: `Payment on ${doc.docNum} (${String(p.method).replace(/_/g, " ")})`,
          debit:       0,
          credit:      p.amountCents,
          currency,
          status:      "PAID",
        });
      }
    }

    if (doc.type === "CREDIT_NOTE") {
      // Credit entry for credit note
      entries.push({
        date:        doc.issueDate.toISOString(),
        type:        "CREDIT_NOTE",
        docNum:      doc.docNum,
        docId:       doc.id,
        description: doc.subject ?? `Credit Note ${doc.docNum}`,
        debit:       0,
        credit:      doc.total,
        currency,
        status:      String(doc.status),
      });
    }
  }

  // Sort all entries by date ascending
  entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // ── Running balance ───────────────────────────────────────────────────────
  let runningBalance = 0;
  const entriesWithBalance = entries.map(e => {
    runningBalance += e.debit - e.credit;
    return { ...e, balance: runningBalance };
  });

  // ── Summary totals ────────────────────────────────────────────────────────
  const totalInvoiced = entries.filter(e => e.type === "INVOICE").reduce((s, e) => s + e.debit,  0);
  const totalPaid     = entries.filter(e => e.type === "PAYMENT").reduce((s, e) => s + e.credit, 0);
  const totalCredits  = entries.filter(e => e.type === "CREDIT_NOTE").reduce((s, e) => s + e.credit, 0);
  const outstandingBalance = totalInvoiced - totalPaid - totalCredits;

  // Currency — use the market's default (all docs for a customer are same currency)
  const currency = docs[0]?.currency ?? "USD";

  return NextResponse.json({
    statement: {
      currency,
      totalInvoiced,
      totalPaid,
      totalCredits,
      outstandingBalance,
      entries: entriesWithBalance,
    },
  });
}
