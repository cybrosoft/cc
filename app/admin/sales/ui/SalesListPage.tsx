// app/admin/sales/ui/SalesListPage.tsx
"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PageShell, CLR } from "@/components/ui/admin-ui";
import { Icon } from "@/components/ui/Icon";
import {
  SalesDocTable, SalesFilters, CreateDocModal, ConvertModal,
  type SalesDocRow,
} from "./sales-ui";
import type { SalesDocumentType } from "@prisma/client";

const ALL_STATUSES = [
  "DRAFT","ISSUED","SENT","ACCEPTED","REJECTED","CONVERTED","PAID","PARTIAL","OVERDUE","VOID"
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

const DETAIL_BASE: Record<string, string> = {
  RFQ:           "/admin/sales/rfq",
  QUOTATION:     "/admin/sales/quotations",
  PO:            "/admin/sales/po",
  DELIVERY_NOTE: "/admin/sales/delivery-notes",
  PROFORMA:      "/admin/sales/proforma",
  INVOICE:       "/admin/sales/invoices",
  CREDIT_NOTE:   "/admin/sales/returns",
};

const TYPE_LABEL: Record<string, string> = {
  RFQ: "RFQ Received", QUOTATION: "Quotations", PO: "Issued PO",
  DELIVERY_NOTE: "Delivery Notes", PROFORMA: "Proforma Invoices",
  INVOICE: "Invoices", CREDIT_NOTE: "Invoice Returns",
};

const BREADCRUMB: Record<string, string> = {
  RFQ: "ADMIN / SALES / RFQ",
  QUOTATION: "ADMIN / SALES / QUOTATIONS",
  PO: "ADMIN / SALES / ISSUED PO",
  DELIVERY_NOTE: "ADMIN / SALES / DELIVERY NOTES",
  PROFORMA: "ADMIN / SALES / PROFORMA INVOICES",
  INVOICE: "ADMIN / SALES / INVOICES",
  CREDIT_NOTE: "ADMIN / SALES / INVOICE RETURNS",
};

// ── Email sent state per doc ──────────────────────────────────────────────────
interface EmailState {
  sending: boolean;
  sentAt:  string | null;
  count:   number;
  error:   string | null;
}

interface Props { docType: SalesDocumentType }

export default function SalesListPage({ docType }: Props) {
  const router = useRouter();

  const [docs, setDocs]               = useState<SalesDocRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [q, setQ]                     = useState("");
  const [status, setStatus]           = useState("");
  const [marketKey, setMarketKey]     = useState("");
  const [showCreate, setShowCreate]   = useState(false);
  const [convertId, setConvertId]     = useState<string | null>(null);
  const [convertDoc, setConvertDoc]   = useState<SalesDocRow | null>(null);
  const [toast, setToast]             = useState<{ docNum: string; id: string } | null>(null);
  const [emailState, setEmailState]   = useState<Record<string, EmailState>>({});

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q)      params.set("q", q);
    if (status) params.set("status", status);
    try {
      const res  = await fetch(`${ENDPOINT[docType]}?${params}`);
      const data = await res.json();
      let rows: SalesDocRow[] = data.docs ?? [];
      if (marketKey) rows = rows.filter(d => d.market.key === marketKey);
      setDocs(rows);
    } catch { /**/ }
    setLoading(false);
  }, [docType, q, status, marketKey]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // Auto-dismiss toast after 6 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  function openConvert(id: string) {
    const doc = docs.find(d => d.id === id) ?? null;
    setConvertDoc(doc);
    setConvertId(id);
  }

  async function sendEmail(docId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setEmailState(prev => ({ ...prev, [docId]: { sending: true, sentAt: null, count: 0, error: null } }));
    try {
      const res  = await fetch(`/api/admin/sales/${docId}/send-email`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEmailState(prev => ({
        ...prev,
        [docId]: {
          sending: false,
          sentAt:  data.doc.emailSentAt,
          count:   data.doc.emailSentCount ?? 1,
          error:   null,
        },
      }));
      // Refresh the row status (may have changed to SENT)
      fetchDocs();
    } catch (err: any) {
      setEmailState(prev => ({ ...prev, [docId]: { sending: false, sentAt: null, count: 0, error: err.message } }));
    }
  }

  function printDoc(docId: string, e: React.MouseEvent) {
    e.stopPropagation();
    // Open detail page in new tab then trigger print
    const win = window.open(`/admin/sales/${docId}?print=1`, "_blank");
    if (win) {
      win.onload = () => win.print();
    }
  }

  return (
    <PageShell
      breadcrumb={BREADCRUMB[docType]}
      title={TYPE_LABEL[docType]}
      ctaLabel={`New ${TYPE_LABEL[docType].replace(/s$/, "")}`}
      ctaOnClick={() => setShowCreate(true)}
    >
      {/* Success toast */}
      {toast && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", marginBottom: 14,
          background: "#f0fdf4", border: "1px solid #86efac",
          color: "#15803d", fontSize: 13, fontWeight: 600,
        }}>
          <span>
            Document <span style={{ fontFamily: "monospace" }}>{toast.docNum}</span> created successfully
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={e => sendEmail(toast.id, e)}
              disabled={emailState[toast.id]?.sending}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", fontSize: 12, fontWeight: 600,
                background: "#15803d", color: "#fff", border: "none",
                cursor: "pointer", fontFamily: "inherit",
              }}>
              <Icon name="mail" size={13} color="#fff" />
              {emailState[toast.id]?.sending ? "Sending…" : "Send Email"}
            </button>
            <button
              onClick={e => printDoc(toast.id, e)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", fontSize: 12, fontWeight: 600,
                background: "#fff", color: "#15803d",
                border: "1px solid #86efac",
                cursor: "pointer", fontFamily: "inherit",
              }}>
              <Icon name="fileText" size={13} color="#15803d" />
              Download PDF
            </button>
            <button onClick={() => router.push(`/admin/sales/${toast.id}`)}
              style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, background: "#fff", color: "#15803d", border: "1px solid #86efac", cursor: "pointer", fontFamily: "inherit" }}>
              Open
            </button>
            <button onClick={() => setToast(null)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#15803d", padding: "0 4px" }}>✕</button>
          </div>
        </div>
      )}

      {/* Email error from toast */}
      {toast && emailState[toast.id]?.error && (
        <div style={{ padding: "8px 14px", marginBottom: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 12 }}>
          Email error: {emailState[toast.id].error}
        </div>
      )}

      <SalesFilters
        q={q} setQ={setQ}
        status={status} setStatus={setStatus}
        marketKey={marketKey} setMarketKey={setMarketKey}
        statuses={ALL_STATUSES}
      />

      {/* Table with action buttons */}
      <SalesDocTableWithActions
        docs={docs}
        loading={loading}
        emailState={emailState}
        onOpen={id => router.push(`/admin/sales/${id}`)}
        onConvert={openConvert}
        onSendEmail={sendEmail}
        onPrint={printDoc}
      />

      {!loading && (
        <div style={{ marginTop: 10, fontSize: 12, color: CLR.faint }}>
          {docs.length} document{docs.length !== 1 ? "s" : ""}
        </div>
      )}

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

