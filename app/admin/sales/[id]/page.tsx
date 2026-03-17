// app/admin/sales/[id]/page.tsx
"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { CLR } from "@/components/ui/admin-ui";
import { Icon } from "@/components/ui/Icon";
import { fmtAmount, SalesStatusBadge, DocTypeBadge } from "../ui/sales-ui";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DocLine {
  id: string; description: string; descriptionAr?: string | null;
  billingPeriod?: string | null; quantity: number;
  unitPrice: number; discount: number; lineTotal: number; sortOrder: number;
  product?: { id: string; key: string; name: string; nameAr?: string | null } | null;
}

interface FullDoc {
  id: string; docNum: string; type: string; status: string;
  currency: string; subtotal: number; vatPercent: number;
  vatAmount: number; total: number;
  subject?: string | null; referenceNumber?: string | null;
  notes?: string | null; internalNote?: string | null;
  termsAndConditions?: string | null;
  issueDate: string; dueDate?: string | null;
  emailSentAt?: string | null; emailSentCount?: number | null;
  createdAt: string; updatedAt: string;
  customer: {
    id: string; fullName?: string | null; email: string;
    customerNumber?: number | null; companyName?: string | null;
    market: { id: string; key: string; name: string; defaultCurrency: string };
  };
  market: { id: string; key: string; name: string; defaultCurrency: string };
  lines: DocLine[];
  originDoc?: { id: string; docNum: string; type: string } | null;
  derivedDocs?: { id: string; docNum: string; type: string; status: string }[];
}

