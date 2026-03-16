// app/admin/sales/billing/BillingClient.tsx
"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CLR } from "@/components/ui/admin-ui";
import { fmtAmount } from "../ui/sales-ui";

interface Payment {
  id: string;
  method: string;
  amountCents: number;
  currency: string;
  reference: string | null;
  notes: string | null;
  paidAt: string;
  document: {
    id: string;
    docNum: string;
    type: string;
    customer: { fullName: string | null; email: string; customerNumber: string | null };
  };
  market: { key: string; name: string };
}

const DETAIL_BASE: Record<string, string> = {
  RFQ:           "/admin/sales/rfq",
  QUOTATION:     "/admin/sales/quotations",
  PO:            "/admin/sales/po",
  DELIVERY_NOTE: "/admin/sales/delivery-notes",
  PROFORMA:      "/admin/sales/proforma",
  INVOICE:       "/admin/sales/invoices",
  CREDIT_NOTE:   "/admin/sales/returns",
};

const METHOD_LABEL: Record<string, string> = {
  BANK_TRANSFER: "Bank Transfer",
  STRIPE: "Stripe",
  CASH: "Cash",
  OTHER: "Other",
};

export default function BillingClient() {
  const router = useRouter();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading]   = useState(true);
  const [q, setQ]               = useState("");
  const [method, setMethod]     = useState("");
  const [marketKey, setMarketKey] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q)      params.set("q", q);
    if (method) params.set("method", method);
    try {
      const res  = await fetch(`/api/admin/sales/billing?${params}`);
      const data = await res.json();
      let rows: Payment[] = data.payments ?? [];
      if (marketKey) rows = rows.filter((p) => p.market.key === marketKey);
      setPayments(rows);
    } catch { /**/ }
    setLoading(false);
  }, [q, method, marketKey]);

  useEffect(() => { load(); }, [load]);

  // Summary totals
  const totals = payments.reduce((acc, p) => {
    const key = p.currency;
    acc[key] = (acc[key] ?? 0) + p.amountCents;
    return acc;
  }, {} as Record<string, number>);

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", fontSize: 13,
    border: "1px solid #d1d5db", background: "#fff", fontFamily: "inherit",
  };

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        {Object.entries(totals).map(([curr, cents]) => (
          <div key={curr} style={{
            background: "#fff", border: "1px solid #e5e7eb", padding: "16px 24px",
            minWidth: 180,
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.05em", marginBottom: 4 }}>
              TOTAL RECEIVED · {curr}
            </p>
            <p style={{ fontSize: 22, fontWeight: 700, color: CLR.primary }}>
              {fmtAmount(cents, curr)}
            </p>
          </div>
        ))}
        <div style={{
          background: "#fff", border: "1px solid #e5e7eb", padding: "16px 24px",
          minWidth: 120,
        }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.05em", marginBottom: 4 }}>
            TRANSACTIONS
          </p>
          <p style={{ fontSize: 22, fontWeight: 700 }}>{payments.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search doc # or reference…"
          style={{ ...inputStyle, flex: 1, minWidth: 220 }}
        />
        <select value={method} onChange={(e) => setMethod(e.target.value)} style={inputStyle}>
          <option value="">All Methods</option>
          <option value="BANK_TRANSFER">Bank Transfer</option>
          <option value="STRIPE">Stripe</option>
          <option value="CASH">Cash</option>
          <option value="OTHER">Other</option>
        </select>
        <select value={marketKey} onChange={(e) => setMarketKey(e.target.value)} style={inputStyle}>
          <option value="">All Markets</option>
          <option value="SA">Saudi (SAR)</option>
          <option value="GL">Global (USD)</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: "48px 24px", textAlign: "center", color: CLR.faint, fontSize: 13 }}>Loading…</div>
      ) : payments.length === 0 ? (
        <div style={{ padding: "64px 24px", textAlign: "center", border: "1px solid #e5e7eb", background: "#fff" }}>
          <p style={{ fontSize: 14, color: CLR.muted, fontWeight: 500 }}>No payments found</p>
          <p style={{ fontSize: 12, color: CLR.faint, marginTop: 4 }}>
            Payments are recorded from invoice detail pages.
          </p>
        </div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", background: "#fff", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                {["Document","Customer","Market","Method","Amount","Reference","Paid At"].map((h) => (
                  <th key={h} style={{
                    padding: "10px 14px", textAlign: "left",
                    fontSize: 11, fontWeight: 600, color: CLR.muted,
                    letterSpacing: "0.04em", textTransform: "uppercase",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr
                  key={p.id}
                  style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                  onClick={() => router.push(`${DETAIL_BASE[p.document.type]}/${p.document.id}`)}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ fontFamily: "monospace", fontWeight: 600, color: CLR.primary }}>
                      {p.document.docNum}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <div style={{ fontWeight: 500 }}>{p.document.customer.fullName ?? p.document.customer.email}</div>
                    <div style={{ fontSize: 11, color: CLR.faint }}>{p.document.customer.customerNumber}</div>
                  </td>
                  <td style={{ padding: "11px 14px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", background: "#f3f4f6", border: "1px solid #e5e7eb", color: CLR.muted }}>
                      {p.market.key}
                    </span>
                  </td>
                  <td style={{ padding: "11px 14px", color: CLR.muted }}>
                    {METHOD_LABEL[p.method] ?? p.method}
                  </td>
                  <td style={{ padding: "11px 14px", fontWeight: 700, color: CLR.primary }}>
                    {fmtAmount(p.amountCents, p.currency)}
                  </td>
                  <td style={{ padding: "11px 14px", color: CLR.muted, fontFamily: "monospace", fontSize: 12 }}>
                    {p.reference ?? "—"}
                  </td>
                  <td style={{ padding: "11px 14px", color: CLR.muted }}>
                    {new Date(p.paidAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
