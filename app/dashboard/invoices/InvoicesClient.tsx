"use client";
// app/dashboard/invoices/InvoicesClient.tsx

import { useState } from "react";
import Link from "next/link";

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

const colors = { primary: "#318774" };

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: string }) {
  const s =
    status === "PAID" || status === "APPLIED"
      ? { bg: "#f0fdf4", color: "#15803d", border: "#86efac" }
    : status === "OVERDUE"
      ? { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" }
    : status === "PARTIALLY_PAID"
      ? { bg: "#fffbeb", color: "#b45309", border: "#fcd34d" }
    : status === "VOID"
      ? { bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" }
    : { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", background: s.bg, color: s.color, border: `1px solid ${s.border}`, letterSpacing: "0.03em" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const COL = "1fr 110px 120px 100px 80px";

function TableHeader() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: COL, padding: "10px 20px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
      {(["Document", "Date", "Amount", "Status", "PDF"] as const).map((h, i) => (
        <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: i === 4 ? "right" : "left" }}>{h}</span>
      ))}
    </div>
  );
}

function DocRow({ doc, isLast }: { doc: InvoiceRow; isLast: boolean }) {
  const isSaudi          = doc.market.key === "SAUDI";
  const isOfficialType   = ["INVOICE", "CREDIT_NOTE"].includes(doc.type);
  const needsOfficialPdf = isSaudi && isOfficialType;
  const hasOfficialPdf   = !!doc.officialInvoiceUrl;
  const canDownload      = needsOfficialPdf ? hasOfficialPdf : true;
  const typeLabel        = needsOfficialPdf
    ? (doc.type === "INVOICE" ? "Invoice Memo" : "Credit Note Memo")
    : (doc.type === "CREDIT_NOTE" ? "Credit Note" : "Invoice");
  const balance = doc.total - doc.amountPaid;

  return (
    <Link href={`/dashboard/sales/${doc.id}`} className="inv-row"
      style={{ display: "grid", gridTemplateColumns: COL, padding: "14px 20px", borderBottom: isLast ? "none" : "1px solid #f3f4f6", alignItems: "center", textDecoration: "none", color: "inherit" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", fontFamily: "monospace" }}>{doc.docNum}</div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{typeLabel}</div>
      </div>
      <div>
        <div style={{ fontSize: 12, color: "#374151" }}>{fmtDate(doc.issueDate)}</div>
        {doc.dueDate && (
          <div style={{ fontSize: 11, color: doc.status === "OVERDUE" ? "#dc2626" : "#9ca3af", marginTop: 2 }}>
            Due {fmtDate(doc.dueDate)}
          </div>
        )}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{fmt(doc.total, doc.currency)}</div>
        {balance > 0 && balance < doc.total && (
          <div style={{ fontSize: 11, color: "#b45309", marginTop: 2 }}>Balance: {fmt(balance, doc.currency)}</div>
        )}
      </div>
      <div><StatusBadge status={doc.status} /></div>
      <div style={{ textAlign: "right" }}>
        {canDownload ? (
          <span style={{ fontSize: 11, color: colors.primary, fontWeight: 600 }}>↓ PDF</span>
        ) : needsOfficialPdf && !hasOfficialPdf ? (
          <span style={{ fontSize: 11, color: "#b45309" }}>Pending</span>
        ) : null}
      </div>
    </Link>
  );
}

type Filter = "ALL" | "UNPAID" | "PAID" | "OVERDUE" | "CREDIT_NOTES";

export function InvoicesClient({ docs }: { docs: InvoiceRow[] }) {
  const invoices    = docs.filter(d => d.type === "INVOICE");
  const creditNotes = docs.filter(d => d.type === "CREDIT_NOTE");

  const hasCreditNotes = creditNotes.length > 0;

  const [filter, setFilter] = useState<Filter>("ALL");

  const displayedDocs = filter === "CREDIT_NOTES"
    ? creditNotes
    : invoices.filter(d => {
        if (filter === "UNPAID")  return ["ISSUED", "SENT", "PARTIALLY_PAID"].includes(d.status);
        if (filter === "PAID")    return d.status === "PAID";
        if (filter === "OVERDUE") return d.status === "OVERDUE";
        return true;
      });

  const filters: { key: Filter; label: string }[] = [
    { key: "ALL",          label: "All" },
    { key: "UNPAID",       label: "Unpaid" },
    { key: "PAID",         label: "Paid" },
    { key: "OVERDUE",      label: "Overdue" },
    ...(hasCreditNotes ? [{ key: "CREDIT_NOTES" as Filter, label: "Credit Notes" }] : []),
  ];

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
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 4px", letterSpacing: "-0.02em" }}>Invoices &amp; Billing</h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Your invoices and credit notes</p>
          </div>

          {/* Filter bar */}
          <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
            {filters.map(f => (
              <button key={f.key} className={`inv-filter-btn${filter === f.key ? " active" : ""}`} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Table */}
          {displayedDocs.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "48px 24px", textAlign: "center" }}>
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>No documents found</p>
            </div>
          ) : (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <TableHeader />
              {displayedDocs.map((doc, i) => (
                <DocRow key={doc.id} doc={doc} isLast={i === displayedDocs.length - 1} />
              ))}
            </div>
          )}

        </div>
      </div>
    </>
  );
}