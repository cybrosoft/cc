// app/admin/sales/ui/SalesListPage.tsx
"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { CLR } from "@/components/ui/admin-ui";
import {
  CreateDocModal, ConvertModal, StatusChangeModal, SendEmailModal,
  SalesStatusBadge, fmtAmount,
  type SalesDocRow,
} from "./sales-ui";
import { VALID_STATUSES } from "@/lib/sales/document-helpers";
import type { SalesDocumentType } from "@prisma/client";

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
  RFQ: "Leads", QUOTATION: "Quotations", PO: "Issued PO",
  DELIVERY_NOTE: "Delivery Notes", PROFORMA: "Proforma Invoices",
  INVOICE: "Invoices", CREDIT_NOTE: "Invoice Returns",
};

const BREADCRUMB: Record<string, string> = {
  RFQ:           "ADMIN / CRM / LEADS",
  QUOTATION:     "ADMIN / SALES / QUOTATIONS",
  PO:            "ADMIN / SALES / ISSUED PO",
  DELIVERY_NOTE: "ADMIN / SALES / DELIVERY NOTES",
  PROFORMA:      "ADMIN / SALES / PROFORMA INVOICES",
  INVOICE:       "ADMIN / SALES / INVOICES",
  CREDIT_NOTE:   "ADMIN / SALES / INVOICE RETURNS",
};

const DETAIL_HREF: Record<string, string> = {
  RFQ:           "/admin/crm/leads",
  QUOTATION:     "/admin/sales/quotations",
  PO:            "/admin/sales/po",
  DELIVERY_NOTE: "/admin/sales/delivery-notes",
  PROFORMA:      "/admin/sales/proforma",
  INVOICE:       "/admin/sales/invoices",
  CREDIT_NOTE:   "/admin/sales/returns",
};

