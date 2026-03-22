// app/admin/sales/[id]/page.tsx
"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CLR } from "@/components/ui/admin-ui";
import { AdminHeader } from "@/components/nav/AdminHeader";
import { Icon } from "@/components/ui/Icon";
import { SalesStatusBadge, DocTypeBadge, fmtAmount, SendEmailModal, StatusChangeModal, ConvertModal } from "../ui/sales-ui";
import { DOC_TYPE_LABEL, fmtDate } from "@/lib/sales/document-helpers";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocLine {
  id: string; description: string; descriptionAr?: string | null;
  productDetails?: string | null; detailsAr?: string | null;
  billingPeriod?: string | null; quantity: number;
  unitPrice: number; discount: number; lineTotal: number;
  product?: { key: string; name: string } | null;
}

interface Payment {
  id: string; method: string; amountCents: number;
  currency: string; reference?: string | null; paidAt: string;
}

interface LegalInfo {
  companyName?: string; companyNameAr?: string;
  tagline?: string;
  taxLabel?: string; taxNumber?: string;
  vatNumber?: string;
  address1?: string; address2?: string;
  district?: string; city?: string;
  state?: string; postalCode?: string;
  country?: string;
  address?: string;
  email?: string;
  phone?: string;
  footerText?: string;
  bankDetails?: {
    bankName?: string; accountName?: string;
    iban?: string; swift?: string; currency?: string;
  };
}

interface CompanyProfile { logoUrl?: string; primaryColor?: string }

interface FullDoc {
  id: string; docNum: string; type: string; status: string;
  currency: string; subtotal: number; vatPercent: number;
  vatAmount: number; total: number;
  subject?: string | null; referenceNumber?: string | null;
  notes?: string | null; internalNote?: string | null;
  termsAndConditions?: string | null; language: string;
  issueDate: string; dueDate?: string | null; validUntil?: string | null; paidAt?: string | null;
  emailSentAt?: string | null; emailSentCount?: number | null;
  reminderEnabled?: boolean | null; reminderCount?: number | null;
  manualSent?: boolean | null;
  zatcaQrCode?: string | null;
  rfqFileUrl?:  string | null;
  customer: {
    id: string; fullName?: string | null; email: string; mobile?: string | null;
    customerNumber?: number | null; companyName?: string | null;
    vatTaxId?: string | null;
    addressLine1?: string | null; addressLine2?: string | null;
    district?: string | null; city?: string | null;
    province?: string | null; country?: string | null;
  };
  market: {
    id: string; key: string; name: string; defaultCurrency: string;
    vatPercent: number; legalInfo: LegalInfo | null;
    companyProfile: CompanyProfile | null;
    showPayOnline: boolean; stripePublicKey?: string | null;
  };
  lines: DocLine[];
  payments: Payment[];
  originDoc?: { id: string; docNum: string; type: string } | null;
  derivedDocs?: { id: string; docNum: string; type: string; status: string }[];
}

const PERIOD_LABEL: Record<string, string> = {
  MONTHLY: "Monthly", SIX_MONTHS: "6 Months", YEARLY: "Yearly", ONE_TIME: "One-time",
};

