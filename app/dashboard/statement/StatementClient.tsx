"use client";
// app/dashboard/statement/StatementClient.tsx

import { useEffect, useState } from "react";
import { colors } from "@/lib/ui/tokens";

interface Entry {
  date: string; type: string; docNum: string; docId: string;
  description: string; debit: number; credit: number;
  currency: string; status: string; balance: number;
}
interface Statement {
  currency: string; totalInvoiced: number; totalPaid: number;
  totalCredits: number; outstandingBalance: number; entries: Entry[];
}

function fmt(cents: number, currency: string) {
  if (cents === 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const ENTRY_COLORS: Record<string, { color: string }> = {
  INVOICE:     { color: "#185FA5" },
  PAYMENT:     { color: "#0F6E56" },
  CREDIT_NOTE: { color: "#991b1b" },
};

function Sk({ w = "100%", h = 13 }: { w?: string | number; h?: number }) {
  return <span className="cy-shimmer" style={{ width: w, height: h, display: "inline-block" }} />;
}

export function StatementClient() {
  const [statement, setStatement] = useState<Statement | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [from,      setFrom]      = useState("");
  const [to,        setTo]        = useState("");

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

  const currency = statement?.currency ?? "USD";

  return (
    <>
      <style>{`
        @keyframes cy-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .cy-shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%);background-size:800px 100%;animation:cy-shimmer 1.4s ease-in-out infinite;border-radius:4px;}
        .cy-row:hover{background:#f5faf8!important;}
      `}</style>

      <div className="cy-page-content">
        <div className="cy-dash-wrap">

          <div style={{ marginBottom: 20 }}>
            <h1 className="cy-page-title" style={{ margin: "0 0 3px" }}>Statement of Accounts</h1>
            <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Complete transaction history with running balance.</p>
          </div>

          {/* Date filter */}
          <form onSubmit={handleFilter} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
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
                { label: "Total invoiced",   value: statement.totalInvoiced,      color: "#111827" },
                { label: "Total paid",       value: statement.totalPaid,           color: "#0F6E56" },
                { label: "Credits applied",  value: statement.totalCredits,        color: "#0F6E56" },
                { label: "Outstanding",      value: statement.outstandingBalance,  color: statement.outstandingBalance > 0 ? "#b45309" : "#0F6E56" },
              ].map(c => (
                <div key={c.label} style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "13px 16px" }}>
                  <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 4 }}>{c.label}</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: c.color, letterSpacing: "-0.01em" }}>{fmt(c.value, currency)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ display: "flex", padding: "8px 14px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
              {["Date", "Document", "Description", "Debit", "Credit", "Balance"].map((h, i) => (
                <span key={i} style={{
                  flex: [1,1.2,3,1,1,1][i],
                  fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em",
                  paddingRight: 8, textAlign: i >= 3 ? "right" as const : "left" as const,
                }}>{h}</span>
              ))}
            </div>

            {loading ? (
              [1,2,3,4,5].map(i => (
                <div key={i} style={{ display: "flex", padding: "10px 14px", borderBottom: "1px solid #f9fafb", gap: 12 }}>
                  <Sk w="12%" h={11} /><Sk w="16%" h={11} /><Sk w="30%" h={11} /><Sk w="10%" h={11} /><Sk w="10%" h={11} /><Sk w="12%" h={11} />
                </div>
              ))
            ) : !statement || statement.entries.length === 0 ? (
              <div style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>No transactions found.</div>
            ) : (
              statement.entries.map((e, idx) => {
                const typeColor = ENTRY_COLORS[e.type]?.color ?? "#6b7280";
                const isLast    = idx === statement.entries.length - 1;
                return (
                  <div key={`${e.docId}-${e.type}-${idx}`} className="cy-row"
                    style={{ display: "flex", alignItems: "center", padding: "9px 14px", borderBottom: isLast ? "none" : "1px solid #f3f4f6", transition: "background 0.1s", background: isLast ? "#fafafa" : "transparent" }}>
                    <span style={{ flex: 1, fontSize: 12, color: "#6b7280", paddingRight: 8 }}>{fmtDate(e.date)}</span>
                    <span style={{ flex: 1.2, fontSize: 12, fontFamily: "monospace", fontWeight: 500, color: typeColor, paddingRight: 8 }}>{e.docNum}</span>
                    <span style={{ flex: 3, fontSize: 12.5, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{e.description}</span>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: e.debit > 0 ? "#b45309" : "#d1d5db", paddingRight: 8, textAlign: "right" }}>
                      {e.debit > 0 ? fmt(e.debit, e.currency) : "—"}
                    </span>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: e.credit > 0 ? "#0F6E56" : "#d1d5db", paddingRight: 8, textAlign: "right" }}>
                      {e.credit > 0 ? fmt(e.credit, e.currency) : "—"}
                    </span>
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: e.balance > 0 ? "#b45309" : "#0F6E56", textAlign: "right" }}>
                      {fmt(Math.abs(e.balance), e.currency)}
                      {e.balance < 0 && <span style={{ fontSize: 10, marginLeft: 3, color: "#0F6E56" }}>CR</span>}
                    </span>
                  </div>
                );
              })
            )}

            {/* Footer totals */}
            {!loading && statement && statement.entries.length > 0 && (
              <div style={{ display: "flex", padding: "10px 14px", borderTop: "2px solid #e5e7eb", background: "#f9fafb" }}>
                <span style={{ flex: 1 }} />
                <span style={{ flex: 1.2 }} />
                <span style={{ flex: 3, fontSize: 12.5, fontWeight: 600, color: "#111827", paddingRight: 8 }}>Total</span>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: "#b45309", paddingRight: 8, textAlign: "right" }}>{fmt(statement.totalInvoiced, currency)}</span>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: "#0F6E56", paddingRight: 8, textAlign: "right" }}>{fmt(statement.totalPaid + statement.totalCredits, currency)}</span>
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: statement.outstandingBalance > 0 ? "#b45309" : "#0F6E56", textAlign: "right" }}>
                  {fmt(Math.abs(statement.outstandingBalance), currency)}
                </span>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}
