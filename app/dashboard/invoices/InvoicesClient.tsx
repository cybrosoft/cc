"use client";
// app/dashboard/invoices/InvoicesClient.tsx

import { useEffect, useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/ui/tokens";

interface Invoice {
  id: string; docNum: string; type: string; status: string;
  currency: string; total: number; amountPaid: number; balance: number;
  subject: string | null; issueDate: string; dueDate: string | null;
  paidAt: string | null; createdAt: string;
}

type Tab = "ALL" | "UNPAID" | "OVERDUE" | "PAID" | "CREDIT_NOTE";
const TABS: { key: Tab; label: string }[] = [
  { key: "ALL",         label: "All"          },
  { key: "UNPAID",      label: "Unpaid"       },
  { key: "OVERDUE",     label: "Overdue"      },
  { key: "PAID",        label: "Paid"         },
  { key: "CREDIT_NOTE", label: "Credit Notes" },
];

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function isOverdue(doc: Invoice) {
  if (!doc.dueDate || doc.status === "PAID") return false;
  return new Date(doc.dueDate) < new Date();
}

const SC: Record<string, string> = {
  PAID: "#0F6E56", PARTIALLY_PAID: "#0F6E56",
  ISSUED: "#185FA5", SENT: "#185FA5",
  OVERDUE: "#991b1b", VOID: "#6b7280", APPLIED: "#0F6E56",
};
function Badge({ status, overdue }: { status: string; overdue?: boolean }) {
  const key   = overdue ? "OVERDUE" : status;
  const color = SC[key] ?? "#6b7280";
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      {key.replace(/_/g, " ")}
    </span>
  );
}
function Sk({ w = "100%", h = 13 }: { w?: string | number; h?: number }) {
  return <span className="cy-shimmer" style={{ width: w, height: h, display: "inline-block" }} />;
}

