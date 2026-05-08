"use client";
// app/dashboard/statement/StatementClient.tsx

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Entry {
  date:       string;
  docType:    "INVOICE" | "CREDIT_NOTE" | "PAYMENT";
  docNum:     string;
  docId:      string;
  detailMain: string;
  detailSub:  string;
  amount:     number;
  payment:    number;
  currency:   string;
  status:     string;
  balance:    number;
}
interface Statement {
  currency:            string;
  openingBalance:      number;
  totalCharged:        number;
  totalPayments:       number;
  totalCredits:        number;
  outstandingBalance:  number;
  entries:             Entry[];
}

function fmt(cents: number, currency: string) {
  if (cents === 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}
function fmtBalance(cents: number, currency: string) {
  if (cents === 0) return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(0);
  const abs = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(Math.abs(cents) / 100);
  return cents < 0 ? `−${abs}` : abs;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TRANSACTION_LABELS: Record<string, string> = {
  INVOICE:     "Invoice",
  CREDIT_NOTE: "Credit Note",
  PAYMENT:     "Payment Received",
};

const LINKABLE_TYPES = ["INVOICE", "CREDIT_NOTE"];

function Sk({ w = "100%", h = 13 }: { w?: string | number; h?: number }) {
  return <span className="cy-shimmer" style={{ width: w, height: h, display: "inline-block" }} />;
}

export function StatementClient() {
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [from,      setFrom]      = useState("");
  const [to,        setTo]        = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  function load(f?: string, t?: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (f) params.set("from", f);
    if (t) params.set("to",   t);
    fetch(`/api/customer/statement?${params.toString()}`)
      .then(r => r.json())
      .then(d => setStatement(d.statement ?? null))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    load(from || undefined, to || undefined);
  }

  async function handleDownload() {
    setPdfLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to)   params.set("to",   to);
      const res = await fetch(`/api/customer/statement/pdf?${params.toString()}`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      const label = from && to ? `Statement_${from}_${to}` : "Statement";
      a.href = href; a.download = `${label}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(href);
    } catch { alert("PDF generation failed. Please try again."); }
    setPdfLoading(false);
  }

  const currency = statement?.currency ?? "SAR";

  return (
    <>
      <style>{`
        @keyframes cy-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .cy-shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%);background-size:800px 100%;animation:cy-shimmer 1.4s ease-in-out infinite;border-radius:4px;}
        .cy-stmt-row:hover td{background:#f5f5f5!important;}
        @media print {
          body * { visibility: hidden; }
          #statement-print-area, #statement-print-area * { visibility: visible; }
          #statement-print-area { position: absolute; top: 0; left: 0; width: 100%; }
          .cy-no-print { display: none !important; }
        }
      `}</style>

      <div className="cy-page-content">
        <div className="cy-dash-wrap">

          {/* Header row */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <h1 className="cy-page-title" style={{ margin: "0 0 3px" }}>Statement of Accounts</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Complete transaction history with running balance.</p>
            </div>
            <button
              className="cy-no-print"
              onClick={handleDownload}
              disabled={pdfLoading}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                height: 34, padding: "0 14px",
                background: "#fff", border: "1px solid #e5e7eb",
                fontSize: 13, color: "#374151",
                cursor: pdfLoading ? "not-allowed" : "pointer",
                opacity: pdfLoading ? 0.6 : 1,
                flexShrink: 0,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1v9M4.5 7l3.5 3.5L11.5 7M2 12.5h12" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {pdfLoading ? "Generating…" : "Download"}
            </button>
          </div>

          {/* Date filter */}
          <form onSubmit={handleFilter} className="cy-no-print" style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
            <div>
              <label style={{ display: "block", fontSize: 11.5, color: "#6b7280", marginBottom: 4 }}>From</label>
              <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                style={{ height: 34, padding: "0 10px", border: "1px solid #e5e7eb", fontSize: 13, color: "#374151" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11.5, color: "#6b7280", marginBottom: 4 }}>To</label>
              <input type="date" value={to} onChange={e => setTo(e.target.value)}
                style={{ height: 34, padding: "0 10px", border: "1px solid #e5e7eb", fontSize: 13, color: "#374151" }} />
            </div>
            <button type="submit" style={{ height: 34, padding: "0 14px", background: "#fff", border: "1px solid #e5e7eb", fontSize: 13, color: "#374151", cursor: "pointer" }}>
              Apply
            </button>
            {(from || to) && (
              <button type="button" onClick={() => { setFrom(""); setTo(""); load(); }}
                style={{ height: 34, padding: "0 12px", background: "transparent", border: "none", fontSize: 12.5, color: "#9ca3af", cursor: "pointer" }}>
                Clear
              </button>
            )}
          </form>

          {/* Summary cards */}
          {!loading && statement && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Total invoiced",  value: statement.totalCharged       },
                { label: "Total paid",      value: statement.totalPayments      },
                { label: "Credits applied", value: statement.totalCredits       },
                { label: "Outstanding",     value: statement.outstandingBalance },
              ].map(c => (
                <div key={c.label} style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "13px 16px" }}>
                  <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: "#111827", letterSpacing: "-0.01em" }}>
                    {fmt(c.value, currency)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          <div id="statement-print-area" ref={tableRef} style={{ background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  {[
                    { label: "Date",        align: "left",  width: "13%" },
                    { label: "Transaction", align: "left",  width: "15%" },
                    { label: "Details",     align: "left",  width: "auto" },
                    { label: "Amount",      align: "right", width: "14%" },
                    { label: "Payments",    align: "right", width: "14%" },
                    { label: "Balance",     align: "right", width: "14%" },
                  ].map(h => (
                    <th key={h.label} style={{
                      width: h.width,
                      padding: "8px 14px",
                      fontSize: 11, fontWeight: 600, color: "#9ca3af",
                      textTransform: "uppercase", letterSpacing: "0.05em",
                      textAlign: h.align as "left" | "right",
                    }}>{h.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>

                {/* Opening balance row */}
                {!loading && (
                  <tr style={{ borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
                    <td style={{ padding: "9px 14px", fontSize: 12.5, color: "#9ca3af" }}>—</td>
                    <td style={{ padding: "9px 14px", fontSize: 12.5, color: "#9ca3af", fontStyle: "italic" }}>Opening Balance</td>
                    <td style={{ padding: "9px 14px", fontSize: 12.5, color: "#9ca3af" }}>—</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12.5, color: "#9ca3af" }}>—</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12.5, color: "#9ca3af" }}>—</td>
                    <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
                      {fmtBalance(statement?.openingBalance ?? 0, currency)}
                    </td>
                  </tr>
                )}

                {/* Loading skeletons */}
                {loading && [1,2,3,4,5].map(i => (
                  <tr key={i} style={{ borderBottom: "1px solid #f9fafb" }}>
                    <td style={{ padding: "10px 14px" }}><Sk w="80%" h={11} /></td>
                    <td style={{ padding: "10px 14px" }}><Sk w="70%" h={11} /></td>
                    <td style={{ padding: "10px 14px" }}><Sk w="60%" h={11} /></td>
                    <td style={{ padding: "10px 14px" }}><Sk w="80%" h={11} /></td>
                    <td style={{ padding: "10px 14px" }}><Sk w="80%" h={11} /></td>
                    <td style={{ padding: "10px 14px" }}><Sk w="80%" h={11} /></td>
                  </tr>
                ))}

                {/* Empty state */}
                {!loading && (!statement || statement.entries.length === 0) && (
                  <tr>
                    <td colSpan={6} style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
                      No transactions found.
                    </td>
                  </tr>
                )}

                {/* Data rows */}
                {!loading && statement?.entries.map((e, idx) => {
                  const isLast     = idx === statement.entries.length - 1;
                  const typeLabel  = TRANSACTION_LABELS[e.docType] ?? e.docType;
                  const isLinkable = LINKABLE_TYPES.includes(e.docType);

                  return (
                    <tr key={`${e.docId}-${e.docType}-${idx}`} className="cy-stmt-row"
                      style={{ borderBottom: isLast ? "none" : "1px solid #f3f4f6" }}>

                      {/* Date */}
                      <td style={{ padding: "9px 14px", fontSize: 12.5, color: "#374151" }}>
                        {fmtDate(e.date)}
                      </td>

                      {/* Transaction type */}
                      <td style={{ padding: "9px 14px", fontSize: 12.5, color: "#374151" }}>
                        {typeLabel}
                      </td>

                      {/* Details: main + sub */}
                      <td style={{ padding: "9px 14px" }}>
                        {isLinkable ? (
                          <Link href={`/dashboard/sales/${e.docId}`}
                            style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", textDecoration: "none" }}
                            onMouseOver={ev => (ev.currentTarget.style.textDecoration = "underline")}
                            onMouseOut={ev => (ev.currentTarget.style.textDecoration = "none")}>
                            {e.detailMain}
                          </Link>
                        ) : (
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#374151" }}>{e.detailMain}</span>
                        )}
                        {e.detailSub && (
                          <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2 }}>{e.detailSub}</div>
                        )}
                      </td>

                      {/* Amount — invoices plain, credit notes bracketed */}
                      <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12.5, color: "#374151" }}>
                        {e.docType === "INVOICE"     && fmt(e.amount, e.currency)}
                        {e.docType === "CREDIT_NOTE" && `(${fmt(e.amount, e.currency)})`}
                        {e.docType === "PAYMENT"     && <span style={{ color: "#d1d5db" }}>—</span>}
                      </td>

                      {/* Payments — payments only */}
                      <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12.5, color: "#374151" }}>
                        {e.docType === "PAYMENT"
                          ? fmt(e.payment, e.currency)
                          : <span style={{ color: "#d1d5db" }}>—</span>
                        }
                      </td>

                      {/* Balance */}
                      <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
                        {fmtBalance(e.balance, e.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Footer — Balance Due only */}
              {!loading && statement && statement.entries.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: "2px solid #e5e7eb", background: "#f9fafb" }}>
                    <td colSpan={5} style={{ padding: "10px 14px", textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
                      Balance Due
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontSize: 13, fontWeight: 700, color: "#111827" }}>
                      {fmtBalance(statement.outstandingBalance, currency)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

        </div>
      </div>
    </>
  );
}
