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
        id:             d.id,
        docNum:         d.docNum,
        type:           d.type,
        status:         d.status,
        currency:       d.currency,
        total:          d.total,
        issueDate:      d.issueDate,
        dueDate:        d.dueDate ?? null,
        createdAt:      d.createdAt ?? d.issueDate,
        emailSentCount: d.emailSentCount ?? 0,
        customer: {
          fullName:       d.customer?.fullName ?? null,
          companyName:    d.customer?.companyName ?? null,
          email:          d.customer?.email ?? "",
          customerNumber: d.customer?.customerNumber ?? null,
        },
        market:    { key: d.market?.key ?? "", name: d.market?.name ?? "" },
        originDoc: d.originDoc ?? null,
      }));
      setAllDocs(rows.sort((a, b) => new Date((b as any).createdAt).getTime() - new Date((a as any).createdAt).getTime()));
      if (rows.length > 0 && !selectedId) setSelectedId(rows[0].id);
    } catch { /**/ }
    setLoading(false);
  }, [docType]);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => { fetchDocs(); }, 0);
  }, [fetchDocs]);

  // Client-side filter
  const docs = allDocs.filter(d => {
    if (status    && d.status     !== status)    return false;
    if (marketKey && d.market.key !== marketKey) return false;
    if (q) {
      const ql = q.toLowerCase();
      const match =
        d.docNum.toLowerCase().includes(ql) ||
        (d.customer.companyName ?? "").toLowerCase().includes(ql) ||
        (d.customer.fullName ?? "").toLowerCase().includes(ql) ||
        d.customer.email.toLowerCase().includes(ql) ||
        String(d.customer.customerNumber ?? "").includes(ql);
      if (!match) return false;
    }
    return true;
  });

  // Fetch print token when selected doc changes
  useEffect(() => {
    if (!selectedId) { setIframeSrc(""); return; }
    fetch(`/api/admin/sales/${selectedId}/print-token`)
      .then(r => r.json())
      .then(d => { if (d.ok) setIframeSrc(`/print/sales/${selectedId}?token=${d.token}`); })
      .catch(() => {});
  }, [selectedId]);

  const hasFilters     = q || status || marketKey;
  const selected       = docs.find(d => d.id === selectedId) ?? allDocs.find(d => d.id === selectedId) ?? null;
  const hasSentSelected = ((selected as any)?.emailSentCount ?? 0) > 0 || (emailState[selected?.id ?? ""]?.count ?? 0) > 0;

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

  // Keep old signature for toast button
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

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#f5f5f5" }}>

      {/* Header */}
      <div style={{ padding: "12px 20px 10px", borderBottom: "1px solid #e5e7eb", background: "#fff", flexShrink: 0 }}>
        <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 3 }}>{crumb}</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "#111827", margin: 0 }}>{label}</h1>
          <button onClick={() => setShowCreate(true)}
            style={{ padding: "7px 16px", fontSize: 12, fontWeight: 600, background: CLR.primary, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            + New {docType === "RFQ" ? "Lead" : label.replace(/s$/, "")}
          </button>
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
          <button onClick={() => openDetail(toast.id)}
            style={{ padding: "3px 10px", fontSize: 11, fontWeight: 600, background: "#fff", color: "#15803d", border: "1px solid #86efac", cursor: "pointer", fontFamily: "inherit" }}>
            Open
          </button>
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#15803d", marginLeft: "auto" }}>✕</button>
        </div>
      )}

      {/* Two-column body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>

        {/* LEFT PANE */}
        <div style={{
          width: isMobile ? "100%" : 300, minWidth: isMobile ? "100%" : 300,
          display: "flex", flexDirection: "column",
          borderRight: "1px solid #e5e7eb", background: "#fff", overflow: "hidden", flexShrink: 0,
        }}>
          <div style={{ padding: "10px 10px 8px", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search doc #, customer…"
              style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const, marginBottom: 6 }} />
            <div style={{ display: "flex", gap: 5 }}>
              <select value={status} onChange={e => setStatus(e.target.value)}
                style={{ flex: 1, padding: "5px 6px", fontSize: 11, border: "1px solid #d1d5db", background: "#fff", fontFamily: "inherit", outline: "none" }}>
                <option value="">All Statuses</option>
                {(VALID_STATUSES[docType] ?? []).map(s => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
              </select>
              <select value={marketKey} onChange={e => setMarketKey(e.target.value)}
                style={{ flex: 1, padding: "5px 6px", fontSize: 11, border: "1px solid #d1d5db", background: "#fff", fontFamily: "inherit", outline: "none" }}>
                <option value="">All Markets</option>
                <option value="SAUDI">Saudi</option>
                <option value="GLOBAL">Global</option>
              </select>
              {hasFilters && (
                <button onClick={() => { setQ(""); setStatus(""); setMarketKey(""); }}
                  style={{ padding: "5px 7px", fontSize: 11, background: "#fff", color: CLR.muted, border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
              )}
            </div>
            <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 5 }}>
              {loading ? "Loading…" : `${docs.length}${docs.length !== allDocs.length ? ` of ${allDocs.length}` : ""} doc${allDocs.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", color: CLR.faint, fontSize: 12 }}>Loading…</div>
            ) : docs.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: CLR.faint, fontSize: 12 }}>No documents found</div>
            ) : docs.map(d => {
              const isSelected = d.id === selectedId;
              const es = emailState[d.id];
              const hasSent = ((d as any).emailSentCount ?? 0) > 0 || (es?.count ?? 0) > 0;
              return (
                <div key={d.id} onClick={() => openDetail(d.id)}
                  style={{ padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid #f3f4f6", background: isSelected ? CLR.primaryBg : "#fff", borderLeft: `3px solid ${isSelected ? CLR.primary : "transparent"}`, transition: "background 0.1s" }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f9fafb"; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "#fff"; }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? CLR.primary : "#111827", fontFamily: "monospace" }}>{d.docNum}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#374151", flexShrink: 0 }}>{fmtAmount(d.total, d.currency)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, marginBottom: 4 }}>
                    {d.customer.companyName ?? d.customer.fullName ?? d.customer.email}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" as const }}>
                    <span style={{ fontSize: 10, color: CLR.faint }}>{fmtDate(d.issueDate)}</span>
                    <SalesStatusBadge status={d.status} />
                    {hasSent && <span style={{ fontSize: 9, padding: "1px 5px", background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e" }}>Sent</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANE */}
        {!isMobile && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
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
                  <button onClick={() => setShowStatus(true)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: "#fff", color: CLR.text, border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Status
                  </button>

                  {/* Send dropdown */}
                  <div ref={sendDropRef} style={{ position: "relative" }}>
                    <button onClick={() => setSendDropOpen(v => !v)} disabled={emailState[selected.id]?.sending}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: hasSentSelected ? "#fffbeb" : CLR.primary, color: hasSentSelected ? "#92400e" : "#fff", border: hasSentSelected ? "1px solid #fcd34d" : "none", cursor: "pointer", fontFamily: "inherit" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      {emailState[selected.id]?.sending ? "Sending…" : "Send Mail"}
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                    </button>
                    {sendDropOpen && (
                      <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 300, background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", minWidth: 210 }}>
                        <DropdownItem icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>} label="Send" hint="Default template" onClick={() => sendEmailDirect(selected.id)} />
                        <DropdownItem icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>} label="Send Custom" hint="Edit subject, body, CC/BCC" onClick={() => { setSendDropOpen(false); setSendModalMode("custom"); }} />
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
                  <button onClick={() => window.open(`/api/admin/sales/${selected.id}/pdf`, "_blank")}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: "#fff", color: CLR.text, border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download PDF
                  </button>
                </div>

                {/* Iframe */}
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <iframe
                    key={selected.id}
                    src={iframeSrc}
                    style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                    title={selected.docNum}
                  />
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
          onConverted={newId => {
            setConvertId(null); setConvertDoc(null);
            fetchDocs();
            router.push(`/admin/sales/${newId}`);
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
        body: JSON.stringify({ documentId: docId, marketId, method, amountCents: Math.round(Number(amount) * 100), currency, reference: reference || null, notes: notes || null, paidAt }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 440, padding: 24 }} onClick={e => e.stopPropagation()}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "#111827" }}>Record Payment — {docNum}</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={lbl}>PAYMENT METHOD</label>
            <select value={method} onChange={e => setMethod(e.target.value)} style={inp}>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="STRIPE">Stripe</option>
              <option value="CASH">Cash</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div><label style={lbl}>AMOUNT ({currency})</label>
            <input type="number" value={amount} min={0} step={0.01} onChange={e => setAmount(e.target.value)} style={inp} />
          </div>
          <div><label style={lbl}>REFERENCE / TRANSACTION ID</label>
            <input value={reference} onChange={e => setReference(e.target.value)} placeholder="Bank ref, Stripe charge ID…" style={inp} />
          </div>
          <div><label style={lbl}>PAYMENT DATE</label>
            <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} style={inp} />
          </div>
          <div><label style={lbl}>NOTES</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} style={{ ...inp, resize: "vertical" as const }} />
          </div>
          {error && <p style={{ fontSize: 12, color: "#dc2626" }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
            <button onClick={onClose} disabled={loading} style={{ padding: "7px 16px", fontSize: 12, fontWeight: 600, background: "#fff", color: "#374151", border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={submit} disabled={loading} style={{ padding: "7px 16px", fontSize: 12, fontWeight: 600, background: CLR.primary, color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Saving…" : "Record Payment"}
            </button>
          </div>
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