function fmtDateTime(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Print CSS injected once ───────────────────────────────────────────────────
const PRINT_CSS = `
@media print {
  .no-print { display: none !important; }
  body { background: #fff !important; }
  #print-area { box-shadow: none !important; border: none !important; }
}
`;

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SalesDocDetailPage() {
  const params       = useParams();
  const router       = useRouter();
  const searchParams = useSearchParams();
  const id           = params?.id as string;

  const [doc,     setDoc]     = useState<FullDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // ── Send dropdown + modals ────────────────────────────────────────────────
  const [sendDropOpen,  setSendDropOpen]  = useState(false);
  const [sendModalMode, setSendModalMode] = useState<"reminder" | "custom" | null>(null);
  const [sendingDirect, setSendingDirect] = useState(false);
  const [showStatus,    setShowStatus]    = useState(false);
  const [showConvert,   setShowConvert]   = useState(false);
  const sendDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (sendDropRef.current && !sendDropRef.current.contains(e.target as Node)) {
        setSendDropOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/sales/${id}`);
      const data = await res.json();
      if (data.ok) setDoc(data.doc);
    } catch { /**/ }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Auto-print if ?print=1
  useEffect(() => {
    if (searchParams?.get("print") === "1" && doc && !loading) {
      setTimeout(() => window.print(), 500);
    }
  }, [doc, loading, searchParams]);

  // Inject print CSS
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  // Direct send — no modal needed
  async function sendEmailDirect(mode: "default" | "resend") {
    if (!doc) return;
    setSendDropOpen(false);
    setSendingDirect(true); setSendMsg(null);
    try {
      const res  = await fetch(`/api/admin/sales/${id}/send-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSendMsg({ ok: true, text: "Email sent successfully" });
      setDoc(prev => prev ? { ...prev, emailSentAt: data.emailSentAt, emailSentCount: data.emailSentCount } : prev);
    } catch (e: any) {
      setSendMsg({ ok: false, text: e.message });
    }
    setSendingDirect(false);
  }

  // Mark as sent — records sent date without sending an email
  async function markAsSent() {
    if (!doc) return;
    setSendDropOpen(false);
    setSendingDirect(true); setSendMsg(null);
    try {
      const res  = await fetch(`/api/admin/sales/${id}/send-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "mark_as_sent" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSendMsg({ ok: true, text: "Marked as sent" });
      setDoc(prev => prev ? { ...prev, emailSentAt: data.emailSentAt, emailSentCount: data.emailSentCount, manualSent: true } : prev);
    } catch (e: any) {
      setSendMsg({ ok: false, text: e.message });
    }
    setSendingDirect(false);
  }

  if (loading) return (
    <div style={{ padding: 48, textAlign: "center", fontSize: 13, color: CLR.faint }}>Loading…</div>
  );
  if (!doc) return (
    <div style={{ padding: 48, textAlign: "center", fontSize: 13, color: "#dc2626" }}>Document not found.</div>
  );

  const li          = doc.market.legalInfo ?? {};
  const cp          = doc.market.companyProfile ?? {};
  const hasSentEmail = (doc.emailSentCount ?? 0) > 0;
  const sentCount    = doc.emailSentCount ?? 0;
  const manualSent   = doc.manualSent ?? false;
  const lastSent     = doc.emailSentAt
    ? manualSent
      ? `Marked as sent on ${fmtDateTime(doc.emailSentAt)}`
      : `Last sent ${fmtDateTime(doc.emailSentAt)}`
    : "";
  const isSaudi      = doc.market.key === "SAUDI";
  const showBank     = (doc.type === "PROFORMA" || doc.type === "INVOICE") && li.bankDetails?.iban;
  const totalPaid    = doc.payments.reduce((s, p) => s + p.amountCents, 0);
  const balanceDue   = doc.total - totalPaid;
  const typeLabel    = DOC_TYPE_LABEL[doc.type as keyof typeof DOC_TYPE_LABEL] ?? doc.type;
  const primaryColor = cp.primaryColor ?? "#318774";
  const isInvoiceUnpaid = doc.type === "INVOICE" && ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(doc.status);
  const canSend      = !["VOID", "DRAFT"].includes(doc.status);

  const taxRateLabel = (() => {
    const t = (li.taxLabel ?? "VAT").trim();
    const base = t.replace(/\s*(No\.|Number|ID|#)\s*$/i, "").trim();
    return base ? `${base} Rate` : "VAT Rate";
  })();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <AdminHeader />
      <main style={{ flex: 1, overflowY: "auto", padding: "24px", background: "#f5f5f5" }}>

      {/* ── Page title row ── */}
      <div style={{ marginBottom: 20 }}>

        {/* Breadcrumb */}
        <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 10 }}>
          ADMIN / SALES / {typeLabel.toUpperCase()}
        </p>

        {/* Title + badges + actions — all on one line, vertically centred */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>

          {/* Back */}
          <button onClick={() => window.history.back()} title="Back"
            style={{ background: "none", border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit", padding: "5px 10px", color: CLR.muted, fontSize: 13, lineHeight: 1, flexShrink: 0 }}>
            ←
          </button>

          {/* Doc number */}
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: CLR.text, fontFamily: "monospace", margin: 0, lineHeight: 1 }}>
            {doc.docNum}
          </h1>

          {/* Type + status badges */}
          <DocTypeBadge type={doc.type} />
          <SalesStatusBadge status={doc.status} />

          {/* Push actions to right */}
          <div style={{ flex: 1 }} />

          {/* Edit button */}
          <button onClick={() => router.push(({
              RFQ: "/admin/sales/rfq", QUOTATION: "/admin/sales/quotations",
              PO: "/admin/sales/po", DELIVERY_NOTE: "/admin/sales/delivery-notes",
              PROFORMA: "/admin/sales/proforma", INVOICE: "/admin/sales/invoices",
              CREDIT_NOTE: "/admin/sales/returns",
            }[doc.type] ?? "/admin/sales") + `/${id}`)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, lineHeight: 1, background: "#fff", color: CLR.text, border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            <Icon name="edit" size={13} color="#6b7280" />
            Edit
          </button>

          {/* Convert button */}
          {doc.status !== "VOID" && doc.status !== "CONVERTED" && (
            <button onClick={() => setShowConvert(true)}
              style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, lineHeight: 1, background: "#fffbeb", color: "#b45309", border: "1px solid #fcd34d", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
              Convert ↗
            </button>
          )}

          {/* Status button */}
          <button onClick={() => setShowStatus(true)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, lineHeight: 1, background: "#fff", color: CLR.text, border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            <Icon name="chevron" size={13} color="#6b7280" />
            Status
          </button>

          {/* Send dropdown */}
          {canSend && (
            <div ref={sendDropRef} style={{ position: "relative", flexShrink: 0 }}>
              <button onClick={() => setSendDropOpen(v => !v)} disabled={sendingDirect} title={lastSent || undefined}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 18px", fontSize: 12, fontWeight: 600, lineHeight: 1,
                  background: hasSentEmail ? "#fffbeb" : primaryColor,
                  color: hasSentEmail ? "#92400e" : "#fff",
                  border: hasSentEmail ? "1px solid #fcd34d" : `1px solid ${primaryColor}`,
                  cursor: sendingDirect ? "not-allowed" : "pointer", fontFamily: "inherit",
                  opacity: sendingDirect ? 0.7 : 1,
                }}>
                <Icon name="mail" size={13} color={hasSentEmail ? "#92400e" : "#fff"} />
                {sendingDirect ? "Sending…" : "Send"}
                {hasSentEmail && sentCount > 1 && <span style={{ fontSize: 10, opacity: 0.7 }}>({sentCount})</span>}
                <span style={{ width: 1, height: 14, background: hasSentEmail ? "rgba(180,83,9,0.3)" : "rgba(255,255,255,0.3)", margin: "0 2px" }} />
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={hasSentEmail ? "#92400e" : "#fff"} strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {sendDropOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 200, background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", minWidth: 210 }}>
                  <DropItem icon="mail"    label="Send"         hint="Default template"           onClick={() => sendEmailDirect("default")} />
                  {isInvoiceUnpaid && (
                    <DropItem icon="bell" label="Send Reminder" hint={doc.reminderEnabled ? `Active · ${doc.reminderCount ?? 0}/4 sent` : "Weekly, up to 4 times"} onClick={() => { setSendDropOpen(false); setSendModalMode("reminder"); }} active={!!doc.reminderEnabled} />
                  )}
                  <DropItem icon="edit"   label="Send Custom"  hint="Edit subject, body, CC/BCC"  onClick={() => { setSendDropOpen(false); setSendModalMode("custom"); }} />
                  {!hasSentEmail && (
                    <>
                      <div style={{ height: 1, background: "#f3f4f6" }} />
                      <DropItem icon="check" label="Mark as Sent" hint="Record as sent without emailing" onClick={markAsSent} />
                    </>
                  )}
                  {hasSentEmail && (
                    <>
                      <div style={{ height: 1, background: "#f3f4f6" }} />
                      <DropItem icon="refresh" label="Resend" hint={lastSent || ""} onClick={() => sendEmailDirect("resend")} />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Download PDF */}
          <button onClick={() => window.print()}
            style={{ padding: "7px 18px", fontSize: 12, fontWeight: 600, lineHeight: 1, background: "#fff", color: CLR.text, border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            Download PDF
          </button>
        </div>
      </div>

      {/* Send result message */}
      {sendMsg && (
        <div style={{
          marginBottom: 16, padding: "10px 16px",
          background: sendMsg.ok ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${sendMsg.ok ? "#86efac" : "#fecaca"}`,
          color: sendMsg.ok ? "#15803d" : "#dc2626",
          fontSize: 13, fontWeight: 600,
        }}>
          {sendMsg.ok ? "✓ " : "✗ "}{sendMsg.text}
        </div>
      )}

      {/* ── Printable document ── */}
      <div id="print-area" style={{ maxWidth: 860, margin: "0 auto 40px" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "44px 52px", fontSize: 13, color: "#111827" }}>

        {/* ── Header: Logo/Company LEFT, Doc type/number RIGHT ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 0 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, maxWidth: "35%", wordBreak: "break-word" }}>
            {cp.logoUrl && (
              <img src={cp.logoUrl} alt={li.companyName ?? "Logo"}
                style={{ maxHeight: 48, maxWidth: 160, objectFit: "contain", marginBottom: 8, display: "block" }} />
            )}
            <div style={{
              fontSize: cp.logoUrl ? 15 : 26,
              fontWeight: 700, color: primaryColor,
              marginBottom: 2, lineHeight: 1.1,
              paddingBottom: cp.logoUrl ? 0 : 15,
            }}>
              {li.companyName ?? doc.market.name}
            </div>
            {li.tagline && (
              <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75 }}>{li.tagline}</div>
            )}
            <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75, marginTop: 2 }}>
              {(li.address1 || li.address) && (
                <span>
                  {[li.address1, li.address2, li.district, li.city, li.state, li.postalCode, li.country]
                    .filter(Boolean).join(", ") || li.address}
                </span>
              )}
              {(li.taxNumber || li.vatNumber) && (
                <span style={{ display: "block" }}>
                  {li.taxLabel ?? "VAT"}: {li.taxNumber ?? li.vatNumber}
                </span>
              )}
              {li.email && (
                <span style={{ display: "block" }}>{li.email}</span>
              )}
            </div>
          </div>

          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>
              {typeLabel}
            </div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "monospace", color: primaryColor, lineHeight: 1.1 }}>
              {doc.docNum}
            </div>
            <div style={{ marginTop: 6 }}><SalesStatusBadge status={doc.status} /></div>
          </div>
        </div>

        <div style={{ height: 24 }} />

        {/* ── Bill To + Details ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 40, marginBottom: 18 }}>
          <div style={{ maxWidth: "35%", wordBreak: "break-word" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10 }}>
              Bill To
            </div>
            {doc.customer.companyName ? (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2, lineHeight: 1.75 }}>
                  {doc.customer.companyName}
                </div>
                {doc.customer.fullName && (
                  <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.75 }}>
                    {doc.customer.fullName}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 2, lineHeight: 1.75 }}>
                {doc.customer.fullName ?? doc.customer.email}
              </div>
            )}
            <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75, marginTop: 3 }}>
              {(doc.customer.addressLine1 || doc.customer.city) && (
                <span style={{ display: "block" }}>
                  {[doc.customer.addressLine1, doc.customer.addressLine2, doc.customer.district, doc.customer.city, doc.customer.province, doc.customer.country]
                    .filter(Boolean).join(", ")}
                </span>
              )}
              {doc.customer.vatTaxId && (
                <span style={{ display: "block" }}>VAT: {doc.customer.vatTaxId}</span>
              )}
              <span style={{ display: "block" }}>{doc.customer.email}</span>
              {doc.customer.mobile && (
                <span style={{ display: "block" }}>{doc.customer.mobile}</span>
              )}
            </div>
          </div>

          <div>
            <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "0 28px" }}>
              <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75 }}>Issue Date</span>
              <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75, textAlign: "right" }}>{fmtDate(doc.issueDate)}</span>
              {doc.dueDate && <>
                <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75 }}>Due Date</span>
                <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75, textAlign: "right" }}>{fmtDate(doc.dueDate)}</span>
              </>}
              {doc.validUntil && <>
                <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75 }}>Valid Until</span>
                <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75, textAlign: "right" }}>{fmtDate(doc.validUntil)}</span>
              </>}
              {doc.referenceNumber && <>
                <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75 }}>Reference</span>
                <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75, textAlign: "right", fontFamily: "monospace" }}>{doc.referenceNumber}</span>
              </>}
              <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75 }}>Currency</span>
              <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75, textAlign: "right" }}>{doc.currency}</span>
              <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75 }}>{taxRateLabel}</span>
              <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75, textAlign: "right" }}>{Number(doc.vatPercent)}%</span>
            </div>
          </div>
        </div>

        {/* ── Subject ── */}
        {doc.subject && (
          <div style={{ marginBottom: 18, fontSize: 13, color: "#374151" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>Subject</div>
            {doc.subject}
          </div>
        )}

        {/* ── Line items ── */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6 }}>
          <thead>
            <tr style={{ background: primaryColor }}>
              <th style={{ padding: "9px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase", width: 28 }}>#</th>
              <th style={{ padding: "9px 10px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase" }}>Description</th>
              <th style={{ padding: "9px 10px", textAlign: "center", fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase", width: 82 }}>Period</th>
              <th style={{ padding: "9px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase", width: 42 }}>Qty</th>
              <th style={{ padding: "9px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase", width: 100 }}>Unit Price</th>
              <th style={{ padding: "9px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase", width: 54 }}>Disc</th>
              <th style={{ padding: "9px 10px", textAlign: "right", fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.05em", textTransform: "uppercase", width: 108 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={l.id} style={{ borderBottom: "0.5px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ padding: "10px 10px", fontSize: 11, color: "#9ca3af" }}>{i + 1}</td>
                <td style={{ padding: "10px 10px" }}>
                  <div style={{ fontWeight: 600 }}>{l.description}</div>
                  {l.product && <div style={{ fontSize: 10, color: primaryColor, fontFamily: "monospace", marginTop: 2 }}>{l.product.key}</div>}
                  {l.productDetails && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{l.productDetails}</div>}
                </td>
                <td style={{ padding: "10px 10px", textAlign: "center" }}>
                  {l.billingPeriod ? (
                    <span style={{ display: "inline-block", fontSize: 10, padding: "1px 7px", background: "#f3f4f6", border: "0.5px solid #e5e7eb", color: "#6b7280" }}>
                      {PERIOD_LABEL[l.billingPeriod] ?? l.billingPeriod}
                    </span>
                  ) : "—"}
                </td>
                <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{Number(l.quantity)}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "monospace", fontSize: 12 }}>{fmtAmount(l.unitPrice, doc.currency)}</td>
                <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "monospace", fontSize: 12, color: Number(l.discount) > 0 ? "#b45309" : "#9ca3af" }}>
                  {Number(l.discount) > 0 ? `${Number(l.discount)}%` : "—"}
                </td>
                <td style={{ padding: "10px 10px", textAlign: "right", fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
                  {fmtAmount(l.lineTotal, doc.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ── Totals ── */}
        <div style={{ display: "flex", justifyContent: "flex-end", margin: "18px 0 24px" }}>
          <div style={{ minWidth: 300 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderBottom: "0.5px solid #f3f4f6", fontSize: 12 }}>
              <span style={{ color: "#6b7280" }}>Subtotal</span>
              <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{fmtAmount(doc.subtotal, doc.currency)}</span>
            </div>
            {Number(doc.vatPercent) > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderBottom: "0.5px solid #f3f4f6", fontSize: 12 }}>
                <span style={{ color: "#6b7280" }}>VAT ({Number(doc.vatPercent)}%)</span>
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{fmtAmount(doc.vatAmount, doc.currency)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 10px", borderTop: `2px solid ${primaryColor}`, marginTop: 4, fontSize: 15, fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ color: primaryColor }}>{fmtAmount(doc.total, doc.currency)}</span>
            </div>
            {totalPaid > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", borderBottom: "0.5px solid #f3f4f6", fontSize: 12 }}>
                <span style={{ color: "#15803d" }}>
                  Paid
                  {doc.payments.length > 0 && (
                    <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 6 }}>
                      {fmtDate(doc.payments[0].paidAt)}
                    </span>
                  )}
                </span>
                <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#15803d" }}>− {fmtAmount(totalPaid, doc.currency)}</span>
              </div>
            )}
            {balanceDue > 0 && totalPaid > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 10px", borderTop: "1px solid #e5e7eb", marginTop: 6, fontSize: 14, fontWeight: 700 }}>
                <span>Balance Due</span>
                <span style={{ color: "#dc2626", fontFamily: "monospace" }}>{fmtAmount(balanceDue, doc.currency)}</span>
              </div>
            )}

            {/* Pay Online button */}
            {doc.market.showPayOnline && doc.market.stripePublicKey && balanceDue > 0 && (
              <div style={{ marginTop: 12, textAlign: "right" }}>
                <button style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "9px 20px", background: primaryColor, color: "#fff",
                  fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
                  fontFamily: "inherit",
                }}>
                  Pay Online — {fmtAmount(balanceDue, doc.currency)}
                </button>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Secure payment via Stripe · Credit / Debit card accepted</div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bank Details + ZATCA QR ── */}
        {showBank && (
          <div style={{
            padding: "12px 16px", background: "#f9fafb", border: "1px solid #e5e7eb",
            marginTop: 20, marginBottom: 20,
            display: "grid",
            gridTemplateColumns: (isSaudi && doc.type === "INVOICE") ? "1fr auto" : "1fr",
            gap: 24, alignItems: "start",
          }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                Bank Details
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: "3px 0" }}>
                {li.bankDetails?.bankName    && <><span style={{ fontSize: 10, color: "#9ca3af" }}>Bank</span><span style={{ fontSize: 11, fontFamily: "monospace" }}>{li.bankDetails.bankName}</span></>}
                {li.bankDetails?.accountName && <><span style={{ fontSize: 10, color: "#9ca3af" }}>Account</span><span style={{ fontSize: 11, fontFamily: "monospace" }}>{li.bankDetails.accountName}</span></>}
                {li.bankDetails?.iban        && <><span style={{ fontSize: 10, color: "#9ca3af" }}>IBAN</span><span style={{ fontSize: 11, fontFamily: "monospace" }}>{li.bankDetails.iban}</span></>}
                {li.bankDetails?.swift       && <><span style={{ fontSize: 10, color: "#9ca3af" }}>SWIFT</span><span style={{ fontSize: 11, fontFamily: "monospace" }}>{li.bankDetails.swift}</span></>}
              </div>
            </div>

            {isSaudi && doc.type === "INVOICE" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  ZATCA QR
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
                  <div style={{ fontSize: 9, color: "#9ca3af", whiteSpace: "nowrap" }}>
                    Scan to verify with ZATCA portal
                  </div>
                  <div style={{ width: 80, height: 80, border: "0.5px solid #e5e7eb", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {doc.zatcaQrCode
                      ? <img src={`data:image/png;base64,${doc.zatcaQrCode}`} alt="ZATCA QR" style={{ width: 72, height: 72 }} />
                      : (
                        <svg width="60" height="60" viewBox="0 0 52 52" fill="none">
                          <rect x="2" y="2" width="14" height="14" rx="1" fill="none" stroke="#6b7280" strokeWidth="2"/><rect x="5" y="5" width="8" height="8" fill="#6b7280"/>
                          <rect x="36" y="2" width="14" height="14" rx="1" fill="none" stroke="#6b7280" strokeWidth="2"/><rect x="39" y="5" width="8" height="8" fill="#6b7280"/>
                          <rect x="2" y="36" width="14" height="14" rx="1" fill="none" stroke="#6b7280" strokeWidth="2"/><rect x="5" y="39" width="8" height="8" fill="#6b7280"/>
                          <rect x="20" y="2" width="4" height="4" fill="#6b7280"/><rect x="26" y="2" width="4" height="4" fill="#6b7280"/>
                          <rect x="20" y="20" width="4" height="4" fill="#6b7280"/><rect x="26" y="26" width="4" height="4" fill="#6b7280"/>
                          <rect x="20" y="32" width="4" height="4" fill="#6b7280"/><rect x="38" y="38" width="4" height="4" fill="#6b7280"/>
                        </svg>
                      )
                    }
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Terms & Conditions + Notes ── */}
        {(doc.termsAndConditions || doc.notes) && (
          <div style={{ borderTop: showBank ? "none" : "0.5px solid #e5e7eb", paddingTop: showBank ? 0 : 20, marginBottom: 20 }}>
            {doc.termsAndConditions && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Terms &amp; Conditions</div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{doc.termsAndConditions}</div>
              </div>
            )}
            {doc.notes && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Notes</div>
                <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.7 }}>{doc.notes}</div>
              </div>
            )}
          </div>
        )}

        {/* Internal note — no-print */}
        {doc.internalNote && (
          <div className="no-print" style={{ marginTop: 16, padding: "12px 16px", background: "#fffbeb", border: "1px solid #fcd34d", fontSize: 12, color: "#92400e" }}>
            <strong>Internal note (admin only):</strong> {doc.internalNote}
          </div>
        )}

        {/* Document chain — no-print */}
        {(doc.originDoc || (doc.derivedDocs && doc.derivedDocs.length > 0)) && (
          <div className="no-print" style={{ marginTop: 12, padding: "10px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 12 }}>
            {doc.originDoc && (
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: "#6b7280" }}>Origin: </span>
                <span style={{ fontFamily: "monospace", color: primaryColor, fontWeight: 600, cursor: "pointer" }}
                  onClick={() => router.push(`/admin/sales/${doc.originDoc!.id}`)}>
                  {doc.originDoc.docNum}
                </span>
                <span style={{ color: "#9ca3af", marginLeft: 6 }}>({doc.originDoc.type.replace(/_/g, " ")})</span>
              </div>
            )}
            {doc.derivedDocs && doc.derivedDocs.length > 0 && (
              <div>
                <span style={{ color: "#6b7280" }}>Derived: </span>
                {doc.derivedDocs.map(d => (
                  <span key={d.id} style={{ fontFamily: "monospace", color: primaryColor, fontWeight: 600, marginRight: 10, cursor: "pointer" }}
                    onClick={() => router.push(`/admin/sales/${d.id}`)}>
                    {d.docNum}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {doc.rfqFileUrl && (
          <div className="no-print" style={{ marginTop: 12, padding: "10px 14px", background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 12, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "#6b7280" }}>Attachment:</span>
            <button
              onClick={async () => {
                const res  = await fetch(`/api/admin/sales/attachment?key=${encodeURIComponent(doc.rfqFileUrl!)}`);
                const data = await res.json();
                if (data.url) window.open(data.url, "_blank");
              }}
              style={{ background: "none", border: "none", cursor: "pointer", color: CLR.primary, fontWeight: 600, fontSize: 12, padding: 0, fontFamily: "inherit" }}>
              View / Download ↗
            </button>
          </div>
        )}

        {/* Doc footer */}
        <div style={{ textAlign: "center", fontSize: 10, color: "#9ca3af", borderTop: "0.5px solid #e5e7eb", paddingTop: 12, marginTop: 20 }}>
          {li.footerText ?? `${li.companyName ?? doc.market.name} · ${li.email ?? ""} · ${li.phone ?? ""}`}
        </div>

        </div>
      </div>

      {/* ── Modals ── */}
      {showStatus && (
        <StatusChangeModal
          docId={id} docNum={doc.docNum}
          docType={doc.type} docStatus={doc.status}
          onClose={() => setShowStatus(false)}
          onChanged={newStatus => setDoc(prev => prev ? { ...prev, status: newStatus } : prev)}
        />
      )}

      {showConvert && (
        <ConvertModal
          docId={id} docNum={doc.docNum} docType={doc.type}
          onClose={() => setShowConvert(false)}
          onConverted={redirectTo => { setShowConvert(false); router.push(redirectTo); }}
        />
      )}

      {sendModalMode && (
        <SendEmailModal
          docId={id} docNum={doc.docNum}
          docType={doc.type} docStatus={doc.status}
          customerEmail={doc.customer.email}
          reminderEnabled={doc.reminderEnabled ?? false}
          reminderCount={doc.reminderCount ?? 0}
          mode={sendModalMode}
          onClose={() => setSendModalMode(null)}
          onSent={result => {
            setSendMsg({ ok: true, text: "Email sent successfully" });
            setDoc(prev => prev ? {
              ...prev,
              emailSentAt:     result.emailSentAt,
              emailSentCount:  result.emailSentCount  ?? prev.emailSentCount,
              reminderCount:   result.reminderCount   ?? prev.reminderCount,
              reminderEnabled: result.reminderEnabled ?? prev.reminderEnabled,
            } : prev);
          }}
        />
      )}
    </main>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function DropItem({ icon, label, hint, onClick, active }: {
  icon: string; label: string; hint?: string;
  onClick: () => void; active?: boolean;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 14px", background: hov ? "#f9fafb" : "#fff", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const }}>
      <Icon name={icon} size={14} color={active ? CLR.primary : "#6b7280"} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 13, fontWeight: 500, color: active ? CLR.primary : "#111827", margin: 0 }}>{label}</p>
        {hint && <p style={{ fontSize: 11, color: "#9ca3af", margin: 0 }}>{hint}</p>}
      </div>
      {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: CLR.primary, flexShrink: 0 }} />}
    </button>
  );
}