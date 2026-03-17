// app/admin/sales/[id]/print/page.tsx
// Clean print-only view — no admin chrome, optimised for browser print dialog.
// Accessed via /admin/sales/[id]/print — auto-triggers print on load.
"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

interface DocLine {
  id: string; description: string; billingPeriod?: string | null;
  quantity: number; unitPrice: number; discount: number; lineTotal: number;
  product?: { key: string } | null;
}
interface Payment { amountCents: number; paidAt: string; }
interface FullDoc {
  id: string; docNum: string; type: string; status: string;
  currency: string; subtotal: number; vatPercent: number;
  vatAmount: number; total: number;
  subject?: string | null; referenceNumber?: string | null;
  notes?: string | null; termsAndConditions?: string | null;
  issueDate: string; dueDate?: string | null; validUntil?: string | null;
  customer: {
    fullName?: string | null; email: string; customerNumber?: number | null;
    companyName?: string | null; vatTaxId?: string | null;
    commercialRegistrationNumber?: string | null;
    addressLine1?: string | null; city?: string | null; country?: string | null;
  };
  market: {
    key: string; name: string;
    legalInfo: Record<string, unknown> | null;
    companyProfile: Record<string, unknown> | null;
    showPayOnline: boolean; stripePublicKey?: string | null;
  };
  lines: DocLine[];
  payments: Payment[];
}

const TYPE_LABEL: Record<string, string> = {
  RFQ: "RFQ", QUOTATION: "Quotation", PO: "Purchase Order",
  DELIVERY_NOTE: "Delivery Note", PROFORMA: "Proforma Invoice",
  INVOICE: "Tax Invoice", CREDIT_NOTE: "Credit Note",
};
const PERIOD_LABEL: Record<string, string> = {
  MONTHLY: "Monthly", SIX_MONTHS: "6 Months", YEARLY: "Yearly", ONE_TIME: "One-time",
};

