"use client";
// app/admin/customers/[id]/statement/page.tsx

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CLR } from "@/components/ui/admin-ui";
import { AdminHeader } from "@/components/nav/AdminHeader";

interface Entry {
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
  balance:    number;
}
interface Statement {
  currency:            string;
  openingBalance:      number;
  totalCharged:        number;
  totalPayments:       number;
  totalCredits:        number;
  totalRefunds:        number;
  outstandingBalance:  number;
  entries:             Entry[];
}

function fmt(cents: number, currency: string) {
  if (cents === 0) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}
function fmtBalance(cents: number, currency: string) {
  const abs = new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(Math.abs(cents) / 100);
  return cents < 0 ? `−${abs}` : abs;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const TX_LABELS: Record<string, string> = {
  INVOICE:     "Invoice",
  CREDIT_NOTE: "Credit Note",
  PAYMENT:     "Payment Received",
};

function Sk({ w = "100%", h = 11 }: { w?: string | number; h?: number }) {
  return <span style={{ display: "inline-block", width: w, height: h, background: "#f0f0f0", borderRadius: 3 }} />;
}

export default function AdminCustomerStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: customerId } = use(params);
  const router = useRouter();

  const [statement,   setStatement]   = useState<Statement | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [from,        setFrom]        = useState("");
  const [to,          setTo]          = useState("");
  const [customerName,  setCustomerName]  = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [pdfLoading,   setPdfLoading]   = useState(false);

  function load(f?: string, t?: string) {
    setLoading(true);
    const params = new URLSearchParams();
    if (f) params.set("from", f);
    if (t) params.set("to",   t);
    fetch(`/api/admin/customers/${customerId}/statement?${params.toString()}`)
      .then(r => r.json())
      .then(d => setStatement(d.statement ?? null))
      .finally(() => setLoading(false));
  }

  // Load customer name for breadcrumb
  useEffect(() => {
    fetch(`/api/admin/users/${customerId}`)
      .then(r => r.json())
      .then(d => {
        const c = d.data ?? {};
        setCustomerName(c.companyName ?? c.fullName ?? "Customer");
        setCustomerEmail(c.email ?? "");
      })
      .catch(() => {});
    load();
  }, [customerId]);

  async function handleDownload() {
    setPdfLoading(true);
    try {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to)   params.set("to",   to);
      const res = await fetch(`/api/admin/customers/${customerId}/statement/pdf?${params.toString()}`);
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      const label = from && to ? `Statement_of_Accounts_${from}_${to}` : from ? `Statement_of_Accounts_from_${from}` : "Statement_of_Accounts";
      a.href = href; a.download = `${label}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(href);
    } catch { alert("PDF generation failed. Please try again."); }
    setPdfLoading(false);
  }

  function handleFilter(e: React.FormEvent) {
    e.preventDefault();
    load(from || undefined, to || undefined);
  }

  const currency = statement?.currency ?? "SAR";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <AdminHeader />
      <main style={{ flex: 1, overflowY: "auto", padding: 24, background: "#f5f5f5" }}>

        {/* Breadcrumb + back */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 10 }}>
            ADMIN / CUSTOMERS / {customerName.toUpperCase()} / STATEMENT
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <button onClick={() => router.back()}
              style={{ background: "none", border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit", padding: "5px 10px", color: "#6b7280", fontSize: 13 }}>←</button>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 600, color: "#111827", margin: "0 0 3px" }}>Statement of Accounts</h1>
              {customerName && (
                <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                  {customerName}{customerEmail && <span style={{ marginLeft: 6, color: "#9ca3af" }}>— {customerEmail}</span>}
                </p>
              )}
            </div>
            <div style={{ flex: 1 }} />
            <button
              onClick={handleDownload}
              disabled={pdfLoading}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                height: 34, padding: "0 14px",
                background: "#fff", border: "1px solid #e5e7eb",
                fontSize: 13, color: "#374151",
                cursor: pdfLoading ? "not-allowed" : "pointer",
                opacity: pdfLoading ? 0.6 : 1, fontFamily: "inherit",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 1v9M4.5 7l3.5 3.5L11.5 7M2 12.5h12" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              {pdfLoading ? "Generating…" : "Download PDF"}
            </button>
          </div>
        </div>

        {/* Date filter */}
        <form onSubmit={handleFilter} style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" }}>
          <div>
            <label style={{ display: "block", fontSize: 11.5, color: "#6b7280", marginBottom: 4 }}>From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ height: 34, padding: "0 10px", border: "1px solid #e5e7eb", fontSize: 13, color: "#374151", fontFamily: "inherit" }} />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11.5, color: "#6b7280", marginBottom: 4 }}>To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ height: 34, padding: "0 10px", border: "1px solid #e5e7eb", fontSize: 13, color: "#374151", fontFamily: "inherit" }} />
          </div>
          <button type="submit"
            style={{ height: 34, padding: "0 14px", background: "#fff", border: "1px solid #e5e7eb", fontSize: 13, color: "#374151", cursor: "pointer", fontFamily: "inherit" }}>
            Apply
          </button>
          {(from || to) && (
            <button type="button" onClick={() => { setFrom(""); setTo(""); load(); }}
              style={{ height: 34, padding: "0 12px", background: "transparent", border: "none", fontSize: 12.5, color: "#9ca3af", cursor: "pointer", fontFamily: "inherit" }}>
              Clear
            </button>
          )}
        </form>

        {/* Summary cards */}
        {!loading && statement && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { label: "Total Invoiced",  value: statement.totalCharged       },
              { label: "Total Paid",      value: statement.totalPayments      },
              { label: "Credits Applied", value: statement.totalCredits       },
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
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>
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
                    width: h.width, padding: "8px 14px",
                    fontSize: 11, fontWeight: 600, color: "#9ca3af",
                    textTransform: "uppercase", letterSpacing: "0.05em",
                    textAlign: h.align as "left" | "right",
                  }}>{h.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>

              {/* Opening balance */}
              {!loading && (
                <tr style={{ borderBottom: "1px solid #f3f4f6", background: "#fafafa" }}>
                  <td style={{ padding: "9px 14px", fontSize: 12.5, color: "#9ca3af" }}>—</td>
                  <td style={{ padding: "9px 14px", fontSize: 12.5, color: "#9ca3af", fontStyle: "italic" }}>Opening Balance</td>
                  <td style={{ padding: "9px 14px", fontSize: 12.5, color: "#9ca3af" }}>—</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: "#9ca3af" }}>—</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", color: "#9ca3af" }}>—</td>
                  <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12.5, fontWeight: 600, color: "#374151" }}>
                    {fmtBalance(statement?.openingBalance ?? 0, currency)}
                  </td>
                </tr>
              )}

              {/* Skeletons */}
              {loading && [1,2,3,4,5].map(i => (
                <tr key={i} style={{ borderBottom: "1px solid #f9fafb" }}>
                  {[1,2,3,4,5,6].map(j => (
                    <td key={j} style={{ padding: "10px 14px" }}><Sk w="80%" /></td>
                  ))}
                </tr>
              ))}

              {/* Empty */}
              {!loading && (!statement || statement.entries.length === 0) && (
                <tr>
                  <td colSpan={6} style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
                    No transactions found.
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {!loading && statement?.entries.map((e, idx) => {
                const isLast    = idx === statement.entries.length - 1;
                const txLabel   = e.subType === "REFUND" ? "Refund" : (TX_LABELS[e.docType] ?? e.docType);
                const isInvoice = e.docType === "INVOICE";
                const isCN      = e.docType === "CREDIT_NOTE";
                const isPayment = e.docType === "PAYMENT";
                const balColor  = e.balance < 0 ? "#0F6E56" : e.balance === 0 ? "#6b7280" : "#374151";

                return (
                  <tr key={`${e.docId}-${idx}`}
                    style={{ borderBottom: isLast ? "none" : "1px solid #f3f4f6" }}
                    onMouseEnter={el => (el.currentTarget.style.background = "#f9fafb")}
                    onMouseLeave={el => (el.currentTarget.style.background = "")}>

                    <td style={{ padding: "9px 14px", fontSize: 12.5, color: "#374151", whiteSpace: "nowrap" }}>
                      {fmtDate(e.createdAt)}
                    </td>

                    <td style={{ padding: "9px 14px", fontSize: 12.5, color: "#374151" }}>
                      {txLabel}
                    </td>

                    <td style={{ padding: "9px 14px" }}>
                      {(isInvoice || isCN) ? (
                        <a href={`/admin/sales/${e.docId}`}
                          style={{ fontSize: 12.5, fontWeight: 600, color: CLR.primary, textDecoration: "none" }}
                          onMouseOver={ev => (ev.currentTarget.style.textDecoration = "underline")}
                          onMouseOut={ev => (ev.currentTarget.style.textDecoration = "none")}>
                          {e.detailMain}
                        </a>
                      ) : (
                        <span style={{ fontSize: 12.5, fontWeight: 600, color: "#374151" }}>{e.detailMain}</span>
                      )}
                      {e.detailSub && (
                        <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2 }}>{e.detailSub}</div>
                      )}
                    </td>

                    {/* Amount */}
                    <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12.5, color: "#374151" }}>
                      {isInvoice && fmt(e.amount, e.currency)}
                      {isCN      && `(${fmt(e.amount, e.currency)})`}
                      {isPayment && <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>

                    {/* Payments */}
                    <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12.5, color: "#374151" }}>
                      {isPayment ? fmt(e.payment, e.currency) : <span style={{ color: "#d1d5db" }}>—</span>}
                    </td>

                    {/* Balance */}
                    <td style={{ padding: "9px 14px", textAlign: "right", fontSize: 12.5, fontWeight: 600, color: balColor }}>
                      {fmtBalance(e.balance, e.currency)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Balance Due footer */}
          {!loading && statement && statement.entries.length > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "2px solid #e5e7eb", background: "#f9fafb", padding: "10px 14px" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#374151", marginRight: 40 }}>Balance Due</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", minWidth: 120, textAlign: "right" }}>
                {fmtBalance(statement.outstandingBalance, currency)}
              </span>
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
