"use client";
// app/dashboard/sales/[id]/SalesDocClient.tsx

import { useRef, useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/ui/tokens";

interface Line {
  id: string; description: string; descriptionAr: string | null;
  billingPeriod: string | null; quantity: number; unitPrice: number;
  discount: number; lineTotal: number;
  product: { id: string; name: string; key: string } | null;
}
interface Payment {
  id: string; method: string; amountCents: number;
  currency: string; reference: string | null; paidAt: string;
}
interface DocRef { id: string; docNum: string; type: string; status: string; }
interface BankDetails {
  bankName?: string; bankNameAr?: string;
  accountName?: string; accountNumber?: string;
  iban?: string; swift?: string; currency?: string;
  branch?: string; routingNumber?: string;
}
interface Doc {
  id: string; docNum: string; type: string; status: string;
  currency: string; subtotal: number; vatPercent: number;
  vatAmount: number; total: number; amountPaid: number; balance: number;
  subject: string | null; notes: string | null;
  termsAndConditions: string | null; referenceNumber: string | null;
  rfqTitle: string | null; pdfKey: string | null; language: string;
  officialInvoiceUrl: string | null;
  issueDate: string; dueDate: string | null; validUntil: string | null;
  paidAt: string | null; createdAt: string;
  market: {
    name: string; key: string; currency: string;
    vatPercent: number; legalInfo: Record<string, any> | null;
    paymentMethods: string[] | undefined;
    showPayOnline: boolean;
    stripePublicKey: string | null;
    bankDetails: BankDetails | null;
  };
  customer: {
    fullName: string | null; companyName: string | null;
    accountType: string; email: string;
    addressLine1: string | null; addressLine2: string | null;
    district: string | null; city: string | null;
    province: string | null; country: string | null;
    vatTaxId: string | null; crn: string | null;
  };
  lines: Line[]; payments: Payment[];
  paymentNotifications: {
    id: string; amount: string | null; date: string | null;
    reference: string | null; notes: string | null;
    receiptKey: string | null; submittedAt: string;
  }[];
  originDoc: DocRef | null; derivedDocs: DocRef[];
}

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function joinParts(...parts: (string | null | undefined)[]): string | null {
  const r = parts.filter(Boolean).join(", ");
  return r || null;
}

const TYPE_LABELS: Record<string, string> = {
  INVOICE: "Invoice", QUOTATION: "Quotation", PROFORMA: "Proforma Invoice",
  DELIVERY_NOTE: "Delivery Note", CREDIT_NOTE: "Credit Note",
  PO: "Purchase Order", RFQ: "Request for Quotation",
};

const STATUS_TEXT: Record<string, string> = {
  ISSUED: "#185FA5", SENT: "#185FA5", REVISED: "#854F0B",
  ACCEPTED: "#0F6E56", PAID: "#0F6E56", PARTIALLY_PAID: "#0F6E56",
  OVERDUE: "#991b1b", CONVERTED: "#6d28d9", DELIVERED: "#0F6E56",
  PENDING: "#854F0B", REJECTED: "#991b1b", EXPIRED: "#6b7280",
  VOID: "#6b7280", APPLIED: "#0F6E56", CANCELLED: "#991b1b",
};

function StatusText({ status }: { status: string }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_TEXT[status] ?? "#374151", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function FromAddress({ li, marketName }: { li: Record<string, any> | null; marketName: string }) {
  if (!li) return <p style={{ fontSize: 13, color: "#374151" }}>{marketName}</p>;
  return (
    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
      {li.companyName && <div style={{ fontWeight: 600 }}>{li.companyName}</div>}
      {li.address1 && <div>{li.address1}</div>}
      {li.address2 && <div>{li.address2}</div>}
      {joinParts(li.district, li.city) && <div>{joinParts(li.district, li.city)}</div>}
      {joinParts(li.state, li.postalCode) && <div>{joinParts(li.state, li.postalCode)}</div>}
      {li.country && <div>{li.country}</div>}
      {li.phone && <div style={{ marginTop: 4, color: "#6b7280" }}>{li.phone}</div>}
      {li.email && <div style={{ color: "#6b7280" }}>{li.email}</div>}
      {li.taxNumber && <div style={{ marginTop: 4, fontSize: 11, color: "#9ca3af" }}>{li.taxLabel ?? "VAT"}: {li.taxNumber}</div>}
    </div>
  );
}

function ToAddress({ c, taxLabel }: { c: Doc["customer"]; taxLabel: string }) {
  const name = c.accountType === "BUSINESS" ? (c.companyName || c.fullName) : c.fullName;
  return (
    <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
      {name && <div style={{ fontWeight: 600 }}>{name}</div>}
      {c.fullName && c.accountType === "BUSINESS" && c.companyName && c.fullName !== c.companyName && (
        <div style={{ color: "#6b7280" }}>{c.fullName}</div>
      )}
      {c.addressLine1 && <div>{c.addressLine1}</div>}
      {c.addressLine2 && <div>{c.addressLine2}</div>}
      {joinParts(c.district, c.city) && <div>{joinParts(c.district, c.city)}</div>}
      {joinParts(c.province, c.country) && <div>{joinParts(c.province, c.country)}</div>}
      {c.email && <div style={{ marginTop: 4, color: "#6b7280" }}>{c.email}</div>}
      {c.vatTaxId && <div style={{ marginTop: 4, fontSize: 11, color: "#9ca3af" }}>{taxLabel}: {c.vatTaxId}</div>}
      {c.crn && <div style={{ fontSize: 11, color: "#9ca3af" }}>CR: {c.crn}</div>}
    </div>
  );
}

const PERIOD_LABEL: Record<string, string> = {
  MONTHLY: "Monthly", SIX_MONTHS: "6 Months", YEARLY: "Yearly", ONE_TIME: "One-time",
};

function dateItems(doc: Doc) {
  const items = [{ label: "Issue Date", value: fmtDate(doc.issueDate) }];
  if (doc.dueDate)    items.push({ label: "Due Date",    value: fmtDate(doc.dueDate) });
  if (doc.validUntil) items.push({ label: "Valid Until", value: fmtDate(doc.validUntil) });
  if (doc.paidAt)     items.push({ label: "Paid On",     value: fmtDate(doc.paidAt) });
  return items;
}

function backLink(type: string) {
  if (type === "INVOICE" || type === "CREDIT_NOTE") return "/dashboard/invoices";
  if (type === "QUOTATION") return "/dashboard/quotations";
  return "/dashboard/documents";
}

// ── Bank Details Display ──────────────────────────────────────────────────────
function BankDetailsCard({ bd, currency }: { bd: BankDetails; currency: string }) {
  const rows: { label: string; value: string }[] = [
    bd.bankName    ? { label: "Bank",           value: bd.bankName }    : null,
    bd.accountName ? { label: "Account Name",   value: bd.accountName } : null,
    bd.accountNumber? { label: "Account No.",   value: bd.accountNumber }: null,
    bd.iban        ? { label: "IBAN",           value: bd.iban }        : null,
    bd.swift       ? { label: "SWIFT / BIC",    value: bd.swift }       : null,
    bd.branch      ? { label: "Branch",         value: bd.branch }      : null,
    bd.currency    ? { label: "Account Currency", value: bd.currency }  : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return (
    <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: "14px 18px" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Bank Details</p>
      {rows.map(r => (
        <div key={r.label} style={{ display: "flex", gap: 16, marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: "#9ca3af", width: 130, flexShrink: 0 }}>{r.label}</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#111827", fontFamily: "monospace" }}>{r.value}</span>
        </div>
      ))}
      <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 10 }}>
        Please include the invoice number <strong>{currency}</strong> in your payment reference.
      </p>
    </div>
  );
}

// ── Pay Modal ─────────────────────────────────────────────────────────────────
function PayModal({ doc, onClose, onSuccess }: {
  doc: Doc;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const hasBank   = (doc.market.paymentMethods ?? []).includes("BANK_TRANSFER");
  const hasStripe = doc.market.showPayOnline && !!doc.market.stripePublicKey;

  const [mode,      setMode]      = useState<"choose" | "bank" | "stripe">(
    hasBank && !hasStripe ? "bank" : hasStripe && !hasBank ? "stripe" : "choose"
  );
  const [amount,    setAmount]    = useState((doc.balance / 100).toFixed(2));
  const [reference, setReference] = useState("");
  const [date,      setDate]      = useState(new Date().toISOString().split("T")[0]);
  const [notes,     setNotes]     = useState("");
  const [receipt,   setReceipt]   = useState<File | null>(null);
  const [submitting,setSubmitting]= useState(false);
  const [error,     setError]     = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", fontSize: 13,
    border: "1px solid #d1d5db", fontFamily: "inherit",
    outline: "none", boxSizing: "border-box" as const,
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 600,
    color: "#6b7280", textTransform: "uppercase" as const,
    letterSpacing: "0.04em", marginBottom: 5,
  };

  async function submitBank() {
    if (!reference.trim()) { setError("Reference number is required."); return; }
    setSubmitting(true); setError("");
    try {
      const fd = new FormData();
      fd.append("amount", amount);
      fd.append("reference", reference.trim());
      fd.append("date", date);
      fd.append("notes", notes.trim());
      if (receipt) fd.append("receipt", receipt);

      const res  = await fetch(`/api/customer/sales/${doc.id}/pay`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      onSuccess();
    } catch (e: any) { setError(e.message); }
    setSubmitting(false);
  }

  const bd = doc.market.bankDetails;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: "#fff", width: "min(520px, 96vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderTop: `4px solid ${colors.primary}`, background: "#111827", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#fff", margin: 0 }}>Pay Invoice</p>
            <p style={{ fontSize: 12, color: "#9ca3af", margin: 0, marginTop: 2 }}>{doc.docNum} · {fmt(doc.balance, doc.currency)} due</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 20, lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Payment method chooser */}
          {mode === "choose" && (
            <>
              <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Choose how you'd like to pay:</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {hasBank && (
                  <button onClick={() => setMode("bank")}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const, width: "100%" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = colors.primary}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#e5e7eb"}>
                    <div style={{ width: 40, height: 40, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>Bank Transfer</p>
                      <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginTop: 2 }}>Transfer to our bank account and upload your receipt</p>
                    </div>
                    <svg style={{ marginLeft: "auto", flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                )}
                {hasStripe && (
                  <button onClick={() => setMode("stripe")}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontFamily: "inherit", textAlign: "left" as const, width: "100%" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = colors.primary}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#e5e7eb"}>
                    <div style={{ width: 40, height: 40, background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: 0 }}>Pay Online</p>
                      <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginTop: 2 }}>Credit / debit card via Stripe — instant confirmation</p>
                    </div>
                    <svg style={{ marginLeft: "auto", flexShrink: 0 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                )}
              </div>
            </>
          )}

          {/* Bank transfer form */}
          {mode === "bank" && (
            <>
              {(hasBank && hasStripe) && (
                <button onClick={() => setMode("choose")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#6b7280", padding: 0, fontFamily: "inherit" }}>
                  ← Back to payment options
                </button>
              )}

              {/* Bank details */}
              {bd && <BankDetailsCard bd={bd} currency={doc.docNum} />}
              {!bd && (
                <div style={{ padding: "12px 16px", background: "#fffbeb", border: "1px solid #fcd34d", fontSize: 13, color: "#92400e" }}>
                  Please contact us for our bank details before transferring.
                </div>
              )}

              <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", margin: 0 }}>After transferring, fill in the details below:</p>

              {/* Amount */}
              <div>
                <label style={lbl}>Amount Paid ({doc.currency})</label>
                <input type="number" step="0.01" min="0" style={inp}
                  value={amount} onChange={e => setAmount(e.target.value)} />
              </div>

              {/* Date */}
              <div>
                <label style={lbl}>Transfer Date</label>
                <input type="date" style={inp} value={date} onChange={e => setDate(e.target.value)} />
              </div>

              {/* Reference */}
              <div>
                <label style={lbl}>Transfer Reference / Transaction ID <span style={{ color: "#dc2626" }}>*</span></label>
                <input style={inp} value={reference} onChange={e => setReference(e.target.value)}
                  placeholder="Bank reference or transaction ID" />
              </div>

              {/* Notes */}
              <div>
                <label style={lbl}>Additional Notes <span style={{ fontSize: 10, fontWeight: 400 }}>(optional)</span></label>
                <textarea style={{ ...inp, height: 72, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Any additional information…" />
              </div>

              {/* Receipt upload */}
              <div>
                <label style={lbl}>Payment Receipt <span style={{ fontSize: 10, fontWeight: 400 }}>(optional — PDF, JPG, PNG)</span></label>
                {receipt ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    <span style={{ fontSize: 13, flex: 1, color: "#15803d", fontWeight: 500 }}>{receipt.name}</span>
                    <button type="button" onClick={() => setReceipt(null)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 16, lineHeight: 1 }}>×</button>
                  </div>
                ) : (
                  <div onClick={() => fileRef.current?.click()}
                    style={{ border: "2px dashed #d1d5db", padding: "16px", textAlign: "center", cursor: "pointer", background: "#fafafa" }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = colors.primary}
                    onMouseLeave={e => e.currentTarget.style.borderColor = "#d1d5db"}>
                    <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>Click to upload receipt</p>
                    <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, marginBottom: 0 }}>PDF, JPG, PNG — max 10 MB</p>
                  </div>
                )}
                <input ref={fileRef} type="file" style={{ display: "none" }}
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={e => setReceipt(e.target.files?.[0] ?? null)} />
              </div>

              {error && (
                <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 }}>{error}</div>
              )}

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={onClose} style={{ padding: "9px 18px", fontSize: 13, background: "#fff", border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit", color: "#374151" }}>Cancel</button>
                <button onClick={submitBank} disabled={submitting}
                  style={{ padding: "9px 20px", fontSize: 13, fontWeight: 600, background: submitting ? "#9ca3af" : colors.primary, color: "#fff", border: "none", cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                  {submitting ? "Submitting…" : "Submit Payment Notification"}
                </button>
              </div>
            </>
          )}

          {/* Stripe */}
          {mode === "stripe" && (
            <>
              {(hasBank && hasStripe) && (
                <button onClick={() => setMode("choose")} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#6b7280", padding: 0, fontFamily: "inherit" }}>
                  ← Back to payment options
                </button>
              )}
              <div style={{ padding: "20px", textAlign: "center", border: "1px solid #e5e7eb" }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>💳</div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 6 }}>Pay {fmt(doc.balance, doc.currency)} online</p>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>You'll be redirected to Stripe's secure payment page.</p>
                <a href={`/api/customer/sales/${doc.id}/stripe-checkout`}
                  style={{ display: "inline-block", padding: "10px 24px", background: "#635BFF", color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none", fontFamily: "inherit" }}>
                  Continue to Stripe →
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Payment Options Info Panel (shown below totals on invoice) ────────────────
function PaymentOptionsPanel({ doc }: { doc: Doc }) {
  const methods   = doc.market.paymentMethods ?? [];
  const hasBank   = methods.includes("BANK_TRANSFER");
  const hasStripe = doc.market.showPayOnline && !!doc.market.stripePublicKey;
  const hasCash   = methods.includes("CASH");
  const hasOther  = methods.includes("OTHER");

  if (!hasBank && !hasStripe && !hasCash && !hasOther) return null;

  return (
    <div style={{ borderTop: "1px solid #e5e7eb", padding: "18px 24px" }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>Payment Options</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {hasBank && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, background: "#f0fdf4", border: "1px solid #bbf7d0", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              </div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Bank Transfer</span>
            </div>
            {doc.market.bankDetails ? (
              <BankDetailsCard bd={doc.market.bankDetails} currency={doc.docNum} />
            ) : (
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Contact us for bank details.</p>
            )}
          </div>
        )}
        {hasStripe && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, background: "#eff6ff", border: "1px solid #bfdbfe", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Online Payment</span>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Credit / debit card via Stripe — click "Pay Now" above.</p>
            </div>
          </div>
        )}
        {hasCash && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, background: "#fffbeb", border: "1px solid #fde68a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Cash Payment</span>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Contact us to arrange a cash payment.</p>
            </div>
          </div>
        )}
        {hasOther && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, background: "#f9fafb", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            </div>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Other</span>
              <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>Contact us to discuss alternative payment methods.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Customer receipt download ─────────────────────────────────────────────────
function CustomerReceiptBtn({ docId, receiptKey }: { docId: string; receiptKey: string }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function open() {
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/customer/sales/${docId}/receipt?key=${encodeURIComponent(receiptKey)}`);
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error ?? "Failed");
      window.open(data.url, "_blank");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button onClick={open} disabled={loading}
        style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}>
        {loading ? "Loading…" : "↓ Download Receipt"}
      </button>
      {error && <span style={{ fontSize: 10, color: "#dc2626" }}>{error}</span>}
    </span>
  );
}

// ── Payment Submissions Section ───────────────────────────────────────────────
function PaymentSubmissionsSection({ doc }: { doc: Doc }) {
  const notifications = doc.paymentNotifications;
  if (!notifications.length) return null;

  const isPaid    = ["PAID", "PARTIALLY_PAID", "APPLIED"].includes(doc.status);
  const isUnpaid  = ["ISSUED","SENT","PARTIALLY_PAID","OVERDUE"].includes(doc.status);

  return (
    <div style={{ borderTop: "1px solid #e5e7eb" }}>
      <div style={{ padding: "14px 24px 0" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
          Your Payment Submissions
        </p>
      </div>

      {notifications.map((n, i) => (
        <div key={n.id} style={{ padding: "0 24px 14px", borderBottom: i < notifications.length - 1 ? "1px solid #f3f4f6" : "none", marginBottom: i < notifications.length - 1 ? 14 : 0 }}>
          {/* Header row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", background: isPaid ? "#f0fdf4" : "#fffbeb", border: `1px solid ${isPaid ? "#86efac" : "#fcd34d"}`, color: isPaid ? "#15803d" : "#92400e" }}>
              {isPaid ? "✓ Verified" : "⏳ Pending Verification"}
            </span>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              Submitted {new Date(n.submittedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>

          {/* Details grid */}
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: "12px 16px", display: "grid", gridTemplateColumns: "120px 1fr", gap: "6px 0", fontSize: 12 }}>
            {n.amount && (
              <>
                <span style={{ color: "#9ca3af" }}>Amount</span>
                <span style={{ fontWeight: 700, color: "#111827" }}>{n.amount}</span>
              </>
            )}
            {n.date && (
              <>
                <span style={{ color: "#9ca3af" }}>Transfer Date</span>
                <span style={{ color: "#374151" }}>{n.date}</span>
              </>
            )}
            {n.reference && (
              <>
                <span style={{ color: "#9ca3af" }}>Reference</span>
                <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#111827" }}>{n.reference}</span>
              </>
            )}
            {n.notes && (
              <>
                <span style={{ color: "#9ca3af" }}>Notes</span>
                <span style={{ color: "#374151" }}>{n.notes}</span>
              </>
            )}
            <span style={{ color: "#9ca3af" }}>Receipt</span>
            {n.receiptKey ? (
              <CustomerReceiptBtn docId={doc.id} receiptKey={n.receiptKey} />
            ) : (
              <span style={{ color: "#9ca3af", fontStyle: "italic" }}>Not uploaded</span>
            )}
          </div>

          {!isPaid && i === 0 && (
            <p style={{ fontSize: 11, color: "#6b7280", marginTop: 8 }}>
              Our team is reviewing your payment. Once verified, your invoice status will be updated automatically.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function SalesDocClient({ doc }: { doc: Doc }) {
  const [pdfDownloading, setPdfDownloading] = useState(false);
  const [accepting,      setAccepting]      = useState(false);
  const [acceptDone,     setAcceptDone]     = useState(false);
  const [acceptErr,      setAcceptErr]      = useState<string | null>(null);
  const [showPayModal,   setShowPayModal]   = useState(false);
  const [paySuccess,     setPaySuccess]     = useState(false);

  const needsOfficialPdf = doc.market.key === "SAUDI" && ["INVOICE","CREDIT_NOTE"].includes(doc.type);
  const hasOfficialPdf   = !!doc.officialInvoiceUrl;
  const typeLabel        = needsOfficialPdf
    ? (doc.type === "INVOICE" ? "Invoice Memo" : "Credit Note Memo")
    : (TYPE_LABELS[doc.type] ?? doc.type);
  const downloadLabel    = needsOfficialPdf ? "ZATCA e-Invoice Download" : "Download PDF";
  const canDownload      = needsOfficialPdf ? hasOfficialPdf : true;
  const canAccept        = doc.type === "QUOTATION" && ["ISSUED","SENT","REVISED"].includes(doc.status) && !acceptDone;
  const back             = backLink(doc.type);
  const showBalance      = doc.type === "INVOICE" || doc.type === "CREDIT_NOTE";
  const showPayments     = showBalance && doc.payments.length > 0;

  // Show Pay Now button: invoice, unpaid, and at least one payment method available
  const isUnpaid      = ["ISSUED","SENT","PARTIALLY_PAID","OVERDUE"].includes(doc.status);
  const hasPayMethod  = (doc.market.paymentMethods ?? []).length > 0 || (doc.market.showPayOnline && !!doc.market.stripePublicKey);
  const hasPendingSubmission = doc.paymentNotifications.length > 0 && isUnpaid;
  const showPayBtn    = doc.type === "INVOICE" && isUnpaid && hasPayMethod && !paySuccess && !hasPendingSubmission;

  async function downloadPdf() {
    setPdfDownloading(true);
    try {
      const res = await fetch(`/api/customer/sales/${doc.id}/pdf`);
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href; a.download = `${doc.docNum}.pdf`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(href);
    } catch { alert("PDF download failed"); }
    setPdfDownloading(false);
  }

  async function handleAccept() {
    if (!confirm(`Accept ${doc.docNum}?`)) return;
    setAccepting(true); setAcceptErr(null);
    try {
      const res  = await fetch(`/api/customer/sales/${doc.id}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setAcceptErr(data.error ?? "Failed"); return; }
      setAcceptDone(true);
    } catch { setAcceptErr("Network error."); }
    setAccepting(false);
  }

  return (
    <div className="cy-page-content">
      <div className="cy-dash-wrap" style={{ maxWidth: 860 }}>

        {/* Back */}
        <div style={{ marginBottom: 16 }}>
          <Link href={back} style={{ fontSize: 12, color: "#6b7280", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}>← Back</Link>
        </div>

        {/* Pay success banner */}
        {paySuccess && (
          <div style={{ marginBottom: 16, padding: "12px 18px", background: "#f0fdf4", border: "1px solid #86efac", color: "#15803d", fontSize: 13, fontWeight: 500 }}>
            ✓ Payment notification submitted. Our team will verify and update your invoice shortly.
          </div>
        )}

        {/* Pending verification banner */}
        {hasPendingSubmission && !paySuccess && (
          <div style={{ marginBottom: 16, padding: "12px 18px", background: "#fffbeb", border: "1px solid #fcd34d", display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>⏳</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#92400e", margin: "0 0 2px" }}>Payment Notification Pending Verification</p>
              <p style={{ fontSize: 12, color: "#b45309", margin: 0 }}>
                You have already submitted a payment notification. Our team is reviewing it.
                Once verified, your invoice status will be updated automatically.
              </p>
            </div>
          </div>
        )}

        {/* Document card */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ padding: "16px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0, fontFamily: "monospace" }}>{doc.docNum}</h1>
                <StatusText status={doc.status} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>{typeLabel}</span>
              </div>
              {doc.subject && <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4, marginBottom: 0 }}>{doc.subject}</p>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {canAccept && (
                <button onClick={handleAccept} disabled={accepting}
                  style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 16px", background: colors.primary, color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: accepting ? "not-allowed" : "pointer", opacity: accepting ? 0.7 : 1 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {accepting ? "Accepting…" : "Accept Quotation"}
                </button>
              )}
              {acceptDone && doc.type === "QUOTATION" && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", background: "#e8f5f0", color: "#0F6E56", fontSize: 13, fontWeight: 600 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Accepted
                </div>
              )}

              {/* Pay Now button */}
              {showPayBtn && (
                <button onClick={() => setShowPayModal(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 16px", background: "#15803d", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                  Pay Now
                </button>
              )}

              {/* Download */}
              {canDownload ? (
                <button onClick={downloadPdf} disabled={pdfDownloading}
                  style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", background: "#fff", border: "1px solid #e5e7eb", fontSize: 13, color: "#374151", cursor: pdfDownloading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: pdfDownloading ? 0.6 : 1 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M1 11v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {pdfDownloading ? "Downloading…" : downloadLabel}
                </button>
              ) : needsOfficialPdf && !hasOfficialPdf ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", background: "#fffbeb", border: "1px solid #fcd34d", fontSize: 12, color: "#b45309", fontWeight: 500 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  Invoice being processed
                </div>
              ) : null}
            </div>
          </div>

          {acceptErr && (
            <div style={{ padding: "10px 24px", background: "#fdf0ef", borderBottom: "1px solid #fca5a5", fontSize: 13, color: "#991b1b" }}>{acceptErr}</div>
          )}

          {/* Date strip */}
          <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", flexWrap: "wrap" }}>
            {dateItems(doc).map((item, i) => (
              <div key={i} style={{ padding: "12px 24px", borderRight: "1px solid #f3f4f6", flex: 1, minWidth: 110 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 13, color: "#111827", fontWeight: 500 }}>{item.value}</div>
              </div>
            ))}
          </div>

          {/* From / Bill To */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ padding: "18px 24px", borderRight: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>From</div>
              <FromAddress li={doc.market.legalInfo} marketName={doc.market.name} />
            </div>
            <div style={{ padding: "18px 24px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Bill To</div>
              <ToAddress c={doc.customer} taxLabel={(doc.market.legalInfo as Record<string, any> | null)?.taxLabel ?? "VAT"} />
            </div>
          </div>

          {/* Line items */}
          <div style={{ borderBottom: "1px solid #e5e7eb", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Description", "Period", "Qty", "Unit Price", "Disc", "Total"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: h === "Description" ? "left" : "right", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {doc.lines.map((l, i) => (
                  <tr key={l.id} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 16px", color: "#111827" }}>
                      <div style={{ fontWeight: 500 }}>{l.description}</div>
                      {l.descriptionAr && <div style={{ fontSize: 11, color: "#9ca3af", direction: "rtl", textAlign: "right" }}>{l.descriptionAr}</div>}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" }}>{l.billingPeriod ? (PERIOD_LABEL[l.billingPeriod] ?? l.billingPeriod) : "—"}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#374151" }}>{l.quantity}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#374151", whiteSpace: "nowrap" }}>{fmt(l.unitPrice, doc.currency)}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", color: "#9ca3af" }}>{l.discount > 0 ? `${l.discount}%` : "—"}</td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>{fmt(l.lineTotal, doc.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 24px", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ minWidth: 280 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "#6b7280" }}>
                <span>Subtotal</span><span>{fmt(doc.subtotal, doc.currency)}</span>
              </div>
              {doc.vatPercent > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 13, color: "#6b7280" }}>
                  <span>VAT ({doc.vatPercent}%)</span><span>{fmt(doc.vatAmount, doc.currency)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", borderTop: "2px solid #111827", marginTop: 4, fontSize: 15, fontWeight: 700, color: "#111827" }}>
                <span>Total</span><span>{fmt(doc.total, doc.currency)}</span>
              </div>
              {showBalance && doc.amountPaid > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 0", fontSize: 13, color: "#15803d" }}>
                    <span>Amount Paid</span><span>− {fmt(doc.amountPaid, doc.currency)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0 0", borderTop: "1px solid #f3f4f6", marginTop: 4, fontSize: 14, fontWeight: 700, color: doc.balance > 0 ? "#b45309" : "#0F6E56" }}>
                    <span>Balance Due</span><span>{fmt(doc.balance, doc.currency)}</span>
                  </div>
                </>
              )}
              {showBalance && doc.amountPaid === 0 && doc.total > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 0", borderTop: "1px solid #f3f4f6", marginTop: 4, fontSize: 14, fontWeight: 700, color: "#b45309" }}>
                  <span>Balance Due</span><span>{fmt(doc.total, doc.currency)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Payments received */}
          {showPayments && (
            <div style={{ borderBottom: "1px solid #e5e7eb" }}>
              <div style={{ padding: "12px 24px 0", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Payments Received</div>
              {doc.payments.map((p, idx) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 24px", borderTop: idx === 0 ? "none" : "1px solid #f9fafb" }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{p.method.replace(/_/g, " ")}</span>
                    {p.reference && <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>Ref: {p.reference}</span>}
                    <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>{fmtDate(p.paidAt)}</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#15803d" }}>{fmt(p.amountCents, p.currency)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Payment options panel — only for unpaid invoices with no pending submission */}
          {doc.type === "INVOICE" && isUnpaid && !hasPendingSubmission && (
            <PaymentOptionsPanel doc={doc} />
          )}

          {/* Payment submissions — customer's own submissions */}
          {doc.type === "INVOICE" && (
            <PaymentSubmissionsSection doc={doc} />
          )}

          {/* Notes */}
          {doc.notes && (
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e7eb" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Notes</p>
              <p style={{ fontSize: 13, color: "#374151", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{doc.notes}</p>
            </div>
          )}

          {/* Terms */}
          {doc.termsAndConditions && (
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e5e7eb" }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Terms &amp; Conditions</p>
              <p style={{ fontSize: 12, color: "#6b7280", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{doc.termsAndConditions}</p>
            </div>
          )}
        </div>

        {/* Related docs */}
        {(doc.originDoc || doc.derivedDocs.length > 0) && (
          <div style={{ marginTop: 16, padding: "14px 18px", background: "#f9fafb", border: "1px solid #e5e7eb" }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Related Documents</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {doc.originDoc && (
                <Link href={`/dashboard/sales/${doc.originDoc.id}`}
                  style={{ fontSize: 12, padding: "4px 12px", background: "#fff", border: "1px solid #e5e7eb", color: "#374151", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  ← {doc.originDoc.type.replace(/_/g, " ")} {doc.originDoc.docNum}
                </Link>
              )}
              {doc.derivedDocs.map(d => (
                <Link key={d.id} href={`/dashboard/sales/${d.id}`}
                  style={{ fontSize: 12, padding: "4px 12px", background: "#fff", border: "1px solid #e5e7eb", color: "#374151", textDecoration: "none" }}>
                  {d.type.replace(/_/g, " ")} {d.docNum} →
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* Pay modal */}
      {showPayModal && (
        <PayModal
          doc={doc}
          onClose={() => setShowPayModal(false)}
          onSuccess={() => { setShowPayModal(false); setPaySuccess(true); }}
        />
      )}
    </div>
  );
}
