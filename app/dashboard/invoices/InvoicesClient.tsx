"use client";
// app/dashboard/invoices/InvoicesClient.tsx

import Link from "next/link";
import { useState } from "react";
import { colors } from "@/lib/ui/tokens";

interface InvoiceRow {
  id:                 string;
  docNum:             string;
  type:               string;
  status:             string;
  currency:           string;
  total:              number;
  amountPaid:         number;
  issueDate:          string;
  dueDate:            string | null;
  officialInvoiceUrl: string | null;
  market:             { key: string; name: string };
}

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  ISSUED:         { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  SENT:           { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  PAID:           { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  PARTIALLY_PAID: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  OVERDUE:        { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  VOID:           { bg: "#f3f4f6", color: "#6b7280", border: "#d1d5db" },
  APPLIED:        { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", background: s.bg, color: s.color, border: `1px solid ${s.border}`, letterSpacing: "0.03em" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const TYPE_LABELS: Record<string, string> = {
  INVOICE:    "Invoice",
  CREDIT_NOTE: "Credit Note",
};

export function InvoicesClient({ docs }: { docs: InvoiceRow[] }) {
  const [filter, setFilter] = useState<"ALL" | "UNPAID" | "PAID" | "OVERDUE">("ALL");

  const filtered = docs.filter(d => {
    if (filter === "UNPAID")  return ["ISSUED", "SENT", "PARTIALLY_PAID"].includes(d.status);
    if (filter === "PAID")    return ["PAID", "APPLIED"].includes(d.status);
    if (filter === "OVERDUE") return d.status === "OVERDUE";
    return true;
  });

  return (
    <>
      <style>{`
        .inv-row:hover { background: #f9fafb !important; }
        .inv-filter-btn { padding: 6px 14px; font-size: 12px; font-weight: 600; border: 1px solid #e5e7eb; cursor: pointer; font-family: inherit; transition: all 0.1s; }
        .inv-filter-btn.active { background: ${colors.primary}; color: #fff; border-color: ${colors.primary}; }
        .inv-filter-btn:not(.active) { background: #fff; color: #6b7280; }
      `}</style>

      <div className="cy-page-content">
        <div className="cy-dash-wrap" style={{ maxWidth: 860 }}>

          {/* Page header */}
          <div style={{ marginBottom: 20 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Invoices</h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Your invoices and credit notes</p>
          </div>

          {/* Filter bar */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {(["ALL", "UNPAID", "PAID", "OVERDUE"] as const).map(f => (
              <button key={f} className={`inv-filter-btn${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
                {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "48px 24px", textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>No invoices found</p>
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 120px 100px 80px", gap: 0, padding: "10px 20px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Document</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Amount</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Status</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>PDF</span>
              </div>

              {filtered.map((doc, i) => {
                const isSaudi          = doc.market.key === "SAUDI";
                const isOfficialType   = ["INVOICE", "CREDIT_NOTE"].includes(doc.type);
                const needsOfficialPdf = isSaudi && isOfficialType;
                const hasOfficialPdf   = !!doc.officialInvoiceUrl;
                const canDownload      = needsOfficialPdf ? hasOfficialPdf : true;
                const typeLabel        = needsOfficialPdf
                  ? (doc.type === "INVOICE" ? "Invoice Memo" : "Credit Note Memo")
                  : (TYPE_LABELS[doc.type] ?? doc.type);
                const balance = doc.total - doc.amountPaid;

                return (
                  <div key={doc.id} className="inv-row"
                    style={{ display: "grid", gridTemplateColumns: "1fr 110px 120px 100px 80px", gap: 0, padding: "14px 20px", borderBottom: i < filtered.length - 1 ? "1px solid #f3f4f6" : "none", alignItems: "center", background: "#fff", transition: "background 0.1s" }}>

                    {/* Doc info */}
                    <div>
                      <Link href={`/dashboard/sales/${doc.id}`}
                        style={{ fontSize: 14, fontWeight: 700, color: "#111827", fontFamily: "monospace", textDecoration: "none", letterSpacing: "-0.01em" }}>
                        {doc.docNum}
                      </Link>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{typeLabel}</div>
                    </div>

                    {/* Date */}
                    <div style={{ fontSize: 13, color: "#6b7280" }}>{fmtDate(doc.issueDate)}</div>

                    {/* Amount */}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{fmt(doc.total, doc.currency)}</div>
                      {balance > 0 && doc.amountPaid > 0 && (
                        <div style={{ fontSize: 11, color: "#b45309", marginTop: 1 }}>Due: {fmt(balance, doc.currency)}</div>
                      )}
                    </div>

                    {/* Status */}
                    <div><StatusBadge status={doc.status} /></div>

                    {/* PDF */}
                    <div style={{ textAlign: "right" }}>
                      {canDownload ? (
                        <Link href={`/dashboard/sales/${doc.id}`}
                          style={{ fontSize: 12, fontWeight: 600, color: colors.primary, textDecoration: "none" }}>
                          View ↗
                        </Link>
                      ) : (
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>Processing</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
