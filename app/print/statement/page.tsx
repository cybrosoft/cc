// app/print/statement/page.tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createHmac } from "crypto";

interface Props {
  searchParams: Promise<{ token?: string; userId?: string; from?: string; to?: string }>;
}

function verifyToken(userId: string, from: string, to: string, token: string): boolean {
  const secret   = process.env.PRINT_TOKEN_SECRET ?? "fallback-secret";
  const expected = createHmac("sha256", secret).update(`${userId}:${from}:${to}`).digest("hex");
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}

function fmtAmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}
function fmtOrDash(cents: number, currency: string) {
  return cents === 0 ? "—" : fmtAmt(cents, currency);
}
function fmtBal(cents: number, currency: string) {
  const abs = fmtAmt(Math.abs(cents), currency);
  return cents < 0 ? `−${abs}` : abs;
}
function fmtD(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

const TX: Record<string, string> = {
  INVOICE: "Invoice", CREDIT_NOTE: "Credit Note", PAYMENT: "Payment Received", REFUND: "Refund",
};

export default async function StatementPrintPage({ searchParams }: Props) {
  const { token, userId, from, to } = await searchParams;

  if (!token || !userId || !verifyToken(userId, from ?? "", to ?? "", token)) {
    return <div style={{ fontFamily: "Arial", padding: 40, color: "#dc2626" }}><h2>Access Denied</h2></div>;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      fullName: true, companyName: true, email: true,
      customerNumber: true, accountType: true, vatTaxId: true,
      addressLine1: true, addressLine2: true, district: true,
      city: true, province: true, country: true, postalCode: true,
      market: { select: { name: true, defaultCurrency: true, legalInfo: true, companyProfile: true } },
    },
  });

  if (!user) notFound();

  const li  = (user.market.legalInfo     ?? {}) as Record<string, any>;
  const cp  = (user.market.companyProfile ?? {}) as Record<string, any>;
  const pc  = String(cp.primaryColor ?? "#318774");
  const cur = user.market.defaultCurrency;

  const custName  = user.accountType === "BUSINESS" && user.companyName ? user.companyName : (user.fullName ?? user.email);
  const custAddr  = [user.addressLine1, user.addressLine2, user.district, user.city, user.postalCode].filter(Boolean).join(", ");
  const custAddr2 = [user.province, user.country].filter(Boolean).join(", ");
  const coAddr    = [li.address1 ?? li.address, li.address2, li.district, li.city, li.postalCode].filter(Boolean).join(", ");
  const coAddr2   = [li.state, li.country].filter(Boolean).join(", ");

  const fromDate = from ? new Date(from) : undefined;
  const toDate   = to   ? new Date(to)   : undefined;

  // Opening balance
  let openingBalance = 0;
  if (fromDate) {
    const prior = await prisma.salesDocument.findMany({
      where: { customerId: userId, type: { in: ["INVOICE", "CREDIT_NOTE"] }, status: { notIn: ["DRAFT", "VOID"] }, issueDate: { lt: fromDate } },
      select: { type: true, total: true, payments: { select: { amountCents: true } } },
    });
    for (const d of prior) {
      if (d.type === "INVOICE")     openingBalance += d.total;
      if (d.type === "CREDIT_NOTE") openingBalance -= d.total;
      for (const p of d.payments)  openingBalance -= p.amountCents;
    }
  }

  // Period docs
  const docs = await prisma.salesDocument.findMany({
    where: {
      customerId: userId, type: { in: ["INVOICE", "CREDIT_NOTE"] }, status: { notIn: ["DRAFT", "VOID"] },
      ...(fromDate || toDate ? { issueDate: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lte: toDate } : {}) } } : {}),
    },
    select: {
      docNum: true, type: true, total: true, issueDate: true, dueDate: true, subject: true, createdAt: true,
      originDoc: { select: { docNum: true } },
      payments: { select: { amountCents: true, method: true, paidAt: true, createdAt: true }, orderBy: { paidAt: "asc" } },
    },
    orderBy: { issueDate: "asc" },
  });

  type Entry = { createdAt: string; docType: "INVOICE"|"CREDIT_NOTE"|"PAYMENT"; docNum: string; detailMain: string; detailSub: string; amount: number; payment: number };
  const entries: Entry[] = [];

  for (const doc of docs) {
    if (doc.type === "INVOICE") {
      entries.push({ createdAt: doc.createdAt.toISOString(), docType: "INVOICE", docNum: doc.docNum, detailMain: doc.docNum, detailSub: doc.dueDate ? `Due on ${fmtD(doc.dueDate.toISOString())}` : (doc.subject ?? ""), amount: doc.total, payment: 0 });
      for (const p of doc.payments) {
        const m = String(p.method).replace(/_/g, " ");
        entries.push({ createdAt: p.createdAt.toISOString(), docType: "PAYMENT", docNum: doc.docNum, detailMain: m.charAt(0).toUpperCase() + m.slice(1).toLowerCase(), detailSub: `${fmtAmt(p.amountCents, cur)} for ${doc.docNum}`, amount: 0, payment: p.amountCents });
      }
    }
    if (doc.type === "CREDIT_NOTE") {
      const o = doc.originDoc?.docNum ?? null;
      entries.push({ createdAt: doc.createdAt.toISOString(), docType: "CREDIT_NOTE", docNum: doc.docNum, detailMain: doc.docNum, detailSub: o ? `Credit for ${o}` : (doc.subject ?? `Credit Note ${doc.docNum}`), amount: doc.total, payment: 0 });
    }
  }

  entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  let bal = openingBalance;
  const rows = entries.map(e => {
    if (e.docType === "INVOICE")     bal += e.amount;
    if (e.docType === "PAYMENT")     bal -= e.payment;
    if (e.docType === "CREDIT_NOTE") bal -= e.amount;
    return { ...e, balance: bal };
  });

  const totalCharged  = entries.filter(e => e.docType === "INVOICE").reduce((s, e) => s + e.amount,  0);
  const totalPayments = entries.filter(e => e.docType === "PAYMENT").reduce((s, e) => s + e.payment, 0);
  const totalCredits  = entries.filter(e => e.docType === "CREDIT_NOTE").reduce((s, e) => s + e.amount, 0);
  const balanceDue    = openingBalance + totalCharged - totalPayments - totalCredits;

  const period = from && to ? `${fmtD(from+"T00:00:00")} To ${fmtD(to+"T00:00:00")}`
    : from ? `From ${fmtD(from+"T00:00:00")}` : to ? `Up to ${fmtD(to+"T00:00:00")}` : "All Transactions";

  const footerText = String(li.footerText ?? `${li.companyName ?? user.market.name}${li.email ? " · "+li.email : ""}${li.phone ? " · "+li.phone : ""}`);

  const docTitle = from && to ? `Statement_of_Accounts_${from}_${to}` : from ? `Statement_of_Accounts_from_${from}` : `Statement_of_Accounts`;

  return (
    <>
      <title>{docTitle}</title>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #111827; font-size: 13px; line-height: 1.5; }
        @page {
          size: A4;
          margin: 15mm;
        }
        @media print {
          body { font-size: 11px; }
        }
        table { width: 100%; border-collapse: collapse; }
        thead tr { background: #318774; }
        thead th { color: #fff; font-size: 10px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; padding: 9px 10px; text-align: left; }
        thead th.r { text-align: right; }
        tbody tr:nth-child(even) { background: #f7f7f7; }
        tbody tr:nth-child(odd)  { background: #fff; }
        td { padding: 6px 8px; font-size: 12px; color: #111827; border-bottom: 0.5px solid #e8e8e8; vertical-align: middle; }
        td.r { text-align: right; }
        td.m { color: #aaa; }
        .ds { font-size: 10px; color: #666666; margin-top: 1px; }
        .stbl td { padding: 4px 8px; font-size: 12px; border: none; }
        .stbl td.v { text-align: right; }
        .stbl tr.bd td { border-top: 0.5px solid #ccc; padding-top: 5px; font-weight: 700; }
      `}</style>

      {/* Hidden footer text for Puppeteer to read */}
      <span id="footer-text-data" style={{ display: "none" }}>{footerText}</span>

      <div>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>

          {/* Left: Company + TO */}
          <div style={{ maxWidth: "50%" }}>
            {cp.logoUrl && <img src={String(cp.logoUrl)} alt="" style={{ maxHeight: 40, maxWidth: 140, objectFit: "contain", marginBottom: 6, display: "block" }} />}
            <div style={{ fontSize: cp.logoUrl ? 14 : 24, fontWeight: 700, color: pc, marginBottom: 2 }}>{String(li.companyName ?? user.market.name)}</div>
            {li.tagline   && <div style={{ fontSize: 12, color: "#555", marginBottom: 3 }}>{String(li.tagline)}</div>}
            {coAddr       && <div style={{ fontSize: 12, color: "#444444", lineHeight: 1.75 }}>{coAddr}{coAddr2 && <><br />{coAddr2}</>}</div>}
            {li.vatNumber && <div style={{ fontSize: 12, color: "#444444", marginTop: 2 }}>VAT: {String(li.vatNumber)}</div>}

            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#444444", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>TO</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{custName}</div>
              {custAddr  && <div style={{ fontSize: 12, color: "#444444", lineHeight: 1.75 }}>{custAddr}{custAddr2 && <><br />{custAddr2}</>}</div>}
              {user.vatTaxId && <div style={{ fontSize: 12, color: "#444444", marginTop: 2 }}>VAT: {user.vatTaxId}</div>}
            </div>
          </div>

          {/* Right: Title + Summary */}
          <div style={{ width: 260, textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 2, lineHeight: 1.2 }}>Statement of Accounts</div>
            <div style={{ fontSize: 11, color: "#6b7280", paddingBottom: 8, marginBottom: 10, borderBottom: "1px solid #ddd" }}>{period}</div>
            <div style={{ border: "0.5px solid #ddd" }}>
              <div style={{ background: "#efefef", padding: "5px 8px", fontSize: 11, fontWeight: 700, color: "#333", textAlign: "left" }}>Account Summary</div>
              <table className="stbl">
                <tbody>
                  <tr><td style={{ color: "#444" }}>Opening Balance</td><td className="v">{fmtBal(openingBalance, cur)}</td></tr>
                  <tr><td style={{ color: "#444" }}>Invoiced Amount</td><td className="v">{fmtAmt(totalCharged, cur)}</td></tr>
                  <tr><td style={{ color: "#444" }}>Amount Received</td><td className="v">{fmtAmt(totalPayments + totalCredits, cur)}</td></tr>
                  <tr className="bd"><td>Balance Due</td><td className="v">{fmtBal(balanceDue, cur)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Table ── */}
        <div id="statement-table">
          <table>
            <thead>
              <tr>
                <th style={{ width: "14%", whiteSpace: "nowrap" }}>Date</th>
                <th style={{ width: "15%" }}>Transactions</th>
                <th>Details</th>
                <th className="r" style={{ width: "13%" }}>Amount</th>
                <th className="r" style={{ width: "13%" }}>Payments</th>
                <th className="r" style={{ width: "13%" }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {openingBalance !== 0 && (
                <tr>
                  <td style={{ whiteSpace: "nowrap" }}>{from ? fmtD(from+"T00:00:00") : "—"}</td>
                  <td>Opening Balance</td>
                  <td></td>
                  <td className="r">{fmtAmt(openingBalance, cur)}</td>
                  <td className="r m">—</td>
                  <td className="r">{fmtBal(openingBalance, cur)}</td>
                </tr>
              )}
              {rows.map((e, i) => (
                <tr key={i}>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtD(e.createdAt)}</td>
                  <td>{(e as any).subType === "REFUND" ? "Refund" : (TX[e.docType] ?? e.docType)}</td>
                  <td>
                    <div>{e.detailMain}</div>
                    {e.detailSub && <div className="ds">{e.detailSub}</div>}
                  </td>
                  <td className="r">
                    {e.docType === "INVOICE"     && fmtOrDash(e.amount,  cur)}
                    {e.docType === "CREDIT_NOTE" && `(${fmtAmt(e.amount, cur)})`}
                    {e.docType === "PAYMENT"     && "—"}
                  </td>
                  <td className="r">{e.docType === "PAYMENT" ? fmtAmt(e.payment, cur) : "—"}</td>
                  <td className="r">{fmtBal(e.balance, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Balance Due — outside table, only appears once at end of document */}
        <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1.5px solid #318774", paddingTop: 6, marginTop: 0 }}>
          <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700 }}>Balance Due</span>
            <span style={{ fontSize: 12, fontWeight: 700, minWidth: 100, textAlign: "right" }}>{fmtBal(balanceDue, cur)}</span>
          </div>
        </div>

      </div>
    </>
  );
}