export function InvoicesClient({ currency }: { currency: string }) {
  const [docs,    setDocs]    = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<Tab>("ALL");

  useEffect(() => {
    Promise.all([
      fetch("/api/customer/sales?type=INVOICE&limit=100").then(r => r.json()),
      fetch("/api/customer/sales?type=CREDIT_NOTE&limit=100").then(r => r.json()),
    ]).then(([inv, cr]) => {
      const combined: Invoice[] = [...(inv.documents ?? []), ...(cr.documents ?? [])];
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setDocs(combined);
    }).finally(() => setLoading(false));
  }, []);

  const filtered = docs.filter(d => {
    if (tab === "ALL")         return true;
    if (tab === "CREDIT_NOTE") return d.type === "CREDIT_NOTE";
    if (tab === "PAID")        return d.status === "PAID" || d.status === "PARTIALLY_PAID";
    if (tab === "OVERDUE")     return isOverdue(d) || d.status === "OVERDUE";
    if (tab === "UNPAID")      return d.type === "INVOICE" && d.balance > 0 && d.status !== "PAID" && !isOverdue(d) && d.status !== "OVERDUE";
    return true;
  });

  const counts: Record<Tab, number> = {
    ALL:         docs.length,
    UNPAID:      docs.filter(d => d.type === "INVOICE" && d.balance > 0 && d.status !== "PAID" && !isOverdue(d) && d.status !== "OVERDUE").length,
    OVERDUE:     docs.filter(d => isOverdue(d) || d.status === "OVERDUE").length,
    PAID:        docs.filter(d => d.status === "PAID").length,
    CREDIT_NOTE: docs.filter(d => d.type === "CREDIT_NOTE").length,
  };

  const totalOutstanding = docs.filter(d => d.type === "INVOICE").reduce((s, d) => s + d.balance, 0);
  const totalOverdue     = docs.filter(d => d.type === "INVOICE" && (isOverdue(d) || d.status === "OVERDUE")).reduce((s, d) => s + d.balance, 0);

  return (
    <>
      <style>{`
        @keyframes cy-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .cy-shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%);background-size:800px 100%;animation:cy-shimmer 1.4s ease-in-out infinite;border-radius:4px;}
        .cy-tab{border:none;background:transparent;cursor:pointer;padding:0;}.cy-tab:focus{outline:none;}
        .cy-lrow:hover{background:#f5faf8!important;}
      `}</style>
      <div className="cy-page-content"><div className="cy-dash-wrap">
        <div style={{ marginBottom: 20 }}>
          <h1 className="cy-page-title" style={{ margin: "0 0 3px" }}>Invoices</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Your billing history and payment records.</p>
        </div>
        {/* Summary */}
        {!loading && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "14px 16px" }}>
              <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 4 }}>Total outstanding</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: totalOutstanding > 0 ? "#b45309" : "#111827", letterSpacing: "-0.02em" }}>{fmt(totalOutstanding, currency)}</div>
            </div>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "14px 16px" }}>
              <div style={{ fontSize: 11.5, color: "#6b7280", marginBottom: 4 }}>Overdue</div>
              <div style={{ fontSize: 22, fontWeight: 600, color: totalOverdue > 0 ? "#dc2626" : "#111827", letterSpacing: "-0.02em" }}>{fmt(totalOverdue, currency)}</div>
            </div>
          </div>
        )}
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #e5e7eb", marginBottom: 16 }}>
          {TABS.map(t => (
            <button key={t.key} className="cy-tab" onClick={() => setTab(t.key)}
              style={{ padding: "8px 14px", fontSize: 13, fontWeight: tab === t.key ? 600 : 400, color: tab === t.key ? colors.primary : "#6b7280", borderBottom: tab === t.key ? `2px solid ${colors.primary}` : "2px solid transparent", marginBottom: -1, transition: "color 0.12s" }}>
              {t.label}
              {counts[t.key] > 0 && (
                <span style={{ marginLeft: 6, fontSize: 11, background: tab === t.key ? "#e8f5f0" : "#f3f4f6", color: tab === t.key ? colors.primary : "#6b7280", padding: "1px 6px", borderRadius: 8 }}>
                  {counts[t.key]}
                </span>
              )}
            </button>
          ))}
        </div>
        {/* Table */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ display: "flex", padding: "9px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ flex: 2.5, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Document</span>
            <span style={{ flex: 1.2, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Issued</span>
            <span style={{ flex: 1.2, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Due</span>
            <span style={{ flex: 1.2, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" as const }}>Amount</span>
            <span style={{ flex: 1.2, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" as const }}>Balance</span>
            <span style={{ flex: 1.2, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" as const }}>Status</span>
          </div>
          {loading
            ? [1,2,3,4].map(i => (
                <div key={i} style={{ display: "flex", padding: "12px 16px", borderBottom: "1px solid #f3f4f6", gap: 8 }}>
                  <div style={{ flex: 2.5 }}><Sk w="50%" h={12} /></div>
                  <div style={{ flex: 1.2 }}><Sk w="80%" h={12} /></div>
                  <div style={{ flex: 1.2 }}><Sk w="80%" h={12} /></div>
                  <div style={{ flex: 1.2, textAlign: "right" as const }}><Sk w="60%" h={12} /></div>
                  <div style={{ flex: 1.2, textAlign: "right" as const }}><Sk w="60%" h={12} /></div>
                  <div style={{ flex: 1.2, textAlign: "right" as const }}><Sk w="70%" h={12} /></div>
                </div>
              ))
            : filtered.length === 0
              ? <div style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
                  {tab === "ALL" ? "No invoices yet." : `No ${TABS.find(t => t.key === tab)?.label.toLowerCase()} found.`}
                </div>
              : filtered.map((doc, idx) => {
                  const over   = isOverdue(doc);
                  const isLast = idx === filtered.length - 1;
                  return (
                    <Link key={doc.id} href={`/dashboard/sales/${doc.id}`} className="cy-lrow"
                      style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderBottom: isLast ? "none" : "1px solid #f3f4f6", textDecoration: "none", transition: "background 0.1s" }}>
                      <div style={{ flex: 2.5, minWidth: 0, paddingRight: 10 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", fontFamily: "monospace" }}>{doc.docNum}</div>
                        {doc.subject && <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.subject}</div>}
                      </div>
                      <span style={{ flex: 1.2, fontSize: 12.5, color: "#6b7280" }}>{fmtDate(doc.issueDate)}</span>
                      <span style={{ flex: 1.2, fontSize: 12.5, color: over ? "#dc2626" : "#6b7280", fontWeight: over ? 600 : 400 }}>{fmtDate(doc.dueDate)}</span>
                      <span style={{ flex: 1.2, fontSize: 12.5, fontWeight: 500, color: "#111827", textAlign: "right" as const, paddingRight: 12 }}>{fmt(doc.total, doc.currency)}</span>
                      <span style={{ flex: 1.2, fontSize: 12.5, fontWeight: 600, color: doc.balance > 0 ? "#b45309" : "#0F6E56", textAlign: "right" as const, paddingRight: 12 }}>
                        {doc.type === "INVOICE" ? fmt(doc.balance, doc.currency) : "—"}
                      </span>
                      <div style={{ flex: 1.2, display: "flex", justifyContent: "flex-end" }}>
                        <Badge status={doc.status} overdue={over} />
                      </div>
                    </Link>
                  );
                })
          }
        </div>
      </div></div>
    </>
  );
}
