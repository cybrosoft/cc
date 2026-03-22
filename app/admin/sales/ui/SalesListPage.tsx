// app/admin/sales/ui/SalesListPage.tsx
"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageShell, CLR, FiltersBar, Btn } from "@/components/ui/admin-ui";
import {
  CreateDocModal, ConvertModal,
  SalesStatusBadge, DocTypeBadge, fmtAmount,
  type SalesDocRow,
} from "./sales-ui";
import type { SalesDocumentType } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ALL_STATUSES = [
  "DRAFT","ISSUED","SENT","PENDING","IN_REVIEW","QUOTED",
  "ACCEPTED","REJECTED","REVISED","CONVERTED","EXPIRED",
  "PROCESSING","DELIVERED","CANCELLED",
  "PARTIALLY_PAID","PAID","OVERDUE","WRITTEN_OFF",
  "APPLIED","CLOSED","VOID",
];

const ENDPOINT: Record<string, string> = {
  RFQ:           "/api/admin/sales/rfq",
  QUOTATION:     "/api/admin/sales/quotations",
  PO:            "/api/admin/sales/po",
  DELIVERY_NOTE: "/api/admin/sales/delivery-notes",
  PROFORMA:      "/api/admin/sales/proforma",
  INVOICE:       "/api/admin/sales/invoices",
  CREDIT_NOTE:   "/api/admin/sales/returns",
};

const TYPE_LABEL: Record<string, string> = {
  RFQ: "RFQ Received", QUOTATION: "Quotations", PO: "Issued PO",
  DELIVERY_NOTE: "Delivery Notes", PROFORMA: "Proforma Invoices",
  INVOICE: "Invoices", CREDIT_NOTE: "Invoice Returns",
};

const BREADCRUMB: Record<string, string> = {
  RFQ:           "ADMIN / SALES / RFQ",
  QUOTATION:     "ADMIN / SALES / QUOTATIONS",
  PO:            "ADMIN / SALES / ISSUED PO",
  DELIVERY_NOTE: "ADMIN / SALES / DELIVERY NOTES",
  PROFORMA:      "ADMIN / SALES / PROFORMA INVOICES",
  INVOICE:       "ADMIN / SALES / INVOICES",
  CREDIT_NOTE:   "ADMIN / SALES / INVOICE RETURNS",
};


// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface EmailState {
  sending: boolean;
  sentAt:  string | null;
  count:   number;
  error:   string | null;
}

