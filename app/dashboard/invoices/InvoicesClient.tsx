"use client";
// app/dashboard/invoices/InvoicesClient.tsx

import Link from "next/link";
import { useState } from "react";
import { colors } from "@/lib/ui/tokens";

interface InvoiceRow {
  id:                   string;
  docNum:               string;
  type:                 string;
  status:               string;
  currency:             string;
  total:                number;
  amountPaid:           number;
  issueDate:            string;
  dueDate:              string | null;
  officialInvoiceUrl:   string | null;
  market:               { key: string; name: string };
  paymentNotifications: number;
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
  INVOICE:     "Invoice",
  CREDIT_NOTE: "Credit Note",
};

const CREDIT_NOTE_FILTER = ["ALL", "UNPAID", "PAID", "OVERDUE"] as const;
type Filter = typeof CREDIT_NOTE_FILTER[number];

export function InvoicesClient({ docs }: { docs: InvoiceRow[] }) {
  const [filter, setFilter] = useState<Filter>("ALL");

  // Credit notes that exist
  const hasCreditNotes = docs.some(d => d.type === "CREDIT_NOTE");

  const filtered = docs.filter(d => {
    if (filter === "UNPAID")  return ["ISSUED", "SENT", "PARTIALLY_PAID"].includes(d.status);
    if (filter === "PAID")    return ["PAID", "APPLIED"].includes(d.status);
    if (filter === "OVERDUE") return d.status === "OVERDUE";
    return true;
  });

  // Count pending submissions across all unpaid invoices
  const pendingCount = docs.filter(d =>
    d.paymentNotifications > 0 &&
    ["ISSUED","SENT","PARTIALLY_PAID","OVERDUE"].includes(d.status)
  ).length;

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

          {/* Pending verification banner */}
          {pendingCount > 0 && (
            <div style={{ marginBottom: 16, padding: "12px 16px", background: "#fffbeb", border: "1px solid #fcd34d", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 15 }}>⏳</span>
              <p style={{ fontSize: 13, color: "#92400e", margin: 0, fontWeight: 500 }}>
                {pendingCount === 1
                  ? "You have 1 invoice with a payment notification awaiting verification."
                  : `You have ${pendingCount} invoices with payment notifications awaiting verification.`}
              </p>
            </div>
          )}

          {/* Filter bar */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {(["ALL", "UNPAID", "PAID", "OVERDUE"] as const).map(f => (
              <button key={f} className={`inv-filter-btn${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
                {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* Invoice list */}
          {filtered.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", background: "#fff", border: "1px solid #e5e7eb" }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>No invoices found</p>
              <p style={{ fontSize: 13, color: "#9ca3af" }}>
                {filter === "ALL" ? "Invoices will appear here once issued by our team." : `No ${filter.toLowerCase()} invoices.`}
              </p>
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>
              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 130px 140px 70px", gap: 0, padding: "8px 20px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
                {["Document", "Date", "Amount", "Status", ""].map((h, i) => (
                  <span key={i} style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</span>
                ))}
              </div>

              {filtered.map((doc, i) => {
                const needsOfficialPdf = doc.market.key === "SAUDI" && doc.type === "INVOICE";
                const hasOfficialPdf   = !!doc.officialInvoiceUrl;
                const canDownload      = needsOfficialPdf ? hasOfficialPdf : true;
                const typeLabel        = needsOfficialPdf
                  ? "Invoice Memo"
                  : (TYPE_LABELS[doc.type] ?? doc.type);
                const balance          = doc.total - doc.amountPaid;
                const isUnpaid         = ["ISSUED","SENT","PARTIALLY_PAID","OVERDUE"].includes(doc.status);
                const hasPending       = doc.paymentNotifications > 0 && isUnpaid;

                return (
                  <Link key={doc.id} href={`/dashboard/sales/${doc.id}`}
                    className="inv-row"
                    style={{ display: "grid", gridTemplateColumns: "1fr 100px 130px 140px 70px", gap: 0, padding: "14px 20px", borderBottom: i < filtered.length - 1 ? "1px solid #f3f4f6" : "none", alignItems: "center", background: "#fff", transition: "background 0.1s", textDecoration: "none", color: "inherit" }}>

                    {/* Doc info */}
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", fontFamily: "monospace", letterSpacing: "-0.01em" }}>
                        {doc.docNum}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, color: "#9ca3af" }}>{typeLabel}</span>
                        {hasPending && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            ⏳ Pending Verification
                          </span>
                        )}
                      </div>
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

                    {/* Action */}
                    <div style={{ textAlign: "right" }}>
                      {canDownload ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: colors.primary }}>View ↗</span>
                      ) : (
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>Processing</span>
                      )}
                    </div>
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
