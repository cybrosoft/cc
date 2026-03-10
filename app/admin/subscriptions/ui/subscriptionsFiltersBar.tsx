"use client";
// app/admin/subscriptions/ui/subscriptionsFiltersBar.tsx
// Step 6 restyled — same props, flat UI

import type { Market, ListResp, PaymentStatusFilter, ExpiringFilter } from "../subscriptionsTableTypes";
import { CLR } from "@/components/ui/admin-ui";

type Category = { id: string; name: string };

export function SubscriptionsFiltersBar({
  loading, error, resp, totalPages,
  markets, categories,
  email, setEmail,
  marketId, setMarketId,
  categoryId, setCategoryId,
  status, setStatus,
  paymentStatus, setPaymentStatus,
  expiringDays, setExpiringDays,
  onApply,
}: {
  loading: boolean; error: string | null; resp: ListResp | null; totalPages: number;
  markets: Market[]; categories: Category[];
  email: string; setEmail: (v: string) => void;
  marketId: string; setMarketId: (v: string) => void;
  categoryId: string; setCategoryId: (v: string) => void;
  status: string; setStatus: (v: string) => void;
  paymentStatus: PaymentStatusFilter; setPaymentStatus: (v: PaymentStatusFilter) => void;
  expiringDays: ExpiringFilter; setExpiringDays: (v: ExpiringFilter) => void;
  onApply: () => void;
}) {
  const inp: React.CSSProperties = {
    padding: "6px 10px", fontSize: 13, fontFamily: "inherit",
    background: "#fff", border: `1px solid ${CLR.border}`, color: "#374151",
    outline: "none",
  };

  const total = resp?.total ?? 0;

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
      padding: "11px 0", marginBottom: 4,
    }}>
      {/* Email search */}
      <input
        style={{ ...inp, width: 240 }}
        placeholder="Search email…"
        value={email}
        onChange={e => setEmail(e.target.value)}
        onKeyDown={e => e.key === "Enter" && onApply()}
      />

      {/* Market */}
      <select style={inp} value={marketId} onChange={e => setMarketId(e.target.value)}>
        <option value="">All Markets</option>
        {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>

      {/* Category */}
      <select style={inp} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
        <option value="">All Categories</option>
        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>

      {/* Status */}
      <select style={inp} value={status} onChange={e => setStatus(e.target.value)}>
        <option value="">All Status</option>
        <option value="ACTIVE">Active</option>
        <option value="PENDING_PAYMENT">Pending Payment</option>
        <option value="PENDING_EXTERNAL">Pending External</option>
        <option value="CANCELED">Canceled</option>
      </select>

      {/* Payment status */}
      <select style={inp} value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as PaymentStatusFilter)}>
        <option value="">All Payments</option>
        <option value="PAID">Paid</option>
        <option value="PENDING">Pending</option>
      </select>

      {/* Expiring */}
      <select style={inp} value={expiringDays} onChange={e => setExpiringDays(e.target.value as ExpiringFilter)}>
        <option value="">Any Expiry</option>
        <option value="7">Expiring in 7d</option>
        <option value="14">Expiring in 14d</option>
        <option value="30">Expiring in 30d</option>
        <option value="90">Expiring in 90d</option>
      </select>

      <button
        onClick={onApply}
        disabled={loading}
        style={{
          padding: "6px 16px", fontSize: 13, fontWeight: 500, cursor: loading ? "wait" : "pointer",
          background: CLR.primary, color: "#fff", border: `1px solid ${CLR.primary}`,
          fontFamily: "inherit", opacity: loading ? 0.6 : 1,
        }}
      >{loading ? "Loading…" : "Apply"}</button>

      {/* Error or count */}
      {error && (
        <span style={{ fontSize: 12.5, color: "#dc2626", marginLeft: 4 }}>⚠ {error}</span>
      )}
      {!error && resp && (
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>
          {total} subscription{total !== 1 ? "s" : ""} · Page 1–{totalPages}
        </span>
      )}
    </div>
  );
}
