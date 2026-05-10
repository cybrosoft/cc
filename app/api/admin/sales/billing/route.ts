// app/api/admin/sales/billing/route.ts
// GET — full transaction ledger across all customers (invoices, credit notes, payments, refunds)
// Supports: ?market=SAUDI|GLOBAL, ?from=, ?to=, ?q= (customer), ?type=INVOICE|CREDIT_NOTE|PAYMENT|REFUND
// Returns paginated results sorted by createdAt desc

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const marketKey = searchParams.get("market")  ?? "";
    const fromParam = searchParams.get("from")    ?? "";
    const toParam   = searchParams.get("to")      ?? "";
    const q         = searchParams.get("q")       ?? "";
    const typeFilter = searchParams.get("type")   ?? "";
    const page      = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize  = 50;

    const from = fromParam ? new Date(fromParam) : undefined;
    const to   = toParam   ? new Date(toParam)   : undefined;

    // ── Build where clause ────────────────────────────────────────────────────
    const docWhere: Record<string, any> = {
      type:   { in: ["INVOICE", "CREDIT_NOTE"] },
      status: { notIn: ["DRAFT", "VOID"] },
    };

    if (marketKey) {
      docWhere.market = { key: marketKey };
    }
    if (from || to) {
      docWhere.issueDate = {
        ...(from ? { gte: from } : {}),
        ...(to   ? { lte: to   } : {}),
      };
    }
    if (q) {
      docWhere.customer = {
        OR: [
          { email:       { contains: q, mode: "insensitive" } },
          { fullName:    { contains: q, mode: "insensitive" } },
          { companyName: { contains: q, mode: "insensitive" } },
        ],
      };
    }

    // ── Fetch docs ────────────────────────────────────────────────────────────
    const docs = await prisma.salesDocument.findMany({
      where: docWhere,
      select: {
        id:        true,
        docNum:    true,
        type:      true,
        status:    true,
        currency:  true,
        total:     true,
        issueDate: true,
        createdAt: true,
        subject:   true,
        dueDate:   true,
        originDoc: { select: { docNum: true } },
        customer:  { select: { id: true, fullName: true, companyName: true, email: true, customerNumber: true } },
        market:    { select: { key: true, name: true } },
        payments: {
          select: { amountCents: true, method: true, paidAt: true, createdAt: true },
        },
      },
    });

    // ── Build flat entry list ─────────────────────────────────────────────────
    type Entry = {
      createdAt:    string;
      docType:      "INVOICE" | "CREDIT_NOTE" | "PAYMENT";
      subType?:     "REFUND";
      docId:        string;
      docNum:       string;
      detailMain:   string;
      detailSub:    string;
      amount:       number;
      payment:      number;
      currency:     string;
      marketKey:    string;
      marketName:   string;
      customerId:   string;
      customerName: string;
      customerNum:  string | null;
      customerEmail: string;
    };

    const entries: Entry[] = [];

    for (const doc of docs) {
      const customerName = doc.customer.companyName ?? doc.customer.fullName ?? doc.customer.email;
      const currency     = doc.currency;
      const marketKey    = doc.market.key;
      const marketName   = doc.market.name;

      if (doc.type === "INVOICE") {
        entries.push({
          createdAt:    doc.createdAt.toISOString(),
          docType:      "INVOICE",
          docId:        doc.id,
          docNum:       doc.docNum,
          detailMain:   doc.docNum,
          detailSub:    doc.dueDate
            ? `Due on ${new Date(doc.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
            : doc.subject ?? "",
          amount:       doc.total,
          payment:      0,
          currency, marketKey, marketName,
          customerId:    doc.customer.id,
          customerName,
          customerEmail: doc.customer.email,
          customerNum:   doc.customer.customerNumber ? String(doc.customer.customerNumber) : null,
        });

        for (const p of doc.payments) {
          const method = String(p.method).replace(/_/g, " ");
          entries.push({
            createdAt:    p.createdAt.toISOString(),
            docType:      "PAYMENT",
            docId:        doc.id,
            docNum:       doc.docNum,
            detailMain:   method.charAt(0).toUpperCase() + method.slice(1).toLowerCase(),
            detailSub:    `${new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(p.amountCents / 100)} for ${doc.docNum}`,
            amount:       0,
            payment:      p.amountCents,
            currency, marketKey, marketName,
            customerId:    doc.customer.id,
            customerName,
            customerEmail: doc.customer.email,
            customerNum:   doc.customer.customerNumber ? String(doc.customer.customerNumber) : null,
          });
        }
      }

      if (doc.type === "CREDIT_NOTE") {
        const originDocNum = doc.originDoc?.docNum ?? null;
        entries.push({
          createdAt:    doc.createdAt.toISOString(),
          docType:      "CREDIT_NOTE",
          docId:        doc.id,
          docNum:       doc.docNum,
          detailMain:   doc.docNum,
          detailSub:    originDocNum ? `Credit for ${originDocNum}` : (doc.subject ?? `Credit Note ${doc.docNum}`),
          amount:       doc.total,
          payment:      0,
          currency, marketKey, marketName,
          customerId:    doc.customer.id,
          customerName,
          customerEmail: doc.customer.email,
          customerNum:   doc.customer.customerNumber ? String(doc.customer.customerNumber) : null,
        });

        for (const p of doc.payments) {
          const method = String(p.method).replace(/_/g, " ");
          entries.push({
            createdAt:    p.createdAt.toISOString(),
            docType:      "PAYMENT",
            subType:      "REFUND",
            docId:        doc.id,
            docNum:       doc.docNum,
            detailMain:   method.charAt(0).toUpperCase() + method.slice(1).toLowerCase(),
            detailSub:    `Refund for ${doc.docNum}`,
            amount:       0,
            payment:      p.amountCents,
            currency, marketKey, marketName,
            customerId:    doc.customer.id,
            customerName,
            customerEmail: doc.customer.email,
            customerNum:   doc.customer.customerNumber ? String(doc.customer.customerNumber) : null,
          });
        }
      }
    }

    // ── Apply type filter ─────────────────────────────────────────────────────
    let filtered = entries;
    if (typeFilter === "INVOICE")     filtered = entries.filter(e => e.docType === "INVOICE");
    if (typeFilter === "CREDIT_NOTE") filtered = entries.filter(e => e.docType === "CREDIT_NOTE");
    if (typeFilter === "PAYMENT")     filtered = entries.filter(e => e.docType === "PAYMENT" && !e.subType);
    if (typeFilter === "REFUND")      filtered = entries.filter(e => e.subType === "REFUND");

    // ── Sort latest first ─────────────────────────────────────────────────────
    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // ── Summary totals (on full unfiltered entries for the market/date/q filter) ──
    const totalCharged  = entries.filter(e => e.docType === "INVOICE").reduce((s, e) => s + e.amount, 0);
    const totalPayments = entries.filter(e => e.docType === "PAYMENT" && !e.subType).reduce((s, e) => s + e.payment, 0);
    const totalCredits  = entries.filter(e => e.docType === "CREDIT_NOTE").reduce((s, e) => s + e.amount, 0);
    const totalRefunds  = entries.filter(e => e.subType === "REFUND").reduce((s, e) => s + e.payment, 0);
    const outstanding   = totalCharged - totalPayments - totalCredits + totalRefunds;

    // Currency — use market default
    const currency = marketKey === "GLOBAL" ? "USD" : "SAR";

    // ── Paginate ──────────────────────────────────────────────────────────────
    const total = filtered.length;
    const pages = Math.ceil(total / pageSize);
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    return NextResponse.json({
      ok: true,
      entries:  paged,
      total,
      page,
      pages,
      pageSize,
      summary: { currency, totalCharged, totalPayments, totalCredits, outstanding },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/admin/sales/billing — record a new payment against a document
// Used by RecordPaymentModal in SalesListPage and SalesDetailPage
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const { documentId, marketId, method, amountCents, currency, reference, notes, receiptUrl, paidAt } = body;

    if (!documentId || !marketId || !amountCents || !currency) {
      return NextResponse.json({ error: "documentId, marketId, amountCents, currency are required" }, { status: 400 });
    }

    const doc = await prisma.salesDocument.findUnique({
      where:  { id: documentId },
      select: { id: true, type: true, status: true, total: true, payments: { select: { amountCents: true } } },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (doc.status === "VOID") return NextResponse.json({ error: "Cannot record payment on a voided document" }, { status: 400 });

    const payment = await prisma.salesPayment.create({
      data: {
        documentId,
        marketId,
        method:      method      ?? "BANK_TRANSFER",
        amountCents,
        currency,
        reference:   reference   ?? null,
        notes:       notes       ?? null,
        receiptUrl:  receiptUrl  ?? null,
        paidAt:      paidAt ? new Date(paidAt) : new Date(),
      },
    });

    // Update document status
    const prevPaid  = doc.payments.reduce((s, p) => s + p.amountCents, 0);
    const totalPaid = prevPaid + amountCents;
    const newStatus = totalPaid >= doc.total ? "PAID" : "PARTIALLY_PAID";

    await prisma.salesDocument.update({
      where: { id: documentId },
      data: {
        status: newStatus as any,
        ...(newStatus === "PAID" ? { paidAt: paidAt ? new Date(paidAt) : new Date() } : {}),
      },
    });

    return NextResponse.json({ ok: true, payment }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