function fmt(cents: number, currency: string) {
  const v = (cents / 100).toFixed(2);
  return currency === "SAR"
    ? `SAR ${Number(v).toLocaleString("en-SA", { minimumFractionDigits: 2 })}`
    : `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PrintPage() {
  const params  = useParams();
  const id      = params?.id as string;
  const [doc, setDoc]       = useState<FullDoc | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res  = await fetch(`/api/admin/sales/${id}`);
      const data = await res.json();
      if (data.ok) setDoc(data.doc);
    } catch { /**/ }
    setLoading(false);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading && doc) {
      setTimeout(() => window.print(), 600);
    }
  }, [loading, doc]);

  if (loading || !doc) return (
    <div style={{ padding: 40, fontFamily: "Arial, sans-serif", fontSize: 13, color: "#6b7280" }}>
      {loading ? "Loading…" : "Document not found."}
    </div>
  );

  const li           = (doc.market.legalInfo  ?? {}) as Record<string, unknown>;
  const cp           = (doc.market.companyProfile ?? {}) as Record<string, unknown>;
  const bd           = li.bankDetails as Record<string, unknown> | undefined;
  const primaryColor = String(cp.primaryColor ?? "#318774");
  const typeLabel    = TYPE_LABEL[doc.type] ?? doc.type;
  const isSaudi      = doc.market.key === "SAUDI";
  const showBank     = (doc.type === "PROFORMA" || doc.type === "INVOICE") && bd?.iban;
  const totalPaid    = doc.payments.reduce((s, p) => s + p.amountCents, 0);
  const balanceDue   = doc.total - totalPaid;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Arial, Helvetica, sans-serif; background: #fff; color: #111827; font-size: 13px; }
        @media print {
          @page { margin: 15mm; size: A4; }
          body { font-size: 11px; }
        }
      `}</style>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 40px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            {cp.logoUrl && <img src={String(cp.logoUrl)} alt="" style={{ maxHeight: 40, maxWidth: 140, objectFit: "contain", marginBottom: 6, display: "block" }} />}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{typeLabel}</div>
            <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: primaryColor }}>{doc.docNum}</div>
            <div style={{ fontSize: 10, marginTop: 4, padding: "2px 8px", display: "inline-block", background: "#f3f4f6", color: "#374151" }}>{doc.status}</div>
          </div>
        </div>

        {/* Company */}
        <div style={{ marginBottom: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: primaryColor }}>{String(li.companyName ?? doc.market.name)}</div>
          {li.tagline && <div style={{ fontSize: 11, color: "#6b7280" }}>{String(li.tagline)}</div>}
          <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.7, marginTop: 2 }}>
            {li.address && <span>{String(li.address)}<br /></span>}
            {li.crNumber && <span>CR: {String(li.crNumber)} · </span>}
            {li.vatNumber && <span>VAT: {String(li.vatNumber)}<br /></span>}
            {li.email && <span>{String(li.email)} · </span>}
            {li.phone && <span>{String(li.phone)}</span>}
          </div>
        </div>

        <div style={{ height: 28 }} />

        {/* Bill To + Details */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 32, marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Bill To</div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{doc.customer.fullName ?? doc.customer.email}</div>
            {doc.customer.companyName && <div style={{ fontSize: 11, color: "#6b7280" }}>{doc.customer.companyName}</div>}
            <div style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.7, marginTop: 2 }}>
              {doc.customer.addressLine1 && <span>{doc.customer.addressLine1}<br /></span>}
              {doc.customer.city && <span>{doc.customer.city}<br /></span>}
              {doc.customer.commercialRegistrationNumber && <span>CR: {doc.customer.commercialRegistrationNumber} · </span>}
              {doc.customer.vatTaxId && <span>VAT: {doc.customer.vatTaxId}<br /></span>}
              <span>{doc.customer.email}</span>
            </div>
          </div>
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "0 24px" }}>
              {[
                ["Issue Date", fmtDate(doc.issueDate)],
                ...(doc.dueDate    ? [["Due Date",    fmtDate(doc.dueDate)]]    : []),
                ...(doc.validUntil ? [["Valid Until",  fmtDate(doc.validUntil)]] : []),
                ...(doc.referenceNumber ? [["Reference", doc.referenceNumber]]  : []),
                ["Currency", doc.currency],
                ...(Number(doc.vatPercent) > 0 ? [["VAT", `${Number(doc.vatPercent)}%`]] : []),
              ].map(([l, v]) => (
                <React.Fragment key={l}>
                  <span style={{ fontSize: 11, color: "#6b7280", lineHeight: 1.75 }}>{l}</span>
                  <span style={{ fontSize: 11, lineHeight: 1.75, textAlign: "right" }}>{v}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Subject */}
        {doc.subject && (
          <div style={{ marginBottom: 16, padding: "8px 12px", background: "#f9fafb", borderLeft: `3px solid ${primaryColor}`, fontSize: 12, color: "#374151" }}>
            {doc.subject}
          </div>
        )}

        {/* Lines */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 4 }}>
          <thead>
            <tr style={{ background: primaryColor }}>
              {["#", "Description", "Period", "Qty", "Unit Price", "Disc", "Total"].map((h, i) => (
                <th key={h} style={{
                  padding: "8px 8px", fontSize: 9, fontWeight: 700, color: "#fff",
                  letterSpacing: "0.05em", textTransform: "uppercase",
                  textAlign: i === 0 ? "left" : i <= 2 ? "left" : "right",
                  width: [20, undefined, 70, 36, 90, 44, 95][i],
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={l.id} style={{ borderBottom: "0.5px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#f9fafb" }}>
                <td style={{ padding: "8px 8px", fontSize: 10, color: "#9ca3af" }}>{i + 1}</td>
                <td style={{ padding: "8px 8px" }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}>{l.description}</div>
                  {l.product?.key && <div style={{ fontSize: 9, color: primaryColor, fontFamily: "monospace", marginTop: 1 }}>{l.product.key}</div>}
                </td>
                <td style={{ padding: "8px 8px", fontSize: 11 }}>
                  {l.billingPeriod ? (PERIOD_LABEL[l.billingPeriod] ?? l.billingPeriod) : "—"}
                </td>
                <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11 }}>{Number(l.quantity)}</td>
                <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11 }}>{fmt(l.unitPrice, doc.currency)}</td>
                <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, color: Number(l.discount) > 0 ? "#b45309" : "#9ca3af" }}>
                  {Number(l.discount) > 0 ? `${Number(l.discount)}%` : "—"}
                </td>
                <td style={{ padding: "8px 8px", textAlign: "right", fontFamily: "monospace", fontSize: 11, fontWeight: 700 }}>{fmt(l.lineTotal, doc.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", margin: "16px 0 20px" }}>
          <div style={{ minWidth: 280 }}>
            {[
              ["Subtotal", fmt(doc.subtotal, doc.currency)],
              ...(Number(doc.vatPercent) > 0 ? [[`VAT (${Number(doc.vatPercent)}%)`, fmt(doc.vatAmount, doc.currency)]] : []),
            ].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "0.5px solid #f3f4f6", fontSize: 12 }}>
                <span style={{ color: "#6b7280" }}>{l}</span>
                <span style={{ fontFamily: "monospace", fontWeight: 600 }}>{v}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderTop: `2px solid ${primaryColor}`, marginTop: 4, fontSize: 15, fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ color: primaryColor, fontFamily: "monospace" }}>{fmt(doc.total, doc.currency)}</span>
            </div>
            {totalPaid > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "0.5px solid #f3f4f6", fontSize: 12 }}>
                <span style={{ color: "#15803d" }}>Paid</span>
                <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#15803d" }}>− {fmt(totalPaid, doc.currency)}</span>
              </div>
            )}
            {balanceDue > 0 && totalPaid > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderTop: "1px solid #e5e7eb", marginTop: 5, fontSize: 13, fontWeight: 700 }}>
                <span>Balance Due</span>
                <span style={{ color: "#dc2626", fontFamily: "monospace" }}>{fmt(balanceDue, doc.currency)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "grid", gridTemplateColumns: showBank ? "1fr 1fr" : "1fr", gap: 24, borderTop: "0.5px solid #e5e7eb", paddingTop: 16, marginBottom: 16 }}>
          <div>
            {doc.termsAndConditions && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Terms & Conditions</div>
                <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{doc.termsAndConditions}</div>
              </div>
            )}
            {doc.notes && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Notes</div>
                <div style={{ fontSize: 10, color: "#6b7280", lineHeight: 1.6 }}>{doc.notes}</div>
              </div>
            )}
          </div>
          {showBank && (
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>Bank Details</div>
              <div style={{ display: "grid", gridTemplateColumns: "80px 1fr", gap: "2px 0" }}>
                {bd?.bankName    && <><span style={{ fontSize: 9, color: "#9ca3af" }}>Bank</span><span style={{ fontSize: 10, fontFamily: "monospace" }}>{String(bd.bankName)}</span></>}
                {bd?.accountName && <><span style={{ fontSize: 9, color: "#9ca3af" }}>Account</span><span style={{ fontSize: 10, fontFamily: "monospace" }}>{String(bd.accountName)}</span></>}
                {bd?.iban        && <><span style={{ fontSize: 9, color: "#9ca3af" }}>IBAN</span><span style={{ fontSize: 10, fontFamily: "monospace" }}>{String(bd.iban)}</span></>}
                {bd?.swift       && <><span style={{ fontSize: 9, color: "#9ca3af" }}>SWIFT</span><span style={{ fontSize: 10, fontFamily: "monospace" }}>{String(bd.swift)}</span></>}
              </div>
              {isSaudi && doc.type === "INVOICE" && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#6b7280", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>ZATCA QR Code</div>
                  <div style={{ width: 56, height: 56, border: "0.5px solid #e5e7eb", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="44" height="44" viewBox="0 0 52 52" fill="none">
                      <rect x="2" y="2" width="14" height="14" rx="1" fill="none" stroke="#6b7280" strokeWidth="2"/><rect x="5" y="5" width="8" height="8" fill="#6b7280"/>
                      <rect x="36" y="2" width="14" height="14" rx="1" fill="none" stroke="#6b7280" strokeWidth="2"/><rect x="39" y="5" width="8" height="8" fill="#6b7280"/>
                      <rect x="2" y="36" width="14" height="14" rx="1" fill="none" stroke="#6b7280" strokeWidth="2"/><rect x="5" y="39" width="8" height="8" fill="#6b7280"/>
                      <rect x="20" y="2" width="4" height="4" fill="#6b7280"/><rect x="26" y="2" width="4" height="4" fill="#6b7280"/>
                      <rect x="20" y="20" width="4" height="4" fill="#6b7280"/><rect x="26" y="26" width="4" height="4" fill="#6b7280"/>
                    </svg>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Doc footer line */}
        <div style={{ textAlign: "center", fontSize: 9, color: "#9ca3af", borderTop: "0.5px solid #e5e7eb", paddingTop: 10 }}>
          {String(li.footerText ?? `${li.companyName ?? doc.market.name} · ${li.email ?? ""} · ${li.phone ?? ""}`)}
        </div>
      </div>
    </>
  );
}
