"use client";
// app/admin/sales/billing/BillingClient.tsx

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { CLR } from "@/components/ui/admin-ui";

interface Entry {
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
}

interface Summary {
  currency:      string;
  totalCharged:  number;
  totalPayments: number;
  totalCredits:  number;
  outstanding:   number;
}

function fmt(cents: number, currency: string) {
  if (cents === 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TX_LABELS: Record<string, string> = {
  INVOICE:     "Invoice",
  CREDIT_NOTE: "Credit Note",
  PAYMENT:     "Payment Received",
};

const DETAIL_BASE: Record<string, string> = {
  INVOICE:     "/admin/sales/invoices",
  CREDIT_NOTE: "/admin/sales/returns",
};

function Sk({ w = "80%" }: { w?: string }) {
  return <span style={{ display: "inline-block", width: w, height: 11, background: "#f0f0f0", borderRadius: 3 }} />;
}

export default function BillingClient() {
  const router = useRouter();

  const [entries,  setEntries]  = useState<Entry[]>([]);
  const [summary,  setSummary]  = useState<Summary | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [total,    setTotal]    = useState(0);
  const [pages,    setPages]    = useState(1);
  const [page,     setPage]     = useState(1);

  const [market,   setMarket]   = useState("SAUDI");
  const [from,     setFrom]     = useState("");
  const [to,       setTo]       = useState("");
  const [q,        setQ]        = useState("");
  const [type,     setType]     = useState("");

  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    const params = new URLSearchParams();
    if (market) params.set("market", market);
    if (from)   params.set("from",   from);
    if (to)     params.set("to",     to);
    if (q)      params.set("q",      q);
    if (type)   params.set("type",   type);
    params.set("page", String(pg));
    try {
      const res  = await fetch(`/api/admin/sales/billing?${params}`);
      const data = await res.json();
      setEntries(data.entries  ?? []);
      setSummary(data.summary  ?? null);
      setTotal(data.total      ?? 0);
      setPages(data.pages      ?? 1);
      setPage(pg);
    } catch { /**/ }
    setLoading(false);
  }, [market, from, to, q, type]);

  // Debounce q changes
  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => load(1), 300);
  }, [q]);

  // Immediate reload for other filters
  useEffect(() => { load(1); }, [market, from, to, type]);

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    load(1);
  }

  const currency = summary?.currency ?? (market === "GLOBAL" ? "USD" : "SAR");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Filters ── */}
      <form onSubmit={handleFilter} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        {/* Market */}
        <div>
          <label style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Market</label>
          <select value={market} onChange={e => setMarket(e.target.value)}
            style={{ height: 34, padding: "0 10px", border: "1px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", background: "#fff", color: "#374151", minWidth: 130 }}>
            <option value="">All Markets</option>
            <option value="SAUDI">Saudi (SAR)</option>
            <option value="GLOBAL">Global (USD)</option>
          </select>
        </div>

        {/* Type */}
        <div>
          <label style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Type</label>
          <select value={type} onChange={e => setType(e.target.value)}
            style={{ height: 34, padding: "0 10px", border: "1px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", background: "#fff", color: "#374151", minWidth: 150 }}>
            <option value="">All Types</option>
            <option value="INVOICE">Invoice</option>
            <option value="CREDIT_NOTE">Credit Note</option>
            <option value="PAYMENT">Payment Received</option>
            <option value="REFUND">Refund</option>
          </select>
        </div>

        {/* From */}
        <div>
          <label style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            style={{ height: 34, padding: "0 10px", border: "1px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", color: "#374151" }} />
        </div>

        {/* To */}
        <div>
          <label style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)}
            style={{ height: 34, padding: "0 10px", border: "1px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", color: "#374151" }} />
        </div>

        {/* Customer search */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <label style={{ display: "block", fontSize: 11, color: "#6b7280", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Customer</label>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or email…"
            style={{ height: 34, width: "100%", padding: "0 10px", border: "1px solid #e5e7eb", fontSize: 13, fontFamily: "inherit", color: "#374151", boxSizing: "border-box" }} />
        </div>

        {(from || to || q || type || market) && (
          <button type="button" onClick={() => { setMarket(""); setFrom(""); setTo(""); setQ(""); setType(""); }}
            style={{ height: 34, padding: "0 12px", background: "transparent", border: "none", fontSize: 12.5, color: "#9ca3af", cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-end" }}>
            Clear
          </button>
        )}
      </form>

      {/* ── Summary Cards ── */}
      {!loading && summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10 }}>
          {[
            { label: "Total Invoiced",  value: summary.totalCharged   },
            { label: "Total Paid",      value: summary.totalPayments  },
            { label: "Credits Applied", value: summary.totalCredits   },
            { label: "Outstanding",     value: summary.outstanding    },
          ].map(c => (
            <div key={c.label} style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "13px 16px" }}>
              <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#111827", letterSpacing: "-0.01em" }}>
                {fmt(c.value, currency)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              {[
                { label: "Date",        width: "11%" },
                { label: "Customer",    width: "18%" },
                { label: "Transaction", width: "13%" },
                { label: "Details",     width: "auto" },
                { label: "Market",      width: "8%"  },
                { label: "Amount",      width: "12%", right: true },
                { label: "Payments",    width: "12%", right: true },
              ].map(h => (
                <th key={h.label} style={{
                  width: h.width, padding: "8px 12px",
                  fontSize: 11, fontWeight: 600, color: "#9ca3af",
                  textTransform: "uppercase", letterSpacing: "0.05em",
                  textAlign: h.right ? "right" : "left",
                }}>{h.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && [1,2,3,4,5,6,7].map(i => (
              <tr key={i} style={{ borderBottom: "1px solid #f9fafb" }}>
                {[1,2,3,4,5,6,7].map(j => (
                  <td key={j} style={{ padding: "10px 12px" }}><Sk /></td>
                ))}
              </tr>
            ))}

            {!loading && entries.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: "48px 16px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
                  No transactions found.
                </td>
              </tr>
            )}

            {!loading && entries.map((e, idx) => {
              const isLast    = idx === entries.length - 1;
              const txLabel   = e.subType === "REFUND" ? "Refund" : (TX_LABELS[e.docType] ?? e.docType);
              const isDoc     = e.docType === "INVOICE" || e.docType === "CREDIT_NOTE";
              const isInvoice = e.docType === "INVOICE";
              const isCN      = e.docType === "CREDIT_NOTE";
              const isPayment = e.docType === "PAYMENT";

              return (
                <tr key={`${e.docId}-${e.docType}-${idx}`}
                  style={{ borderBottom: isLast ? "none" : "1px solid #f3f4f6" }}
                  onMouseEnter={el => (el.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={el => (el.currentTarget.style.background = "")}>

                  {/* Date */}
                  <td style={{ padding: "9px 12px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                    {fmtDate(e.createdAt)}
                  </td>

                  {/* Customer */}
                  <td style={{ padding: "9px 12px" }}>
                    <div
                      style={{ fontSize: 12.5, fontWeight: 500, color: CLR.primary, cursor: "pointer" }}
                      onClick={() => router.push(`/admin/customers/${e.customerId}/statement`)}
                      onMouseOver={ev => (ev.currentTarget.style.textDecoration = "underline")}
                      onMouseOut={ev => (ev.currentTarget.style.textDecoration = "none")}
                    >
                      {e.customerName}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{e.customerEmail}</div>
                  </td>

                  {/* Transaction type */}
                  <td style={{ padding: "9px 12px", fontSize: 12.5, color: "#374151" }}>
                    {txLabel}
                  </td>

                  {/* Details */}
                  <td style={{ padding: "9px 12px" }}>
                    {isDoc ? (
                      <span
                        style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", cursor: "pointer" }}
                        onClick={() => router.push(`${DETAIL_BASE[e.docType]}/${e.docId}`)}
                        onMouseOver={ev => (ev.currentTarget.style.textDecoration = "underline")}
                        onMouseOut={ev => (ev.currentTarget.style.textDecoration = "none")}
                      >
                        {e.detailMain}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#374151" }}>{e.detailMain}</span>
                    )}
                    {e.detailSub && (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{e.detailSub}</div>
                    )}
                  </td>

                  {/* Market badge */}
                  <td style={{ padding: "9px 12px" }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: "2px 6px",
                      background: e.marketKey === "SAUDI" ? "#fff8e6" : "#eff6ff",
                      color:      e.marketKey === "SAUDI" ? "#92400e"  : "#1d4ed8",
                      border:     `1px solid ${e.marketKey === "SAUDI" ? "#fcd34d" : "#bfdbfe"}`,
                    }}>
                      {e.marketKey === "SAUDI" ? "SA" : "GL"}
                    </span>
                  </td>

                  {/* Amount */}
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12.5, color: "#374151" }}>
                    {isInvoice && fmt(e.amount, e.currency)}
                    {isCN      && `(${fmt(e.amount, e.currency)})`}
                    {isPayment && <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>

                  {/* Payments */}
                  <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 12.5, color: "#374151" }}>
                    {isPayment ? fmt(e.payment, e.currency) : <span style={{ color: "#d1d5db" }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* ── Pagination ── */}
        {!loading && pages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: "1px solid #e5e7eb", background: "#f9fafb" }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, total)} of {total} transactions
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => load(page - 1)} disabled={page <= 1}
                style={{ height: 30, padding: "0 10px", fontSize: 12, border: "1px solid #e5e7eb", background: "#fff", cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1, fontFamily: "inherit" }}>
                ←
              </button>
              {Array.from({ length: Math.min(pages, 7) }, (_, i) => {
                const pg = pages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= pages - 3 ? pages - 6 + i : page - 3 + i;
                return (
                  <button key={pg} onClick={() => load(pg)}
                    style={{ height: 30, minWidth: 30, padding: "0 8px", fontSize: 12, border: "1px solid #e5e7eb", background: pg === page ? CLR.primary : "#fff", color: pg === page ? "#fff" : "#374151", cursor: "pointer", fontFamily: "inherit" }}>
                    {pg}
                  </button>
                );
              })}
              <button onClick={() => load(page + 1)} disabled={page >= pages}
                style={{ height: 30, padding: "0 10px", fontSize: 12, border: "1px solid #e5e7eb", background: "#fff", cursor: page >= pages ? "not-allowed" : "pointer", opacity: page >= pages ? 0.4 : 1, fontFamily: "inherit" }}>
                →
              </button>
            </div>
          </div>
        )}

        {!loading && pages <= 1 && total > 0 && (
          <div style={{ padding: "8px 14px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 12, color: "#6b7280" }}>
            {total} transaction{total !== 1 ? "s" : ""}
          </div>
        )}
      </div>

    </div>
  );
}
