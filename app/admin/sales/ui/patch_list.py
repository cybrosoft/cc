import re

with open("SalesListPage_src.tsx") as f:
    content = f.read()

# 1. Add showRefund state
content = content.replace(
    "  const [showPayment,   setShowPayment]   = useState(false);",
    "  const [showPayment,   setShowPayment]   = useState(false);\n  const [showRefund,    setShowRefund]    = useState(false);"
)

# 2. Add Record Refund button after Record Payment button
content = content.replace(
    """                  {/* Record Payment — invoices only */}
                  {selected.type === "INVOICE" && ["ISSUED","SENT","PARTIALLY_PAID","OVERDUE"].includes(selected.status) && (
                    <button onClick={() => setShowPayment(true)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", cursor: "pointer", fontFamily: "inherit" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      Record Payment
                    </button>
                  )}""",
    """                  {/* Record Payment — invoices only */}
                  {selected.type === "INVOICE" && ["ISSUED","SENT","PARTIALLY_PAID","OVERDUE"].includes(selected.status) && (
                    <button onClick={() => setShowPayment(true)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", cursor: "pointer", fontFamily: "inherit" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      Record Payment
                    </button>
                  )}

                  {/* Record Refund — credit notes only */}
                  {selected.type === "CREDIT_NOTE" && ["ISSUED","SENT"].includes(selected.status) && (
                    <button onClick={() => setShowRefund(true)}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", fontSize: 11, fontWeight: 600, background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", cursor: "pointer", fontFamily: "inherit" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/></svg>
                      Record Refund
                    </button>
                  )}"""
)

# 3. Add showRefund modal after showPayment modal
content = content.replace(
    """      {showPayment && selected && (
        <RecordPaymentModal
          docId={selected.id} docNum={selected.docNum}
          currency={selected.currency} total={selected.total}
          marketId={(selected.market as any)?.id ?? ""}
          onClose={() => setShowPayment(false)}
          onSaved={() => { setShowPayment(false); fetchDocs(); }}
        />
      )}""",
    """      {showPayment && selected && (
        <RecordPaymentModal
          docId={selected.id} docNum={selected.docNum}
          currency={selected.currency} total={selected.total}
          marketId={(selected.market as any)?.id ?? ""}
          onClose={() => setShowPayment(false)}
          onSaved={() => { setShowPayment(false); fetchDocs(); }}
        />
      )}

      {showRefund && selected && (
        <RecordPaymentModal
          docId={selected.id} docNum={selected.docNum}
          currency={selected.currency} total={selected.total}
          marketId={(selected.market as any)?.id ?? ""}
          isRefund
          onClose={() => setShowRefund(false)}
          onSaved={() => { setShowRefund(false); fetchDocs(); }}
        />
      )}"""
)

# 4. Add isRefund prop to RecordPaymentModal
content = content.replace(
    """function RecordPaymentModal({ docId, docNum, currency, total, marketId, onClose, onSaved }: {
  docId: string; docNum: string; currency: string; total: number; marketId: string;
  onClose: () => void; onSaved: () => void;
})""",
    """function RecordPaymentModal({ docId, docNum, currency, total, marketId, isRefund, onClose, onSaved }: {
  docId: string; docNum: string; currency: string; total: number; marketId: string;
  isRefund?: boolean;
  onClose: () => void; onSaved: () => void;
})"""
)

# 5. Update modal title
content = content.replace(
    '        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Record Payment — {docNum}</h2>',
    '        <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{isRefund ? "Record Refund" : "Record Payment"} — {docNum}</h2>'
)

# 6. Update submit button label
content = content.replace(
    '            {loading ? "Saving…" : "Record Payment"}',
    '            {loading ? "Saving…" : isRefund ? "Record Refund" : "Record Payment"}'
)

# 7. Update API endpoint — use payment route for refunds (not billing)
content = content.replace(
    """  async function submit() {
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
  }""",
    """  async function submit() {
    setLoading(true); setError("");
    try {
      // Refunds go through the payment route (which handles CREDIT_NOTE type)
      // Regular payments go through the billing route
      const url = isRefund
        ? \`/api/admin/sales/\${docId}/payment\`
        : "/api/admin/sales/billing";
      const body = isRefund
        ? { method, amountCents: Math.round(Number(amount) * 100), currency, reference: reference || null, notes: notes || null, paidAt }
        : { documentId: docId, marketId, method, amountCents: Math.round(Number(amount) * 100), currency, reference: reference || null, notes: notes || null, paidAt };
      const res = await fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onSaved();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }"""
)

with open("SalesListPage_out.tsx", "w") as f:
    f.write(content)

print("done")