// ── Table with email + print buttons per row ──────────────────────────────────

function SalesDocTableWithActions({ docs, loading, emailState, onOpen, onConvert, onSendEmail, onPrint }: {
  docs: SalesDocRow[];
  loading: boolean;
  emailState: Record<string, EmailState>;
  onOpen: (id: string) => void;
  onConvert?: (id: string) => void;
  onSendEmail: (id: string, e: React.MouseEvent) => void;
  onPrint: (id: string, e: React.MouseEvent) => void;
}) {
  if (loading) return <div style={{ padding: "48px 24px", textAlign: "center", color: CLR.faint, fontSize: 13 }}>Loading…</div>;
  if (!docs.length) return (
    <div style={{ padding: "64px 24px", textAlign: "center", border: "1px solid #e5e7eb", background: "#fff" }}>
      <p style={{ fontSize: 14, color: CLR.muted, fontWeight: 500 }}>No documents found</p>
      <p style={{ fontSize: 12, color: CLR.faint, marginTop: 4 }}>Documents will appear here once created.</p>
    </div>
  );

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  }
  function fmtAmount(cents: number, currency: string) {
    const v = (cents / 100).toFixed(2);
    return currency === "SAR" ? `SAR ${v}` : `$${v}`;
  }

  return (
    <div style={{ border: "1px solid #e5e7eb", background: "#fff", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
            {["Doc #","Customer","Market","Status","Total","Date","Due","Actions"].map(h => (
              <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {docs.map(d => {
            const es         = emailState[d.id];
            const hasSent    = (d as any).emailSentCount > 0 || (es?.count ?? 0) > 0;
            const isSending  = es?.sending ?? false;
            const emailError = es?.error ?? null;

            return (
              <tr key={d.id}
                style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                onClick={() => onOpen(d.id)}
                onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}>

                <td style={{ padding: "11px 14px" }}>
                  <span style={{ fontWeight: 600, color: CLR.primary, fontFamily: "monospace" }}>{d.docNum}</span>
                </td>
                <td style={{ padding: "11px 14px" }}>
                  <div style={{ fontWeight: 500 }}>{d.customer.fullName ?? d.customer.email}</div>
                  <div style={{ fontSize: 11, color: CLR.faint }}>{d.customer.customerNumber}</div>
                </td>
                <td style={{ padding: "11px 14px" }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", background: "#f3f4f6", border: "1px solid #e5e7eb", color: CLR.muted }}>{d.market.key}</span>
                </td>
                <td style={{ padding: "11px 14px" }}>
                  <div style={{
                    display: "inline-flex", alignItems: "center", fontSize: 11, fontWeight: 600,
                    padding: "2px 8px",
                    background: d.status === "DRAFT" ? "#f9fafb" : d.status === "SENT" ? "#f5f3ff" : d.status === "PAID" ? "#dcfce7" : "#eff6ff",
                    color: d.status === "DRAFT" ? "#374151" : d.status === "SENT" ? "#7c3aed" : d.status === "PAID" ? "#15803d" : "#1d4ed8",
                    border: `1px solid ${d.status === "DRAFT" ? "#e5e7eb" : d.status === "SENT" ? "#ddd6fe" : d.status === "PAID" ? "#86efac" : "#bfdbfe"}`,
                  }}>
                    {d.status}
                  </div>
                </td>
                <td style={{ padding: "11px 14px", fontWeight: 600 }}>{fmtAmount(d.total, d.currency)}</td>
                <td style={{ padding: "11px 14px", color: CLR.muted }}>{fmtDate(d.issueDate)}</td>
                <td style={{ padding: "11px 14px", color: d.dueDate ? CLR.muted : CLR.faint }}>
                  {d.dueDate ? fmtDate(d.dueDate) : "—"}
                </td>
                <td style={{ padding: "11px 14px" }}>
                  <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }} onClick={e => e.stopPropagation()}>

                    {/* Send / Resend email */}
                    <button
                      onClick={e => onSendEmail(d.id, e)}
                      disabled={isSending}
                      title={hasSent ? `Sent ${(d as any).emailSentCount ?? 1} time(s)` : "Send to customer"}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "5px 10px", fontSize: 11, fontWeight: 600,
                        background: hasSent ? "#fffbeb" : CLR.primaryBg,
                        color: hasSent ? "#92400e" : CLR.primary,
                        border: `1px solid ${hasSent ? "#fcd34d" : CLR.primary + "44"}`,
                        cursor: isSending ? "not-allowed" : "pointer",
                        fontFamily: "inherit", whiteSpace: "nowrap",
                      }}>
                      <Icon name="mail" size={11} color={hasSent ? "#92400e" : CLR.primary} />
                      {isSending ? "…" : hasSent ? "Resend" : "Send Email"}
                    </button>

                    {/* PDF */}
                    <button
                      onClick={e => onPrint(d.id, e)}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "5px 10px", fontSize: 11, fontWeight: 600,
                        background: "#fff", color: CLR.muted,
                        border: "1px solid #e5e7eb",
                        cursor: "pointer", fontFamily: "inherit",
                      }}>
                      <Icon name="fileText" size={11} color={CLR.muted} />
                      PDF
                    </button>

                    {/* Convert */}
                    {onConvert && d.status !== "VOID" && (
                      <button onClick={e => { e.stopPropagation(); onConvert(d.id); }}
                        style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, background: "#fff", color: CLR.muted, border: "1px solid #e5e7eb", cursor: "pointer", fontFamily: "inherit" }}>
                        Convert
                      </button>
                    )}
                  </div>

                  {/* Inline email error */}
                  {emailError && (
                    <div style={{ fontSize: 10, color: "#dc2626", marginTop: 4, maxWidth: 200 }}>{emailError}</div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
