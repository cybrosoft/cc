// REPLACE the existing RecordPaymentModal function in app/admin/sales/ui/SalesListPage.tsx
// with this complete updated version that adds receipt upload support.
//
// Also add `useRef` to the imports at the top if not already there.
// The top import line should be:
// import React, { useEffect, useState, useCallback, useRef } from "react";

function RecordPaymentModal({ docId, docNum, currency, total, marketId, onClose, onSaved }: {
  docId: string; docNum: string; currency: string; total: number; marketId: string;
  onClose: () => void; onSaved: () => void;
}) {
  const [method,    setMethod]    = useState("BANK_TRANSFER");
  const [amount,    setAmount]    = useState((total / 100).toFixed(2));
  const [reference, setReference] = useState("");
  const [notes,     setNotes]     = useState("");
  const [paidAt,    setPaidAt]    = useState(new Date().toISOString().split("T")[0]);
  const [receipt,   setReceipt]   = useState<File | null>(null);
  const receiptRef = useRef<HTMLInputElement>(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState("");

  const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", fontFamily: "inherit", boxSizing: "border-box" as const };
  const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block", textTransform: "uppercase" as const, letterSpacing: "0.04em" };

  async function submit() {
    setLoading(true); setError("");
    try {
      // Upload receipt first if provided
      let receiptUrl: string | null = null;
      if (receipt) {
        const fd = new FormData();
        fd.append("file", receipt);
        fd.append("docType", "INVOICE");
        const upRes  = await fetch("/api/admin/sales/upload", { method: "POST", body: fd });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error ?? "Receipt upload failed");
        receiptUrl = upData.key ?? upData.url;
      }

      const res = await fetch("/api/admin/sales/billing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: docId, marketId, method,
          amountCents: Math.round(Number(amount) * 100),
          currency, reference: reference || null,
          notes: notes || null, paidAt,
          receiptUrl,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      onSaved();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 460, padding: 24, maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, color: "#111827" }}>Record Payment — {docNum}</h2>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Method */}
          <div>
            <label style={lbl}>Payment Method</label>
            <select value={method} onChange={e => setMethod(e.target.value)} style={inp}>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="STRIPE">Stripe / Card</option>
              <option value="CASH">Cash</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          {/* Amount */}
          <div>
            <label style={lbl}>Amount ({currency})</label>
            <input type="number" value={amount} min={0} step={0.01}
              onChange={e => setAmount(e.target.value)} style={inp} />
          </div>

          {/* Reference */}
          <div>
            <label style={lbl}>Reference / Transaction ID</label>
            <input value={reference} onChange={e => setReference(e.target.value)}
              placeholder="Bank ref, Stripe charge ID…" style={inp} />
          </div>

          {/* Payment Date */}
          <div>
            <label style={lbl}>Payment Date</label>
            <input type="date" value={paidAt} onChange={e => setPaidAt(e.target.value)} style={inp} />
          </div>

          {/* Notes */}
          <div>
            <label style={lbl}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              rows={2} style={{ ...inp, resize: "vertical" as const }} />
          </div>

          {/* Receipt upload */}
          <div>
            <label style={lbl}>
              Receipt <span style={{ fontSize: 10, fontWeight: 400, color: "#9ca3af", textTransform: "none" }}>(optional — PDF, JPG, PNG · max 10 MB)</span>
            </label>
            {receipt ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#f0fdf4", border: "1px solid #86efac" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
                <span style={{ fontSize: 12, flex: 1, color: "#15803d", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{receipt.name}</span>
                <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{(receipt.size / 1024).toFixed(0)} KB</span>
                <button type="button" onClick={() => setReceipt(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
              </div>
            ) : (
              <div onClick={() => receiptRef.current?.click()}
                style={{ border: "2px dashed #d1d5db", padding: "12px", textAlign: "center", cursor: "pointer", background: "#fafafa" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = CLR.primary)}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#d1d5db")}>
                <p style={{ fontSize: 12, color: CLR.muted, margin: 0 }}>Click to attach receipt</p>
              </div>
            )}
            <input ref={receiptRef} type="file" style={{ display: "none" }}
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={e => { setReceipt(e.target.files?.[0] ?? null); e.target.value = ""; }} />
          </div>

          {error && <p style={{ fontSize: 12, color: "#dc2626", margin: 0 }}>{error}</p>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
            <button onClick={onClose} disabled={loading}
              style={{ padding: "7px 16px", fontSize: 12, fontWeight: 600, background: "#fff", color: "#374151", border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit" }}>
              Cancel
            </button>
            <button onClick={submit} disabled={loading}
              style={{ padding: "7px 16px", fontSize: 12, fontWeight: 600, background: loading ? "#9ca3af" : CLR.primary, color: "#fff", border: "none", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
              {loading ? "Saving…" : "Record Payment"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