interface EmailState { sending: boolean; sentAt: string | null; count: number; error: string | null; }
interface Props { docType: SalesDocumentType }

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function SalesListPage({ docType }: Props) {
  const router = useRouter();

  const [allDocs,    setAllDocs]    = useState<SalesDocRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [iframeSrc,  setIframeSrc]  = useState<string>("");

  // Filters
  const [q,         setQ]         = useState("");
  const [status,    setStatus]    = useState("");
  const [marketKey, setMarketKey] = useState("");

  // Modals / toast
  const [showCreate,    setShowCreate]    = useState(false);
  const [convertId,     setConvertId]     = useState<string | null>(null);
  const [convertDoc,    setConvertDoc]    = useState<SalesDocRow | null>(null);
  const [toast,         setToast]         = useState<{ docNum: string; id: string } | null>(null);
  const [emailState,    setEmailState]    = useState<Record<string, EmailState>>({});
  const [showStatus,    setShowStatus]    = useState(false);
  const [sendDropOpen,  setSendDropOpen]  = useState(false);
  const [sendModalMode, setSendModalMode] = useState<"reminder" | "custom" | null>(null);
  const [showPayment,   setShowPayment]   = useState(false);
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const sendDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (sendDropRef.current && !sendDropRef.current.contains(e.target as Node)) setSendDropOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Responsive
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 1024); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ pageSize: "1000" });
    try {
      const res  = await fetch(`${ENDPOINT[docType]}?${params}`);
      const data = await res.json();
      const rows: SalesDocRow[] = (data.docs ?? []).map((d: any) => ({
        id:                 d.id,
        docNum:             d.docNum,
        type:               d.type,
        status:             d.status,
        currency:           d.currency,
        total:              d.total,
        issueDate:          d.issueDate,
        dueDate:            d.dueDate ?? null,
        createdAt:          d.createdAt ?? d.issueDate,
        emailSentCount:     d.emailSentCount ?? 0,
        officialInvoiceUrl: d.officialInvoiceUrl ?? null,
        customer: {
          fullName:       d.customer?.fullName ?? null,
          companyName:    d.customer?.companyName ?? null,
          email:          d.customer?.email ?? "",
          customerNumber: d.customer?.customerNumber ?? null,
        },
        market:    { key: d.market?.key ?? "", name: d.market?.name ?? "" },
        originDoc: d.originDoc ?? null,
      }));
      setAllDocs(rows);
    } catch { /* silent */ }
    setLoading(false);
  }, [docType]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  // Debounced filter
  const [filtered, setFiltered] = useState<SalesDocRow[]>([]);
  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => {
      const qLow = q.toLowerCase();
      setFiltered(allDocs.filter(d => {
        if (status    && d.status !== status)       return false;
        if (marketKey && d.market.key !== marketKey) return false;
        if (q) {
          const hay = [d.docNum, d.customer.email, d.customer.fullName ?? "", d.customer.companyName ?? ""].join(" ").toLowerCase();
          if (!hay.includes(qLow)) return false;
        }
        return true;
      }));
    }, 120);
  }, [allDocs, q, status, marketKey]);

  const selected = allDocs.find(d => d.id === selectedId) ?? null;

  // Saudi official invoice logic for selected doc
  const selectedIsSaudi        = selected?.market.key === "SAUDI";
  const selectedIsOfficialType = ["INVOICE", "CREDIT_NOTE"].includes(selected?.type ?? "");
  const selectedNeedsOfficial  = selectedIsSaudi && selectedIsOfficialType;
  const selectedHasOfficial    = !!((selected as any)?.officialInvoiceUrl);
  const sendBlocked            = selectedNeedsOfficial && !selectedHasOfficial;
  const downloadLabel          = selectedNeedsOfficial ? "ZATCA e-Invoice Download" : "Download PDF";

  async function downloadPdf(docId: string, docNum: string) {
    setPdfDownloading(true);
    try {
      const res = await fetch(`/api/admin/sales/${docId}/pdf`);
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href; a.download = `${docNum}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(href);
    } catch { alert("PDF download failed"); }
    setPdfDownloading(false);
  }

  async function sendEmailDirect(docId: string, mode: "default" | "resend" = "default") {
    setSendDropOpen(false);
    setEmailState(prev => ({ ...prev, [docId]: { sending: true, sentAt: null, count: prev[docId]?.count ?? 0, error: null } }));
    try {
      const res  = await fetch(`/api/admin/sales/${docId}/send-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEmailState(prev => ({ ...prev, [docId]: { sending: false, sentAt: data.emailSentAt, count: data.emailSentCount ?? 1, error: null } }));
      fetchDocs();
    } catch (err: any) {
      setEmailState(prev => ({ ...prev, [docId]: { sending: false, sentAt: null, count: prev[docId]?.count ?? 0, error: err.message } }));
    }
  }

  async function markAsSent(docId: string) {
    setSendDropOpen(false);
    setEmailState(prev => ({ ...prev, [docId]: { sending: true, sentAt: null, count: prev[docId]?.count ?? 0, error: null } }));
    try {
      const res  = await fetch(`/api/admin/sales/${docId}/send-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "mark_as_sent" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEmailState(prev => ({ ...prev, [docId]: { sending: false, sentAt: data.emailSentAt, count: data.emailSentCount ?? 1, error: null } }));
      fetchDocs();
    } catch (err: any) {
      setEmailState(prev => ({ ...prev, [docId]: { sending: false, sentAt: null, count: prev[docId]?.count ?? 0, error: err.message } }));
    }
  }

  function sendEmail(docId: string, e: React.MouseEvent) {
    e.stopPropagation();
    sendEmailDirect(docId);
  }

  function printDoc(docId: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    window.open(`/admin/sales/${docId}?print=1`, "_blank");
  }

  const label      = TYPE_LABEL[docType]  ?? docType;
  const crumb      = BREADCRUMB[docType]  ?? `ADMIN / SALES / ${docType}`;
  const detailBase = DETAIL_HREF[docType] ?? "/admin/sales";

  function openDetail(id: string) {
    if (isMobile) {
      router.push(`${detailBase}/${id}`);
    } else {
      setSelectedId(id);
    }
  }

  // Update iframe src when selected changes
  useEffect(() => {
    if (!selectedId) { setIframeSrc(""); return; }
    setIframeSrc(`/admin/sales/${selectedId}?embed=1`);
  }, [selectedId]);

  const hasSentSelected = (emailState[selected?.id ?? ""]?.count ?? 0) > 0 ||
    (selected?.emailSentCount ?? 0) > 0;

  const statuses = VALID_STATUSES[docType] ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#f5f5f5" }}>

      {/* Header */}
      <div style={{ padding: "12px 20px 10px", borderBottom: "1px solid #e5e7eb", background: "#fff", flexShrink: 0 }}>
        <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 3 }}>{crumb}</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "#111827", margin: 0 }}>{label}</h1>
          {docType !== "CREDIT_NOTE" && (
            <button onClick={() => setShowCreate(true)}
              style={{ padding: "7px 16px", fontSize: 12, fontWeight: 600, background: CLR.primary, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
              + New {docType === "RFQ" ? "Lead" : label.replace(/s$/, "")}
            </button>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ padding: "8px 20px", background: "#f0fdf4", borderBottom: "1px solid #86efac", fontSize: 12, color: "#15803d", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontWeight: 600 }}>✓ {toast.docNum} created</span>
          <button onClick={e => sendEmail(toast.id, e)} disabled={emailState[toast.id]?.sending}
            style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, background: CLR.primary, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            {emailState[toast.id]?.sending ? "Sending…" : "Send Email"}
          </button>
          <button onClick={() => setToast(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#6b7280", fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Main layout */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* List panel */}
        <div style={{ width: isMobile ? "100%" : 380, flexShrink: 0, display: "flex", flexDirection: "column", borderRight: "1px solid #e5e7eb", overflow: "hidden" }}>

          {/* Filters */}
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #e5e7eb", background: "#fff", flexShrink: 0 }}>
            <input value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search doc # or customer…"
              style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none", boxSizing: "border-box", marginBottom: 6 }} />
            <div style={{ display: "flex", gap: 6 }}>
              <select value={status} onChange={e => setStatus(e.target.value)}
                style={{ flex: 1, padding: "6px 8px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "inherit", background: "#fff" }}>
                <option value="">All Statuses</option>
                {statuses.map(s => <option key={s}>{s}</option>)}
              </select>
              <select value={marketKey} onChange={e => setMarketKey(e.target.value)}
                style={{ flex: 1, padding: "6px 8px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "inherit", background: "#fff" }}>
                <option value="">All Markets</option>
                <option value="SAUDI">Saudi (SAR)</option>
                <option value="GLOBAL">Global (USD)</option>
              </select>
            </div>
          </div>

          {/* Doc list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ padding: "12px 14px", borderBottom: "1px solid #f3f4f6", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ height: 12, width: "60%", background: "#f0f0f0", borderRadius: 3 }} />
                  <div style={{ height: 10, width: "40%", background: "#f5f5f5", borderRadius: 3 }} />
                </div>
              ))
            ) : filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", fontSize: 13, color: CLR.faint }}>
                No {label.toLowerCase()} found
              </div>
            ) : (
              filtered.map(doc => {
                const isSelected = doc.id === selectedId;
                const es = emailState[doc.id];
                const sentCount = es?.count ?? doc.emailSentCount ?? 0;
                return (
                  <div key={doc.id}
                    onClick={() => openDetail(doc.id)}
                    style={{
                      padding: "11px 14px", borderBottom: "1px solid #f3f4f6", cursor: "pointer",
                      background: isSelected ? CLR.primaryBg : "#fff",
                      borderLeft: isSelected ? `3px solid ${CLR.primary}` : "3px solid transparent",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: "#111827" }}>{doc.docNum}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        {sentCount > 0 && (
                          <span title={`Sent ${sentCount}×`} style={{ fontSize: 10, color: CLR.primary, fontWeight: 700 }}>✉ {sentCount}</span>
                        )}
                        <SalesStatusBadge status={doc.status} />
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {doc.customer.companyName ?? doc.customer.fullName ?? doc.customer.email}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 11, color: CLR.faint }}>{fmtDate(doc.issueDate)}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{fmtAmount(doc.total, doc.currency)}</span>
                    </div>
                    {es?.error && <div style={{ fontSize: 10, color: "#dc2626", marginTop: 3 }}>✗ {es.error}</div>}
                  </div>
                );
              })
            )}
          </div>

          {/* List footer */}
          <div style={{ padding: "6px 14px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 11, color: CLR.faint, flexShrink: 0 }}>
            {loading ? "Loading…" : `${filtered.length} of ${allDocs.length} ${label.toLowerCase()}`}
          </div>
        </div>

        {/* Detail / preview panel (desktop only) */}
        {!isMobile && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {!selected ? (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: CLR.faint, fontSize: 13 }}>
                Select a document to preview
              </div>
            ) : (
              <>
                {/* Toolbar */}
                <div style={{ padding: "8px 14px", background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 6, flexShrink: 0, flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: "#111827" }}>{selected.docNum}</span>
                  <SalesStatusBadge status={selected.status} />
                  <span style={{ fontSize: 11, color: CLR.muted, marginLeft: 2 }}>{selected.customer.companyName ?? selected.customer.fullName ?? selected.customer.email}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: CLR.primary }}>{fmtAmount(selected.total, selected.currency)}</span>
                  <div style={{ flex: 1 }} />

                  {/* Edit */}
                  <button onClick={() => router.push(`${detailBase}/${selected.id}`)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: "#fff", color: CLR.text, border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    Edit
                  </button>

                  {/* Convert */}
                  {selected.status !== "VOID" && selected.status !== "CONVERTED" && (
                    <button onClick={() => { setConvertId(selected.id); setConvertDoc(selected); }}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: "#fffbeb", color: "#b45309", border: "1px solid #fcd34d", cursor: "pointer", fontFamily: "inherit" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
                      Convert
                    </button>
                  )}

                  {/* Status */}
                  <button
                    onClick={() => { if (sendBlocked) { alert("Upload the official invoice before changing status"); return; } setShowStatus(true); }}
                    title={sendBlocked ? "Upload official invoice first" : undefined}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: "#fff", color: sendBlocked ? "#9ca3af" : CLR.text, border: `1px solid ${sendBlocked ? "#e5e7eb" : "#d1d5db"}`, cursor: sendBlocked ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    Status
                  </button>

                  {/* Send */}
                  <div ref={sendDropRef} style={{ position: "relative" }}>
                    <button
                      onClick={() => { if (sendBlocked) return; setSendDropOpen(v => !v); }}
                      title={sendBlocked ? "Upload official invoice before sending" : undefined}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: sendBlocked ? "#f3f4f6" : CLR.primary, color: sendBlocked ? "#9ca3af" : "#fff", border: sendBlocked ? "1px solid #e5e7eb" : "none", cursor: sendBlocked ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      Send
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {sendDropOpen && (
                      <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", zIndex: 50, minWidth: 200 }}>
                        <DropdownItem icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>} label="Send Now" hint="Default email template" onClick={() => sendEmailDirect(selected.id)} />
                        <div style={{ height: 1, background: "#f3f4f6" }} />
                        <DropdownItem icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>} label="Custom Send" hint="Edit subject, body, CC/BCC" onClick={() => { setSendDropOpen(false); setSendModalMode("custom"); }} />
                        {!hasSentSelected && (
                          <><div style={{ height: 1, background: "#f3f4f6" }} />
                          <DropdownItem icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>} label="Mark as Sent" hint="Record without emailing" onClick={() => markAsSent(selected.id)} /></>
                        )}
                        {hasSentSelected && (
                          <><div style={{ height: 1, background: "#f3f4f6" }} />
                          <DropdownItem icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>} label="Resend" hint="Send again with same template" onClick={() => sendEmailDirect(selected.id, "resend")} /></>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Record Payment — invoices only */}
                  {selected.type === "INVOICE" && ["ISSUED","SENT","PARTIALLY_PAID","OVERDUE"].includes(selected.status) && (
                    <button onClick={() => setShowPayment(true)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", cursor: "pointer", fontFamily: "inherit" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      Record Payment
                    </button>
                  )}

                  {/* Download PDF */}
                  <button
                    onClick={() => { if (sendBlocked) return; downloadPdf(selected.id, selected.docNum); }}
                    disabled={pdfDownloading || sendBlocked}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: "#fff", color: CLR.text, border: "1px solid #d1d5db", cursor: (pdfDownloading || sendBlocked) ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: (pdfDownloading || sendBlocked) ? 0.4 : 1 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    {pdfDownloading ? "Downloading…" : downloadLabel}
                  </button>
                </div>

                {/* Iframe — only render when src is ready */}
                <div style={{ flex: 1, overflow: "hidden" }}>
                  {iframeSrc ? (
                    <iframe
                      key={selected.id}
                      src={iframeSrc}
                      style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                      title={selected.docNum}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: CLR.faint, fontSize: 13 }}>
                      Loading preview…
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {showStatus && selected && (
        <StatusChangeModal
          docId={selected.id} docNum={selected.docNum}
          docType={selected.type} docStatus={selected.status}
          onClose={() => setShowStatus(false)}
          onChanged={newStatus => {
            setAllDocs(prev => prev.map(d => d.id === selected.id ? { ...d, status: newStatus } : d));
            setShowStatus(false);
          }}
        />
      )}

      {sendModalMode && selected && (
        <SendEmailModal
          docId={selected.id} docNum={selected.docNum}
          docType={selected.type} docStatus={selected.status}
          customerEmail={selected.customer.email}
          reminderEnabled={false} reminderCount={0}
          mode={sendModalMode}
          onClose={() => setSendModalMode(null)}
          onSent={() => { setSendModalMode(null); fetchDocs(); }}
        />
      )}

      {showCreate && (
        <CreateDocModal
          docType={docType}
          onClose={() => setShowCreate(false)}
          onCreated={(docNum?: string, docId?: string) => {
            setShowCreate(false);
            fetchDocs();
            if (docNum && docId) { setToast({ docNum, id: docId }); setSelectedId(docId); }
          }}
        />
      )}

      {showPayment && selected && (
        <RecordPaymentModal
          docId={selected.id} docNum={selected.docNum}
          currency={selected.currency} total={selected.total}
          marketId={(selected.market as any)?.id ?? ""}
          onClose={() => setShowPayment(false)}
          onSaved={() => { setShowPayment(false); fetchDocs(); }}
        />
      )}

      {convertId && convertDoc && (
        <ConvertModal
          docId={convertId}
          docNum={convertDoc.docNum}
          docType={convertDoc.type}
          onClose={() => { setConvertId(null); setConvertDoc(null); }}
          onConverted={redirectTo => {
            setConvertId(null); setConvertDoc(null);
            fetchDocs();
            router.push(redirectTo);
          }}
        />
      )}
    </div>
  );
}

function RecordPaymentModal({ docId, docNum, currency, total, marketId, onClose, onSaved }: {
  docId: string; docNum: string; currency: string; total: number; marketId: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [method,    setMethod]    = useState("BANK_TRANSFER");
  const [amount,    setAmount]    = useState((total / 100).toFixed(2));
  const [reference, setReference] = useState("");
  const [notes,     setNotes]     = useState("");
  const [paidAt,    setPaidAt]    = useState(new Date().toISOString().split("T")[0]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", fontFamily: "inherit", boxSizing: "border-box" as const };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" };

  async function submit() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/sales/billing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: docId, marketId, method,
          amountCents: Math.round(Number(amount) * 100),
          currency, reference: reference || null,
          notes: notes || null, paidAt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSaved();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", width: 420, maxWidth: "95vw", padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Record Payment — {docNum}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#9ca3af" }}>×</button>
        </div>
        {error && <div style={{ marginBottom: 12, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 }}>{error}</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={lbl}>Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} style={inp}>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="STRIPE">Stripe</option>
              <option value="CASH">Cash</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label style={lbl}>Amount ({currency})</label>
            <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Date</label>
            <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Reference</label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Bank ref, transaction ID…" style={inp} />
          </div>
          <div>
            <label style={lbl}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} />
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", fontSize: 13, background: "#fff", border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          <button onClick={submit} disabled={loading}
            style={{ padding: "8px 16px", fontSize: 13, fontWeight: 600, background: CLR.primary, color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Saving…" : "Record Payment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DropdownItem({ icon, label, hint, onClick }: { icon?: React.ReactNode; label: string; hint?: string; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "flex-start", gap: 9, width: "100%", padding: "9px 14px", background: hov ? "#f9fafb" : "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const }}>
      {icon && <span style={{ marginTop: 1, flexShrink: 0, color: "#6b7280" }}>{icon}</span>}
      <span style={{ display: "flex", flexDirection: "column" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "#111827" }}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: "#9ca3af" }}>{hint}</span>}
      </span>
    </button>
  );
}
