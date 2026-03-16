// app/admin/sales/ui/SalesDetailClient.tsx
// Full document detail view: header info, line items (editable), status controls,
// convert action, payment recording, document chain, internal note.

"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CLR } from "@/components/ui/admin-ui";
import {
  SalesStatusBadge, DocTypeBadge, LineItemsEditor, ConvertModal,
  fmtAmount, Overlay, ModalBox, PrimaryBtn, GhostBtn,
  type LineItem,
} from "./sales-ui";

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

const STATUS_TRANSITIONS: Record<string, string[]> = {
  DRAFT:    ["ISSUED", "VOID"],
  ISSUED:   ["SENT", "ACCEPTED", "REJECTED", "VOID"],
  SENT:     ["ACCEPTED", "REJECTED", "VOID"],
  ACCEPTED: ["CONVERTED", "VOID"],
  PARTIAL:  ["PAID", "OVERDUE", "VOID"],
  OVERDUE:  ["PAID", "VOID"],
};

interface Props { docId: string; docType: string; backHref: string }

export default function SalesDetailClient({ docId, docType, backHref }: Props) {
  const router = useRouter();
  const [doc, setDoc]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  // Edit state
  const [lines, setLines]               = useState<LineItem[]>([]);
  const [notes, setNotes]               = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [dueDate, setDueDate]           = useState("");
  const [editing, setEditing]           = useState(false);

  // Modals
  const [showConvert, setShowConvert]   = useState(false);
  const [showPayment, setShowPayment]   = useState(false);
  const [showVoid, setShowVoid]         = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch(`${ENDPOINT_FOR_TYPE[docType]}/${docId}`);
      const data = await res.json();
      const d    = data.doc;
      setDoc(d);
      setLines(
        (d.lines ?? []).map((l: any) => ({
          id:          l.id,
          productId:   l.productId,
          description: l.description,
          quantity:    Number(l.quantity),
          unitPrice:   l.unitPrice,
          discount:    Number(l.discount),
          lineTotal:   l.lineTotal,
        }))
      );
      setNotes(d.notes ?? "");
      setInternalNote(d.internalNote ?? "");
      setDueDate(d.dueDate ? d.dueDate.split("T")[0] : "");
    } catch { setError("Failed to load document."); }
    setLoading(false);
  }

  useEffect(() => { load(); }, [docId]);

  async function saveChanges() {
    setSaving(true); setError("");
    try {
      const res = await fetch(`${ENDPOINT_FOR_TYPE[docType]}/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes, internalNote, dueDate: dueDate || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditing(false);
      await load();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  async function setStatus(newStatus: string) {
    setSaving(true); setError("");
    try {
      const res = await fetch(`${ENDPOINT_FOR_TYPE[docType]}/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      await load();
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: CLR.faint, fontSize: 13 }}>Loading…</div>
  );
  if (!doc) return (
    <div style={{ padding: 40, textAlign: "center", color: "#dc2626", fontSize: 13 }}>{error || "Document not found."}</div>
  );

  const vatPct = Number(doc.market?.vatPercent ?? doc.vatPercent ?? 0);
  const transitions = STATUS_TRANSITIONS[doc.status] ?? [];

  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.05em",
    textTransform: "uppercase", marginBottom: 8,
  };
  const card: React.CSSProperties = {
    background: "#fff", border: "1px solid #e5e7eb", padding: "20px",
  };
  const fieldLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, color: CLR.faint, letterSpacing: "0.04em",
    marginBottom: 3, textTransform: "uppercase",
  };
  const fieldValue: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: CLR.text };
  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "7px 10px", fontSize: 13,
    border: "1px solid #d1d5db", fontFamily: "inherit",
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button
          onClick={() => router.push(backHref)}
          style={{
            background: "none", border: "1px solid #d1d5db", cursor: "pointer",
            padding: "6px 14px", fontSize: 12, fontWeight: 600, color: CLR.muted, fontFamily: "inherit",
          }}
        >← Back</button>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 11, color: CLR.faint, letterSpacing: "0.05em", marginBottom: 2 }}>
            ADMIN / SALES / {docType.replace(/_/g, " ")}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", fontFamily: "monospace" }}>
              {doc.docNum}
            </h1>
            <DocTypeBadge type={doc.type} />
            <SalesStatusBadge status={doc.status} />
            {doc.market && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "2px 8px",
                background: "#f3f4f6", border: "1px solid #e5e7eb", color: CLR.muted,
              }}>{doc.market.key} · {doc.currency}</span>
            )}
          </div>
        </div>
        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {transitions.map((s) => (
            <button key={s} onClick={() => setStatus(s)} disabled={saving} style={{
              padding: "7px 14px", fontSize: 12, fontWeight: 600,
              background: s === "VOID" ? "#fef2f2" : CLR.primaryBg,
              color: s === "VOID" ? "#dc2626" : CLR.primary,
              border: `1px solid ${s === "VOID" ? "#fecaca" : CLR.primary + "33"}`,
              cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
            }}>→ {s}</button>
          ))}
          {doc.status !== "VOID" && (
            <button onClick={() => setShowConvert(true)} style={{
              padding: "7px 14px", fontSize: 12, fontWeight: 600,
              background: "#fffbeb", color: "#b45309",
              border: "1px solid #fcd34d",
              cursor: "pointer", fontFamily: "inherit",
            }}>Convert ↗</button>
          )}
          {(doc.status === "ISSUED" || doc.status === "PARTIAL" || doc.status === "OVERDUE") && (
            <button onClick={() => setShowPayment(true)} style={{
              padding: "7px 14px", fontSize: 12, fontWeight: 600,
              background: "#dcfce7", color: "#15803d",
              border: "1px solid #86efac",
              cursor: "pointer", fontFamily: "inherit",
            }}>Record Payment</button>
          )}
        </div>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, alignItems: "start" }}>
        {/* LEFT: main content */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Document meta */}
          <div style={card}>
            <p style={sectionLabel}>Document Info</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              <div>
                <p style={fieldLabel}>Issue Date</p>
                <p style={fieldValue}>{fmtDate(doc.issueDate)}</p>
              </div>
              <div>
                <p style={fieldLabel}>Due Date</p>
                {editing ? (
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
                ) : (
                  <p style={fieldValue}>{doc.dueDate ? fmtDate(doc.dueDate) : "—"}</p>
                )}
              </div>
              {doc.paidAt && (
                <div>
                  <p style={fieldLabel}>Paid At</p>
                  <p style={{ ...fieldValue, color: "#15803d" }}>{fmtDate(doc.paidAt)}</p>
                </div>
              )}
              {doc.rfqTitle && (
                <div style={{ gridColumn: "1/-1" }}>
                  <p style={fieldLabel}>RFQ Title</p>
                  <p style={fieldValue}>{doc.rfqTitle}</p>
                </div>
              )}
            </div>
          </div>

          {/* Customer */}
          <div style={card}>
            <p style={sectionLabel}>Customer</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              <div>
                <p style={fieldLabel}>Name</p>
                <p style={fieldValue}>{doc.customer?.fullName ?? "—"}</p>
              </div>
              <div>
                <p style={fieldLabel}>Email</p>
                <p style={fieldValue}>{doc.customer?.email}</p>
              </div>
              <div>
                <p style={fieldLabel}>Customer #</p>
                <p style={{ ...fieldValue, fontFamily: "monospace", color: CLR.primary }}>
                  {doc.customer?.customerNumber ?? "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Line items */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ ...sectionLabel, marginBottom: 0 }}>Line Items</p>
              {doc.status === "DRAFT" && (
                editing ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <GhostBtn onClick={() => { setEditing(false); load(); }} disabled={saving}>Discard</GhostBtn>
                    <PrimaryBtn onClick={saveChanges} disabled={saving}>{saving ? "Saving…" : "Save"}</PrimaryBtn>
                  </div>
                ) : (
                  <button onClick={() => setEditing(true)} style={{
                    fontSize: 12, fontWeight: 600, padding: "5px 14px",
                    background: "#fff", border: "1px solid #d1d5db",
                    color: CLR.text, cursor: "pointer", fontFamily: "inherit",
                  }}>Edit</button>
                )
              )}
            </div>
            <LineItemsEditor
              lines={lines} onChange={setLines}
              currency={doc.currency} vatPercent={vatPct}
              readOnly={!editing}
            />
          </div>

          {/* Notes */}
          <div style={card}>
            <p style={sectionLabel}>Notes</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <p style={fieldLabel}>Customer-visible notes</p>
                {editing ? (
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    rows={4} style={{ ...inputStyle, resize: "vertical" }} />
                ) : (
                  <p style={{ ...fieldValue, color: doc.notes ? CLR.text : CLR.faint, whiteSpace: "pre-wrap" }}>
                    {doc.notes || "—"}
                  </p>
                )}
              </div>
              <div>
                <p style={fieldLabel}>Internal note (admin only)</p>
                {editing ? (
                  <textarea value={internalNote} onChange={(e) => setInternalNote(e.target.value)}
                    rows={4} style={{ ...inputStyle, resize: "vertical", background: "#fffbeb" }} />
                ) : (
                  <p style={{ ...fieldValue, color: doc.internalNote ? CLR.text : CLR.faint, whiteSpace: "pre-wrap" }}>
                    {doc.internalNote || "—"}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Payments */}
          {(doc.payments ?? []).length > 0 && (
            <div style={card}>
              <p style={sectionLabel}>Payments</p>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
                    {["Method","Amount","Reference","Paid At"].map((h) => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: CLR.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {doc.payments.map((p: any) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "9px 12px" }}>{p.method.replace(/_/g, " ")}</td>
                      <td style={{ padding: "9px 12px", fontWeight: 600 }}>{fmtAmount(p.amountCents, p.currency)}</td>
                      <td style={{ padding: "9px 12px", color: CLR.muted, fontFamily: "monospace", fontSize: 12 }}>{p.reference ?? "—"}</td>
                      <td style={{ padding: "9px 12px", color: CLR.muted }}>{fmtDate(p.paidAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* RIGHT: sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Totals summary */}
          <div style={card}>
            <p style={sectionLabel}>Summary</p>
            <SummaryRow label="Subtotal"  value={fmtAmount(doc.subtotal, doc.currency)} />
            {doc.vatPercent > 0 && (
              <SummaryRow label={`VAT (${doc.vatPercent}%)`} value={fmtAmount(doc.vatAmount, doc.currency)} />
            )}
            <SummaryRow label="Total" value={fmtAmount(doc.total, doc.currency)} bold />
          </div>

          {/* Origin doc */}
          {doc.originDoc && (
            <div style={card}>
              <p style={sectionLabel}>Created From</p>
              <button
                onClick={() => router.push(`${DETAIL_BASE[doc.originDoc.type]}/${doc.originDoc.id}`)}
                style={{
                  background: "none", border: "none", cursor: "pointer", padding: 0,
                  fontFamily: "monospace", fontSize: 13, color: CLR.primary, fontWeight: 600,
                }}
              >{doc.originDoc.docNum}</button>
              <p style={{ fontSize: 11, color: CLR.faint, marginTop: 2 }}>
                {doc.originDoc.type.replace(/_/g, " ")}
              </p>
            </div>
          )}

          {/* Derived docs */}
          {(doc.derivedDocs ?? []).length > 0 && (
            <div style={card}>
              <p style={sectionLabel}>Derived Documents</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {doc.derivedDocs.map((d: any) => (
                  <button
                    key={d.id}
                    onClick={() => router.push(`${DETAIL_BASE[d.type]}/${d.id}`)}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 10px", background: "#f9fafb", border: "1px solid #e5e7eb",
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    <span style={{ fontFamily: "monospace", fontSize: 12, color: CLR.primary, fontWeight: 600 }}>
                      {d.docNum}
                    </span>
                    <SalesStatusBadge status={d.status} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* KSA QR */}
          {doc.zatcaQrCode && (
            <div style={card}>
              <p style={sectionLabel}>KSA e-Invoice QR</p>
              <img
                src={`data:image/png;base64,${doc.zatcaQrCode}`}
                alt="ZATCA QR"
                style={{ width: 120, height: 120 }}
              />
              <p style={{ fontSize: 11, color: CLR.faint, marginTop: 4 }}>Phase 1 QR Code</p>
            </div>
          )}
        </div>
      </div>

      {/* Convert modal */}
      {showConvert && (
        <ConvertModal
          docId={doc.id}
          docNum={doc.docNum}
          docType={doc.type}
          onClose={() => setShowConvert(false)}
          onConverted={(newId) => {
            setShowConvert(false);
            load();
          }}
        />
      )}

      {/* Record Payment modal */}
      {showPayment && (
        <RecordPaymentModal
          doc={doc}
          onClose={() => setShowPayment(false)}
          onSaved={() => { setShowPayment(false); load(); }}
        />
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: "6px 0", borderTop: bold ? "2px solid #111827" : "1px solid #f3f4f6",
      fontWeight: bold ? 700 : 400, fontSize: bold ? 14 : 13,
    }}>
      <span style={{ color: CLR.muted }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Record Payment Modal ─────────────────────────────────────────────────────

function RecordPaymentModal({ doc, onClose, onSaved }: { doc: any; onClose: () => void; onSaved: () => void }) {
  const [method, setMethod]       = useState("BANK_TRANSFER");
  const [amount, setAmount]       = useState((doc.total / 100).toFixed(2));
  const [reference, setReference] = useState("");
  const [notes, setNotes]         = useState("");
  const [paidAt, setPaidAt]       = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", fontSize: 13,
    border: "1px solid #d1d5db", fontFamily: "inherit",
  };
  const fieldLabel: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: CLR.muted, marginBottom: 4 };

  async function submit() {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/sales/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId:  doc.id,
          marketId:    doc.marketId,
          method,
          amountCents: Math.round(Number(amount) * 100),
          currency:    doc.currency,
          reference:   reference || null,
          notes:       notes || null,
          paidAt,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <Overlay onClose={onClose}>
      <ModalBox title={`Record Payment — ${doc.docNum}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <p style={fieldLabel}>PAYMENT METHOD</p>
            <select value={method} onChange={(e) => setMethod(e.target.value)} style={inputStyle}>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="STRIPE">Stripe</option>
              <option value="CASH">Cash</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <p style={fieldLabel}>AMOUNT ({doc.currency})</p>
            <input type="number" value={amount} min={0} step={0.01}
              onChange={(e) => setAmount(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <p style={fieldLabel}>REFERENCE / TRANSACTION ID</p>
            <input value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="Bank ref, Stripe charge ID…" style={inputStyle} />
          </div>
          <div>
            <p style={fieldLabel}>PAYMENT DATE</p>
            <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <p style={fieldLabel}>NOTES</p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} style={{ ...inputStyle, resize: "vertical" }} />
          </div>
          {error && <p style={{ fontSize: 12, color: "#dc2626" }}>{error}</p>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
            <GhostBtn onClick={onClose} disabled={loading}>Cancel</GhostBtn>
            <PrimaryBtn onClick={submit} disabled={loading}>
              {loading ? "Saving…" : "Record Payment"}
            </PrimaryBtn>
          </div>
        </div>
      </ModalBox>
    </Overlay>
  );
}
