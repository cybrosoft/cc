// app/admin/sales/ui/SalesDetailClient.tsx
// Full document detail view used by each doc type's [id]/page.tsx
// Features:
//   - Full edit mode (all fields + line items). Locked on PAID/VOID.
//     Yellow warning on ISSUED/SENT — editing allowed but cautioned.
//   - Send dropdown: Send / Send Reminder (invoice unpaid only) / Send Custom / Resend
//   - Status Change modal with optional note (written to audit log)
//   - Convert → saves as DRAFT, redirects to new doc in edit mode
//   - Record Payment modal

"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CLR } from "@/components/ui/admin-ui";
import { Icon } from "@/components/ui/Icon";
import {
  SalesStatusBadge, DocTypeBadge, LineItemsEditor, ConvertModal,
  fmtAmount, fmtDate, Overlay, ModalBox, PrimaryBtn, GhostBtn,
  SendEmailModal, StatusChangeModal,
  type LineItem,
} from "./sales-ui";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ENDPOINT_FOR_TYPE: Record<string, string> = {
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

// Fully locked — no editing allowed
const LOCKED_STATUSES = ["PAID", "VOID", "WRITTEN_OFF", "APPLIED", "CANCELLED"];
// Editing allowed but show warning
const WARN_STATUSES   = ["ISSUED", "SENT", "REVISED", "QUOTED", "PARTIALLY_PAID"];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Props { docId: string; docType: string; backHref: string }

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e7eb", padding: "16px 20px",
};
const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: "#9ca3af",
  textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 12,
};
const fieldLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "#9ca3af",
  textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 4,
};
const fieldValue: React.CSSProperties = { fontSize: 13, color: "#111827", fontWeight: 500 };
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", fontSize: 13,
  border: "1px solid #d1d5db", outline: "none",
  fontFamily: "inherit", color: "#111827", background: "#fff",
  boxSizing: "border-box" as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SalesDetailClient({ docId, docType, backHref }: Props) {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [doc,     setDoc]     = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  // Edit state
  const [editing,      setEditing]      = useState(false);
  const [lines,        setLines]        = useState<LineItem[]>([]);
  const [subject,      setSubject]      = useState("");
  const [refNumber,    setRefNumber]    = useState("");
  const [notes,        setNotes]        = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [dueDate,      setDueDate]      = useState("");
  const [issueDate,    setIssueDate]    = useState("");

  // Modals
  const [showConvert,   setShowConvert]   = useState(false);
  const [showPayment,   setShowPayment]   = useState(false);
  const [showStatus,    setShowStatus]    = useState(false);
  const [sendModalMode, setSendModalMode] = useState<"reminder" | "custom" | null>(null);

  // Send dropdown
  const [sendDropOpen, setSendDropOpen] = useState(false);
  const sendDropRef = useRef<HTMLDivElement>(null);

  // Payment form state
  const [payMethod,  setPayMethod]  = useState("BANK_TRANSFER");
  const [payAmount,  setPayAmount]  = useState("");
  const [payRef,     setPayRef]     = useState("");
  const [payNotes,   setPayNotes]   = useState("");
  const [payDate,    setPayDate]    = useState(new Date().toISOString().split("T")[0]);
  const [payLoading, setPayLoading] = useState(false);
  const [payError,   setPayError]   = useState("");

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (sendDropRef.current && !sendDropRef.current.contains(e.target as Node)) {
        setSendDropOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${ENDPOINT_FOR_TYPE[docType]}/${docId}`);
      const data = await res.json();
      const d    = data.doc;
      setDoc(d);
      populateEdit(d);
    } catch { setError("Failed to load document."); }
    setLoading(false);
  }, [docId, docType]);

  useEffect(() => { load(); }, [load]);

  // Auto-open edit mode if ?edit=1 (set by convert redirect)
  useEffect(() => {
    if (searchParams?.get("edit") === "1" && doc && !loading) {
      setEditing(true);
    }
  }, [doc, loading, searchParams]);

  function populateEdit(d: any) {
    setLines((d.lines ?? []).map((l: any) => ({
      id: l.id, productId: l.productId ?? null,
      productKey: l.product?.key ?? "",
      description: l.description ?? "",
      descriptionAr: l.descriptionAr ?? "",
      productDetails: l.productDetails ?? "",
      detailsAr: l.detailsAr ?? "",
      billingPeriod: l.billingPeriod ?? "",
      quantity: Number(l.quantity),
      unitPrice: l.unitPrice,
      discount: Number(l.discount),
      lineTotal: l.lineTotal,
      isNonInventory: !l.productId,
      showDetails: false,
    })));
    setSubject(d.subject ?? "");
    setRefNumber(d.referenceNumber ?? "");
    setNotes(d.notes ?? "");
    setInternalNote(d.internalNote ?? "");
    setDueDate(d.dueDate ? d.dueDate.split("T")[0] : "");
    setIssueDate(d.issueDate ? d.issueDate.split("T")[0] : "");
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  function startEdit() { populateEdit(doc); setEditing(true); setError(""); }
  function cancelEdit() { populateEdit(doc); setEditing(false); setError(""); }

  async function saveChanges() {
    setSaving(true); setError("");
    try {
      const res = await fetch(`${ENDPOINT_FOR_TYPE[docType]}/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject:         subject      || null,
          referenceNumber: refNumber    || null,
          notes:           notes        || null,
          internalNote:    internalNote || null,
          dueDate:         dueDate      || null,
          issueDate:       issueDate    || null,
          lines: lines.map(l => ({
            id:             l.id,
            productId:      l.productId,
            description:    l.description,
            descriptionAr:  l.descriptionAr  || null,
            billingPeriod:  l.billingPeriod  || null,
            productDetails: l.productDetails || null,
            detailsAr:      l.detailsAr      || null,
            quantity:       l.quantity,
            unitPrice:      l.unitPrice,
            discount:       l.discount,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditing(false);
      await load();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  // ── Send email (direct — no modal) ─────────────────────────────────────────
  async function sendEmailDirect(mode: "default" | "resend") {
    setSaving(true); setError("");
    setSendDropOpen(false);
    try {
      const res  = await fetch(`/api/admin/sales/${docId}/send-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDoc((prev: any) => ({
        ...prev,
        emailSentAt:    data.emailSentAt,
        emailSentCount: data.emailSentCount,
      }));
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  // ── Convert ─────────────────────────────────────────────────────────────────
  function handleConverted(redirectTo: string) {
    setShowConvert(false);
    router.push(redirectTo);
  }

  // ── Record payment ──────────────────────────────────────────────────────────
  async function recordPayment() {
    setPayLoading(true); setPayError("");
    try {
      const cents = Math.round(parseFloat(payAmount) * 100);
      if (!cents || isNaN(cents)) throw new Error("Invalid amount");
      const res = await fetch(`/api/admin/sales/${docId}/payment`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method:      payMethod,
          amountCents: cents,
          currency:    doc.currency,
          reference:   payRef   || null,
          notes:       payNotes || null,
          paidAt:      payDate  || null,
          marketId:    doc.market.id,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setShowPayment(false);
      setPayAmount(""); setPayRef(""); setPayNotes("");
      await load();
    } catch (e: any) { setPayError(e.message); }
    setPayLoading(false);
  }

  // ── Render guards ────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: CLR.faint, fontSize: 13 }}>Loading…</div>
  );
  if (!doc) return (
    <div style={{ padding: 40, textAlign: "center", color: "#dc2626", fontSize: 13 }}>{error || "Document not found."}</div>
  );

  const vatPct       = Number(doc.market?.vatPercent ?? doc.vatPercent ?? 0);
  const totalPaid    = (doc.payments ?? []).reduce((s: number, p: any) => s + p.amountCents, 0);
  const balanceDue   = doc.total - totalPaid;
  const isLocked     = LOCKED_STATUSES.includes(doc.status);
  const isWarning    = WARN_STATUSES.includes(doc.status);
  const canSend      = !["VOID", "DRAFT"].includes(doc.status);
  const hasBeenSent  = (doc.emailSentCount ?? 0) > 0;
  const isInvoiceUnpaid = doc.type === "INVOICE" && ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(doc.status);
  const canPay       = ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(doc.status);

  return (
    <div style={{ padding: "24px" }}>

      {/* ── Action bar ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>

        {/* Left: title */}
        <div>
          <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 4 }}>
            <a href={backHref} style={{ color: "#9ca3af", textDecoration: "none" }}>← Back</a>
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <DocTypeBadge type={doc.type} />
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", color: "#111827", margin: 0, fontFamily: "monospace" }}>
              {doc.docNum}
            </h1>
            <SalesStatusBadge status={doc.status} />
          </div>
        </div>

        {/* Right: buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

          {/* Edit / Save / Cancel */}
          {!editing ? (
            <button onClick={startEdit} disabled={isLocked}
              title={isLocked ? `Cannot edit — document is ${doc.status}` : "Edit document"}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "7px 14px", fontSize: 12, fontWeight: 600,
                background: "#fff", color: isLocked ? "#9ca3af" : "#374151",
                border: `1px solid ${isLocked ? "#e5e7eb" : "#d1d5db"}`,
                cursor: isLocked ? "not-allowed" : "pointer", fontFamily: "inherit",
              }}>
              <Icon name="edit" size={13} color={isLocked ? "#d1d5db" : "#6b7280"} />
              Edit
            </button>
          ) : (
            <>
              <button onClick={cancelEdit}
                style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "#fff", color: "#374151", border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit" }}>
                Cancel
              </button>
              <button onClick={saveChanges} disabled={saving}
                style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, background: CLR.primary, color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </>
          )}

          {/* Status Change */}
          {!editing && (
            <button onClick={() => setShowStatus(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "#fff", color: "#374151", border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit" }}>
              <Icon name="chevron" size={13} color="#6b7280" />
              Status
            </button>
          )}

          {/* Send dropdown */}
          {!editing && canSend && (
            <div ref={sendDropRef} style={{ position: "relative" }}>
              <button onClick={() => setSendDropOpen(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, background: CLR.primary, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                <Icon name="mail" size={13} color="#fff" />
                Send
                <span style={{ width: 1, height: 14, background: "rgba(255,255,255,0.3)", margin: "0 2px" }} />
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {sendDropOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 200, background: "#fff", border: "1px solid #e5e7eb", boxShadow: "0 4px 16px rgba(0,0,0,0.10)", minWidth: 210 }}>
                  <DropItem icon="mail"    label="Send"         hint="Default template"           onClick={() => sendEmailDirect("default")} />
                  {isInvoiceUnpaid && (
                    <DropItem icon="bell" label="Send Reminder" hint={doc.reminderEnabled ? `Active · ${doc.reminderCount ?? 0}/4 sent` : "Weekly, up to 4 times"} onClick={() => { setSendDropOpen(false); setSendModalMode("reminder"); }} active={doc.reminderEnabled} />
                  )}
                  <DropItem icon="edit"   label="Send Custom"  hint="Edit subject, body, CC/BCC"  onClick={() => { setSendDropOpen(false); setSendModalMode("custom"); }} />
                  {hasBeenSent && (
                    <>
                      <div style={{ height: 1, background: "#f3f4f6" }} />
                      <DropItem icon="refresh" label="Resend" hint={`Last sent ${fmtDate(doc.emailSentAt)} · ${doc.emailSentCount}×`} onClick={() => sendEmailDirect("resend")} />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Convert */}
          {!editing && doc.status !== "VOID" && doc.status !== "CONVERTED" && (
            <button onClick={() => setShowConvert(true)}
              style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "#fffbeb", color: "#b45309", border: "1px solid #fcd34d", cursor: "pointer", fontFamily: "inherit" }}>
              Convert ↗
            </button>
          )}

          {/* Record Payment */}
          {!editing && canPay && (
            <button onClick={() => setShowPayment(true)}
              style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, background: "#dcfce7", color: "#15803d", border: "1px solid #86efac", cursor: "pointer", fontFamily: "inherit" }}>
              Record Payment
            </button>
          )}
        </div>
      </div>

      {/* Edit warning */}
      {editing && isWarning && (
        <div style={{ padding: "10px 14px", background: "#fffbeb", border: "1px solid #fcd34d", color: "#92400e", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon name="warning" size={14} color="#b45309" />
          This document has been {doc.status.toLowerCase().replace(/_/g, " ")}. Editing will not update any emails already sent.
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ── Main grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, alignItems: "start" }}>

        {/* LEFT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Document meta */}
          <div style={card}>
            <p style={sectionLabel}>Document Info</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>

              <div>
                <p style={fieldLabel}>Issue Date</p>
                {editing
                  ? <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} style={inputStyle} />
                  : <p style={fieldValue}>{fmtDate(doc.issueDate)}</p>}
              </div>

              <div>
                <p style={fieldLabel}>Due Date</p>
                {editing
                  ? <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
                  : <p style={fieldValue}>{fmtDate(doc.dueDate)}</p>}
              </div>

              <div>
                <p style={fieldLabel}>Language</p>
                <p style={fieldValue}>{doc.language === "ar" ? "Arabic" : doc.language === "bi" ? "Bilingual" : "English"}</p>
              </div>

              <div>
                <p style={fieldLabel}>Subject</p>
                {editing
                  ? <input style={inputStyle} value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Cloud Services — March 2026" />
                  : <p style={fieldValue}>{doc.subject || "—"}</p>}
              </div>

              <div>
                <p style={fieldLabel}>Reference No.</p>
                {editing
                  ? <input style={inputStyle} value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder="PO / RFQ ref…" />
                  : <p style={fieldValue}>{doc.referenceNumber || "—"}</p>}
              </div>

              <div>
                <p style={fieldLabel}>Email</p>
                <p style={fieldValue}>
                  {hasBeenSent
                    ? `Sent ${doc.emailSentCount}× · ${fmtDate(doc.emailSentAt)}`
                    : "Not sent yet"}
                </p>
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div style={card}>
            <p style={sectionLabel}>Line Items</p>
            <LineItemsEditor
              lines={lines}
              onChange={editing ? setLines : () => {}}
              currency={doc.currency}
              vatPercent={vatPct}
              marketId={doc.market?.id}
              customerId={doc.customer?.id}
              readOnly={!editing}
            />
          </div>

          {/* Notes */}
          <div style={card}>
            <p style={sectionLabel}>Notes</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <p style={fieldLabel}>Customer Note</p>
                {editing
                  ? <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Visible to customer on document…" />
                  : <p style={{ ...fieldValue, color: doc.notes ? "#111827" : "#9ca3af" }}>{doc.notes || "—"}</p>}
              </div>
              <div>
                <p style={fieldLabel}>Internal Note</p>
                {editing
                  ? <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }} value={internalNote} onChange={e => setInternalNote(e.target.value)} placeholder="Admin only — not shown to customer…" />
                  : <p style={{ ...fieldValue, color: doc.internalNote ? "#111827" : "#9ca3af" }}>{doc.internalNote || "—"}</p>}
              </div>
            </div>
          </div>

          {/* Document chain */}
          {(doc.originDoc || (doc.derivedDocs ?? []).length > 0) && (
            <div style={card}>
              <p style={sectionLabel}>Document Chain</p>
              {doc.originDoc && (
                <div style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>Origin: </span>
                  <a href={`${DETAIL_BASE[doc.originDoc.type] ?? "/admin/sales"}/${doc.originDoc.id}`}
                    style={{ fontSize: 13, color: CLR.primary, fontWeight: 600, textDecoration: "none", fontFamily: "monospace" }}>
                    {doc.originDoc.docNum}
                  </a>
                </div>
              )}
              {(doc.derivedDocs ?? []).map((d: any) => (
                <div key={d.id} style={{ marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>Derived: </span>
                  <a href={`${DETAIL_BASE[d.type] ?? "/admin/sales"}/${d.id}`}
                    style={{ fontSize: 13, color: CLR.primary, fontWeight: 600, textDecoration: "none", fontFamily: "monospace" }}>
                    {d.docNum}
                  </a>
                  <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 6 }}>{d.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Customer */}
          <div style={card}>
            <p style={sectionLabel}>Customer</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>
              {doc.customer?.fullName ?? doc.customer?.email}
            </p>
            {doc.customer?.companyName && <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>{doc.customer.companyName}</p>}
            <p style={{ fontSize: 12, color: "#9ca3af" }}>{doc.customer?.email}</p>
            {doc.customer?.customerNumber && <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>#{doc.customer.customerNumber}</p>}
          </div>

          {/* Totals */}
          <div style={card}>
            <p style={sectionLabel}>Totals</p>
            <TRow label="Subtotal" value={fmtAmount(doc.subtotal, doc.currency)} />
            {vatPct > 0 && <TRow label={`VAT (${vatPct}%)`} value={fmtAmount(doc.vatAmount, doc.currency)} />}
            <div style={{ height: 1, background: "#e5e7eb", margin: "6px 0" }} />
            <TRow label="Total" value={fmtAmount(doc.total, doc.currency)} bold />
            {totalPaid > 0 && <TRow label="Paid" value={`− ${fmtAmount(totalPaid, doc.currency)}`} color="#15803d" />}
            {balanceDue > 0 && totalPaid > 0 && <TRow label="Balance Due" value={fmtAmount(balanceDue, doc.currency)} bold color="#b45309" />}
          </div>

          {/* Payments */}
          {(doc.payments ?? []).length > 0 && (
            <div style={card}>
              <p style={sectionLabel}>Payments</p>
              {doc.payments.map((p: any) => (
                <div key={p.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #f3f4f6" }}>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}>{p.method.replace(/_/g, " ")}</p>
                    {p.reference && <p style={{ fontSize: 11, color: "#9ca3af" }}>{p.reference}</p>}
                    <p style={{ fontSize: 11, color: "#9ca3af" }}>{fmtDate(p.paidAt)}</p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>{fmtAmount(p.amountCents, doc.currency)}</p>
                </div>
              ))}
            </div>
          )}

          {/* Market */}
          <div style={card}>
            <p style={sectionLabel}>Market</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{doc.market?.name}</p>
            <p style={{ fontSize: 12, color: "#9ca3af" }}>{doc.currency} · VAT {vatPct}%</p>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}

      {showStatus && (
        <StatusChangeModal
          docId={docId} docNum={doc.docNum}
          docType={doc.type} docStatus={doc.status}
          onClose={() => setShowStatus(false)}
          onChanged={newStatus => setDoc((prev: any) => ({ ...prev, status: newStatus }))}
        />
      )}

      {sendModalMode && (
        <SendEmailModal
          docId={docId} docNum={doc.docNum}
          docType={doc.type} docStatus={doc.status}
          customerEmail={doc.customer?.email ?? ""}
          reminderEnabled={doc.reminderEnabled ?? false}
          reminderCount={doc.reminderCount ?? 0}
          mode={sendModalMode}
          onClose={() => setSendModalMode(null)}
          onSent={result => setDoc((prev: any) => ({
            ...prev,
            emailSentAt:     result.emailSentAt,
            emailSentCount:  result.emailSentCount  ?? prev.emailSentCount,
            reminderCount:   result.reminderCount   ?? prev.reminderCount,
            reminderEnabled: result.reminderEnabled ?? prev.reminderEnabled,
          }))}
        />
      )}

      {showConvert && (
        <ConvertModal
          docId={docId} docNum={doc.docNum} docType={doc.type}
          onClose={() => setShowConvert(false)}
          onConverted={handleConverted}
        />
      )}

      {showPayment && (
        <Overlay onClose={() => setShowPayment(false)}>
          <ModalBox title="Record Payment">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ ...fieldLabel, display: "block", marginBottom: 5 }}>Method</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={inputStyle}>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="STRIPE">Stripe / Card</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label style={{ ...fieldLabel, display: "block", marginBottom: 5 }}>Amount ({doc.currency})</label>
                <input type="number" step="0.01" min="0" style={inputStyle}
                  value={payAmount} onChange={e => setPayAmount(e.target.value)}
                  placeholder={`e.g. ${(balanceDue / 100).toFixed(2)}`} />
              </div>
              <div>
                <label style={{ ...fieldLabel, display: "block", marginBottom: 5 }}>Payment Date</label>
                <input type="date" style={inputStyle} value={payDate} onChange={e => setPayDate(e.target.value)} />
              </div>
              <div>
                <label style={{ ...fieldLabel, display: "block", marginBottom: 5 }}>Reference</label>
                <input style={inputStyle} value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Bank ref, Stripe charge ID…" />
              </div>
              <div>
                <label style={{ ...fieldLabel, display: "block", marginBottom: 5 }}>Notes</label>
                <input style={inputStyle} value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Optional" />
              </div>
              {payError && <p style={{ fontSize: 12, color: "#dc2626" }}>{payError}</p>}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <GhostBtn onClick={() => setShowPayment(false)} disabled={payLoading}>Cancel</GhostBtn>
                <PrimaryBtn onClick={recordPayment} disabled={payLoading || !payAmount}>
                  {payLoading ? "Saving…" : "Record Payment"}
                </PrimaryBtn>
              </div>
            </div>
          </ModalBox>
        </Overlay>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function TRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
      <span style={{ fontSize: 12, color: "#6b7280" }}>{label}</span>
      <span style={{ fontSize: bold ? 14 : 13, fontWeight: bold ? 700 : 500, color: color ?? (bold ? "#111827" : "#374151") }}>{value}</span>
    </div>
  );
}

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