const PERIOD_LABEL: Record<string, string> = {
  MONTHLY: "Monthly", SIX_MONTHS: "6 Months", YEARLY: "Yearly", ONE_TIME: "One-time",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Print styles injected into head ──────────────────────────────────────────

const PRINT_CSS = `
@media print {
  body * { visibility: hidden !important; }
  #print-area, #print-area * { visibility: visible !important; }
  #print-area { position: fixed !important; top: 0 !important; left: 0 !important; width: 100% !important; }
  .no-print { display: none !important; }
}
`;

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function SalesDocDetailPage() {
  const params  = useParams();
  const router  = useRouter();
  const id      = params?.id as string;

  const [doc, setDoc]           = useState<FullDoc | null>(null);
  const [loading, setLoading]   = useState(true);
  const [sending, setSending]   = useState(false);
  const [sendMsg, setSendMsg]   = useState<{ ok: boolean; text: string } | null>(null);

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

  // Inject print CSS once
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = PRINT_CSS;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  async function sendEmail() {
    if (!doc) return;
    setSending(true); setSendMsg(null);
    try {
      const res  = await fetch(`/api/admin/sales/${id}/send-email`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSendMsg({ ok: true, text: "Email sent successfully" });
      await load(); // refresh to get updated emailSentAt
    } catch (e: any) {
      setSendMsg({ ok: false, text: e.message });
    }
    setSending(false);
  }

  function printDoc() {
    window.print();
  }

  if (loading) return (
    <div style={{ padding: 48, textAlign: "center", fontSize: 13, color: CLR.faint }}>Loading…</div>
  );

  if (!doc) return (
    <div style={{ padding: 48, textAlign: "center", fontSize: 13, color: "#dc2626" }}>Document not found.</div>
  );

  const hasSentEmail   = (doc.emailSentCount ?? 0) > 0;
  const sentCount      = doc.emailSentCount ?? 0;
  const lastSentLabel  = doc.emailSentAt ? `Last sent ${fmtDateTime(doc.emailSentAt)}` : "";

  return (
    <div style={{ fontFamily: "'Geist', -apple-system, sans-serif", background: "#f5f5f5", minHeight: "100vh" }}>

      {/* Top bar */}
      <div className="no-print" style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 13, color: CLR.muted, fontFamily: "inherit", padding: 0 }}>
          <Icon name="chevron" size={14} color={CLR.muted} />
          Back
        </button>

        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15, fontFamily: "monospace", color: CLR.primary }}>{doc.docNum}</span>
          <DocTypeBadge type={doc.type} />
          <SalesStatusBadge status={doc.status} />
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

          {/* Send / Resend email */}
          <div style={{ position: "relative" }}>
            <button
              onClick={sendEmail}
              disabled={sending}
              title={lastSentLabel}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 16px", fontSize: 12, fontWeight: 600,
                background: hasSentEmail ? "#fffbeb" : CLR.primary,
                color: hasSentEmail ? "#92400e" : "#fff",
                border: hasSentEmail ? "1px solid #fcd34d" : "none",
                cursor: sending ? "not-allowed" : "pointer",
                fontFamily: "inherit",
              }}>
              <Icon name="mail" size={14} color={hasSentEmail ? "#92400e" : "#fff"} />
              {sending ? "Sending…" : hasSentEmail ? `Resend${sentCount > 1 ? ` (${sentCount})` : ""}` : "Send Email"}
            </button>
            {lastSentLabel && (
              <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 4, fontSize: 10, color: CLR.faint, whiteSpace: "nowrap", background: "#fff", border: "1px solid #e5e7eb", padding: "3px 8px", zIndex: 10 }}>
                {lastSentLabel}
              </div>
            )}
          </div>

          {/* Print / PDF */}
          <button
            onClick={printDoc}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "8px 16px", fontSize: 12, fontWeight: 600,
              background: "#fff", color: CLR.text,
              border: "1px solid #d1d5db",
              cursor: "pointer", fontFamily: "inherit",
            }}>
            <Icon name="fileText" size={14} color={CLR.muted} />
            Download PDF
          </button>
        </div>
      </div>

      {/* Send message */}
      {sendMsg && (
        <div className="no-print" style={{
          margin: "12px 24px 0",
          padding: "10px 16px",
          background: sendMsg.ok ? "#f0fdf4" : "#fef2f2",
          border: `1px solid ${sendMsg.ok ? "#86efac" : "#fecaca"}`,
          color: sendMsg.ok ? "#15803d" : "#dc2626",
          fontSize: 13, fontWeight: 600,
        }}>
          {sendMsg.ok ? "✓ " : "✗ "}{sendMsg.text}
        </div>
      )}

      {/* Printable document */}
      <div id="print-area" style={{ maxWidth: 860, margin: "24px auto", padding: "0 24px 40px" }}>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "40px 48px" }}>

          {/* Document header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
                {doc.type.replace(/_/g, " ")}
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "monospace", color: CLR.primary, letterSpacing: "-0.02em" }}>
                {doc.docNum}
              </div>
              {doc.subject && (
                <div style={{ fontSize: 14, color: CLR.muted, marginTop: 6 }}>{doc.subject}</div>
              )}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: CLR.text, letterSpacing: "-0.02em" }}>
                {doc.market.name}
              </div>
              <SalesStatusBadge status={doc.status} />
            </div>
          </div>

          {/* Meta grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Bill To</p>
              <p style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{doc.customer.fullName ?? doc.customer.email}</p>
              {doc.customer.companyName && <p style={{ fontSize: 13, color: CLR.muted }}>{doc.customer.companyName}</p>}
              <p style={{ fontSize: 13, color: CLR.muted }}>{doc.customer.email}</p>
              <p style={{ fontSize: 11, color: CLR.faint, fontFamily: "monospace", marginTop: 2 }}>#{doc.customer.customerNumber}</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "4px 16px", justifyContent: "end" }}>
                <span style={{ fontSize: 12, color: CLR.muted }}>Issue Date</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>{fmtDate(doc.issueDate)}</span>
                {doc.dueDate && <>
                  <span style={{ fontSize: 12, color: CLR.muted }}>Due Date</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#b45309" }}>{fmtDate(doc.dueDate)}</span>
                </>}
                {doc.referenceNumber && <>
                  <span style={{ fontSize: 12, color: CLR.muted }}>Reference</span>
                  <span style={{ fontSize: 12, fontFamily: "monospace" }}>{doc.referenceNumber}</span>
                </>}
                <span style={{ fontSize: 12, color: CLR.muted }}>Currency</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: CLR.primary }}>{doc.currency}</span>
              </div>
            </div>
          </div>

          {/* Line items */}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 24 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Description</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Period</th>
                <th style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Qty</th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Unit Price</th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Disc %</th>
                <th style={{ padding: "10px 12px", textAlign: "right", fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, i) => (
                <tr key={l.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontWeight: 500 }}>{l.description}</div>
                    {l.product && (
                      <div style={{ fontSize: 11, color: CLR.faint, fontFamily: "monospace", marginTop: 1 }}>{l.product.key}</div>
                    )}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 12, color: CLR.muted }}>
                    {l.billingPeriod ? (PERIOD_LABEL[l.billingPeriod] ?? l.billingPeriod) : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>{Number(l.quantity)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontFamily: "monospace" }}>{fmtAmount(l.unitPrice, doc.currency)}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", color: Number(l.discount) > 0 ? "#b45309" : CLR.faint }}>
                    {Number(l.discount) > 0 ? `${Number(l.discount)}%` : "—"}
                  </td>
                  <td style={{ padding: "10px 12px", textAlign: "right", fontWeight: 600 }}>{fmtAmount(l.lineTotal, doc.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 32 }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid #f3f4f6", fontSize: 13 }}>
                <span style={{ color: CLR.muted }}>Subtotal</span>
                <span>{fmtAmount(doc.subtotal, doc.currency)}</span>
              </div>
              {Number(doc.vatPercent) > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: "1px solid #f3f4f6", fontSize: 13 }}>
                  <span style={{ color: CLR.muted }}>VAT ({Number(doc.vatPercent)}%)</span>
                  <span>{fmtAmount(doc.vatAmount, doc.currency)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderTop: "2px solid #111827", fontSize: 16, fontWeight: 800 }}>
                <span>Total</span>
                <span style={{ color: CLR.primary }}>{fmtAmount(doc.total, doc.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes / Terms */}
          {(doc.notes || doc.termsAndConditions) && (
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 20, display: "grid", gridTemplateColumns: doc.notes && doc.termsAndConditions ? "1fr 1fr" : "1fr", gap: 20 }}>
              {doc.notes && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Notes</p>
                  <p style={{ fontSize: 13, color: CLR.muted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{doc.notes}</p>
                </div>
              )}
              {doc.termsAndConditions && (
                <div>
                  <p style={{ fontSize: 10, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Terms &amp; Conditions</p>
                  <p style={{ fontSize: 13, color: CLR.muted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{doc.termsAndConditions}</p>
                </div>
              )}
            </div>
          )}

          {/* Internal note — no-print */}
          {doc.internalNote && (
            <div className="no-print" style={{ marginTop: 20, padding: "12px 16px", background: "#fffbeb", border: "1px solid #fcd34d", fontSize: 12, color: "#92400e" }}>
              <strong>Internal note (admin only):</strong> {doc.internalNote}
            </div>
          )}

          {/* Document chain */}
          {(doc.originDoc || (doc.derivedDocs && doc.derivedDocs.length > 0)) && (
            <div className="no-print" style={{ marginTop: 20, padding: "12px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 12 }}>
              {doc.originDoc && (
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: CLR.muted }}>Origin: </span>
                  <span style={{ fontFamily: "monospace", color: CLR.primary, fontWeight: 600 }}>{doc.originDoc.docNum}</span>
                  <span style={{ color: CLR.faint, marginLeft: 6 }}>({doc.originDoc.type})</span>
                </div>
              )}
              {doc.derivedDocs && doc.derivedDocs.length > 0 && (
                <div>
                  <span style={{ color: CLR.muted }}>Derived: </span>
                  {doc.derivedDocs.map(d => (
                    <span key={d.id} style={{ fontFamily: "monospace", color: CLR.primary, fontWeight: 600, marginRight: 8 }}>{d.docNum}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
