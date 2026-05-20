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
  createdAt:          string;
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
  CONVERTED:      { bg: "#f5f3ff", color: "#6d28d9", border: "#ddd6fe" },
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
  INVOICE:     "Invoice",
  CREDIT_NOTE: "Credit Note",
};

export function InvoicesClient({ docs }: { docs: InvoiceRow[] }) {
  const [filter, setFilter] = useState<"ALL" | "UNPAID" | "PAID" | "OVERDUE" | "CREDIT_NOTES">("ALL");

  const filtered = docs.filter(d => {
    if (filter === "UNPAID")       return ["ISSUED", "SENT", "PARTIALLY_PAID"].includes(d.status);
    if (filter === "PAID")         return ["PAID", "APPLIED"].includes(d.status);
    if (filter === "OVERDUE")      return d.status === "OVERDUE";
    if (filter === "CREDIT_NOTES") return d.type === "CREDIT_NOTE";
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
            {([
              { key: "ALL",          label: "All"          },
              { key: "UNPAID",       label: "Unpaid"       },
              { key: "PAID",         label: "Paid"         },
              { key: "OVERDUE",      label: "Overdue"      },
              { key: "CREDIT_NOTES", label: "Credit Notes" },
            ] as const).map(f => (
              <button key={f.key} className={`inv-filter-btn${filter === f.key ? " active" : ""}`} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
              No documents found.
            </div>
          ) : (
            <div style={{ border: "1px solid #e5e7eb", background: "#fff" }}>
              {/* Table header */}
              <div style={{ display: "flex", padding: "8px 16px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                <span style={{ flex: 2, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Document</span>
                <span style={{ width: 120, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date</span>
                <span style={{ width: 120, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" }}>Amount</span>
                <span style={{ width: 110, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center" }}>Status</span>
                <span style={{ width: 60 }} />
              </div>

              {filtered.map((d, idx) => {
                const isLast    = idx === filtered.length - 1;
                const typeLabel = TYPE_LABELS[d.type] ?? d.type;
                const isSaudi   = d.market.key === "SAUDI";
                const docLabel  = isSaudi
                  ? (d.type === "INVOICE" ? "Invoice Memo" : d.type === "CREDIT_NOTE" ? "Credit Note Memo" : typeLabel)
                  : typeLabel;

                return (
                  <Link key={d.id} href={`/dashboard/sales/${d.id}?from=invoices`} className="inv-row"
                    style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderBottom: isLast ? "none" : "1px solid #f3f4f6", textDecoration: "none" }}>
                    <div style={{ flex: 2 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", fontFamily: "monospace" }}>{d.docNum}</div>
                      <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 1 }}>{docLabel}</div>
                    </div>
                    <span style={{ width: 120, fontSize: 12.5, color: "#374151" }}>{fmtDate(d.createdAt)}</span>
                    <span style={{ width: 120, fontSize: 12.5, fontWeight: 600, color: "#111827", textAlign: "right" }}>{fmt(d.total, d.currency)}</span>
                    <span style={{ width: 110, textAlign: "center" }}><StatusBadge status={d.status} /></span>
                    <span style={{ width: 60, textAlign: "right", fontSize: 12.5, color: colors.primary, fontWeight: 500 }}>View ↗</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