interface Props { docType: SalesDocumentType }

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SalesListPage({ docType }: Props) {
  const router = useRouter();

  const [allDocs,    setAllDocs]    = useState<SalesDocRow[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Filters
  const [q,          setQ]          = useState("");
  const [status,     setStatus]     = useState("");
  const [marketKey,  setMarketKey]  = useState("");

  // Modals / toast
  const [showCreate, setShowCreate] = useState(false);
  const [convertId,  setConvertId]  = useState<string | null>(null);
  const [convertDoc, setConvertDoc] = useState<SalesDocRow | null>(null);
  const [toast,      setToast]      = useState<{ docNum: string; id: string } | null>(null);
  const [emailState, setEmailState] = useState<Record<string, EmailState>>({});

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "1000" });
    try {
      const res  = await fetch(`${ENDPOINT[docType]}?${params}`);
      const data = await res.json();
      const rows: SalesDocRow[] = (data.docs ?? []).map((d: any) => ({
        id:         d.id,
        docNum:     d.docNum,
        type:       d.type,
        status:     d.status,
        currency:   d.currency,
        total:      d.total,
        issueDate:  d.issueDate,
        dueDate:    d.dueDate ?? null,
        emailSentCount: d.emailSentCount ?? 0,
        customer: {
          fullName:       d.customer?.fullName ?? null,
          email:          d.customer?.email ?? "",
          customerNumber: d.customer?.customerNumber ?? null,
        },
        market:    { key: d.market?.key ?? "", name: d.market?.name ?? "" },
        originDoc: d.originDoc ?? null,
      }));
      setAllDocs(rows);
    } catch { /**/ }
    setLoading(false);
  }, [docType]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // Client-side filtering
  const docs = allDocs.filter(d => {
    if (status    && d.status       !== status)    return false;
    if (marketKey && d.market.key   !== marketKey) return false;
    if (q) {
      const ql = q.toLowerCase();
      const match =
        d.docNum.toLowerCase().includes(ql) ||
        (d.customer.fullName ?? "").toLowerCase().includes(ql) ||
        d.customer.email.toLowerCase().includes(ql) ||
        String(d.customer.customerNumber ?? "").includes(ql);
      if (!match) return false;
    }
    return true;
  });

  // ── Email send ──────────────────────────────────────────────────────────────
  async function sendEmail(docId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setEmailState(prev => ({ ...prev, [docId]: { sending: true, sentAt: null, count: prev[docId]?.count ?? 0, error: null } }));
    try {
      const res  = await fetch(`/api/admin/sales/${docId}/send-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "default" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEmailState(prev => ({
        ...prev,
        [docId]: { sending: false, sentAt: data.emailSentAt, count: data.emailSentCount ?? 1, error: null },
      }));
    } catch (err: any) {
      setEmailState(prev => ({ ...prev, [docId]: { sending: false, sentAt: null, count: prev[docId]?.count ?? 0, error: err.message } }));
    }
  }

  function printDoc(docId: string, e: React.MouseEvent) {
    e.stopPropagation();
    window.open(`/admin/sales/${docId}?print=1`, "_blank");
  }

  function openDetail(docId: string) {
    router.push(`/admin/sales/${docId}`);
  }

  function openConvert(docId: string) {
    const d = docs.find(x => x.id === docId);
    if (d) { setConvertId(docId); setConvertDoc(d); }
  }

  const hasFilters = q || status || marketKey;

  return (
    <PageShell
      breadcrumb={BREADCRUMB[docType]}
      title={TYPE_LABEL[docType]}
      ctaLabel={`New ${TYPE_LABEL[docType].replace(/s$/, "")}`}
      ctaOnClick={() => setShowCreate(true)}
    >

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 999,
          background: "#f0fdf4", border: "1px solid #86efac",
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 10,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", fontSize: 13, color: "#15803d",
        }}>
          <span style={{ fontWeight: 600 }}>✓ {toast.docNum} created</span>
          <button onClick={() => sendEmail(toast.id, { stopPropagation: () => {} } as any)}
            disabled={emailState[toast.id]?.sending}
            style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, background: CLR.primary, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            {emailState[toast.id]?.sending ? "Sending…" : "Send Email"}
          </button>
          <button onClick={e => printDoc(toast.id, e)}
            style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, background: "#fff", color: "#15803d", border: "1px solid #86efac", cursor: "pointer", fontFamily: "inherit" }}>
            Download PDF
          </button>
          <button onClick={() => openDetail(toast.id)}
            style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, background: "#fff", color: "#15803d", border: "1px solid #86efac", cursor: "pointer", fontFamily: "inherit" }}>
            Open
          </button>
          <button onClick={() => setToast(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#15803d", padding: "0 4px" }}>✕</button>
        </div>
      )}

      {/* Email error */}
      {toast && emailState[toast.id]?.error && (
        <div style={{ padding: "8px 14px", marginBottom: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 12 }}>
          Email error: {emailState[toast.id].error}
        </div>
      )}

      {/* ── Filters ── */}
      <FiltersBar>
        <input className="cy-input" value={q} onChange={e => setQ(e.target.value)}
          placeholder="Search doc #, customer name, email, ID…" style={{ width: 280 }} />
        <select className="cy-input" value={status} onChange={e => setStatus(e.target.value)} style={{ width: 160 }}>
          <option value="">All Statuses</option>
          {ALL_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <select className="cy-input" value={marketKey} onChange={e => setMarketKey(e.target.value)} style={{ width: 180 }}>
          <option value="">All Markets</option>
          <option value="SAUDI">Saudi Arabia (SAR)</option>
          <option value="GLOBAL">Global (USD)</option>
        </select>
        {hasFilters && (
          <Btn variant="ghost" onClick={() => { setQ(""); setStatus(""); setMarketKey(""); }}>Clear</Btn>
        )}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>
          {loading ? "Loading…" : `${docs.length}${docs.length !== allDocs.length ? ` of ${allDocs.length}` : ""} document${allDocs.length !== 1 ? "s" : ""}`}
        </span>
      </FiltersBar>

      {/* ── Table ── */}
      <SalesDocTableWithActions
        docs={docs}
        loading={loading}
        emailState={emailState}
        onOpen={openDetail}
        onConvert={openConvert}
        onSendEmail={sendEmail}
        onPrint={printDoc}
      />



      {/* ── Modals ── */}
      {showCreate && (
        <CreateDocModal
          docType={docType}
          onClose={() => setShowCreate(false)}
          onCreated={(docNum?: string, docId?: string) => {
            setShowCreate(false);
            fetchDocs();
            if (docNum && docId) setToast({ docNum, id: docId });
          }}
        />
      )}

      {convertId && convertDoc && (
        <ConvertModal
          docId={convertId}
          docNum={convertDoc.docNum}
          docType={convertDoc.type}
          onClose={() => { setConvertId(null); setConvertDoc(null); }}
          onConverted={newId => {
            setConvertId(null); setConvertDoc(null);
            fetchDocs();
            router.push(`/admin/sales/${newId}`);
          }}
        />
      )}
    </PageShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Table with per-row email + PDF buttons
// ─────────────────────────────────────────────────────────────────────────────

function SalesDocTableWithActions({ docs, loading, emailState, onOpen, onConvert, onSendEmail, onPrint }: {
  docs:        SalesDocRow[];
  loading:     boolean;
  emailState:  Record<string, EmailState>;
  onOpen:      (id: string) => void;
  onConvert?:  (id: string) => void;
  onSendEmail: (id: string, e: React.MouseEvent) => void;
  onPrint:     (id: string, e: React.MouseEvent) => void;
}) {
  if (loading) return (
    <div style={{ padding: "48px 24px", textAlign: "center", color: CLR.faint, fontSize: 13 }}>Loading…</div>
  );
  if (!docs.length) return (
    <div style={{ padding: "64px 24px", textAlign: "center", border: "1px solid #e5e7eb", background: "#fff" }}>
      <p style={{ fontSize: 14, color: CLR.muted, fontWeight: 500 }}>No documents found</p>
      <p style={{ fontSize: 12, color: CLR.faint, marginTop: 4 }}>Documents will appear here once created.</p>
    </div>
  );

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", background: "#fff", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
            {["Doc #", "Customer", "Market", "Status", "Total", "Date", "Due", ""].map(h => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "left" as const, fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.map(d => {
            const es        = emailState[d.id];
            const hasSent   = ((d as any).emailSentCount ?? 0) > 0 || (es?.count ?? 0) > 0;
            const isSending = es?.sending ?? false;

            return (
              <tr key={d.id}
                style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                onClick={() => onOpen(d.id)}
                onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}>

                {/* Doc # */}
                <td style={{ padding: "11px 14px" }}>
                  <span style={{ fontWeight: 600, color: CLR.primary, fontFamily: "monospace" }}>{d.docNum}</span>
                </td>

                {/* Customer — name + email - #id */}
                <td style={{ padding: "11px 14px" }}>
                  <div style={{ fontWeight: 500 }}>{d.customer.fullName ?? d.customer.email}</div>
                  <div style={{ fontSize: 11, color: CLR.faint }}>
                    {d.customer.fullName ? d.customer.email : ""}
                    {d.customer.fullName && d.customer.customerNumber ? " · " : ""}
                    {d.customer.customerNumber ? `#${d.customer.customerNumber}` : ""}
                  </div>
                </td>

                {/* Market */}
                <td style={{ padding: "11px 14px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", background: "#f3f4f6", border: "1px solid #e5e7eb", color: CLR.muted }}>{d.market.key}</span>
                </td>

                {/* Status */}
                <td style={{ padding: "11px 14px" }}>
                  <SalesStatusBadge status={d.status} />
                </td>

                {/* Total */}
                <td style={{ padding: "11px 14px", fontWeight: 600 }}>
                  {fmtAmount(d.total, d.currency)}
                </td>

                {/* Issue date */}
                <td style={{ padding: "11px 14px", color: CLR.muted }}>{fmtDate(d.issueDate)}</td>

                {/* Due date */}
                <td style={{ padding: "11px 14px", color: CLR.faint }}>
                  {d.dueDate ? fmtDate(d.dueDate) : "—"}
                </td>

                {/* Actions */}
                <td style={{ padding: "11px 14px" }}>
                  <div style={{ display: "flex", gap: 5, flexWrap: "nowrap" as const }} onClick={e => e.stopPropagation()}>
                    <button
                      onClick={e => onSendEmail(d.id, e)}
                      disabled={isSending}
                      title={hasSent ? `Sent ${(d as any).emailSentCount ?? 1} time(s)` : "Send to customer"}
                      style={{
                        display: "flex", alignItems: "center", gap: 4,
                        padding: "4px 10px", fontSize: 11, fontWeight: 600,
                        background: hasSent ? "#fffbeb" : CLR.primaryBg,
                        color: hasSent ? "#92400e" : CLR.primary,
                        border: `1px solid ${hasSent ? "#fcd34d" : CLR.primary + "44"}`,
                        cursor: isSending ? "not-allowed" : "pointer",
                        fontFamily: "inherit", whiteSpace: "nowrap" as const,
                      }}>
                      {isSending ? "…" : hasSent ? "Resend" : "Send"}
                    </button>
                    <button
                      onClick={e => onPrint(d.id, e)}
                      style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, background: "#fff", color: CLR.muted, border: "1px solid #e5e7eb", cursor: "pointer", fontFamily: "inherit" }}>
                      PDF
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}