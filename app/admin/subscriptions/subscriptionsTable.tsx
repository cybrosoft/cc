"use client";
// app/admin/subscriptions/subscriptionsTable.tsx
// Instant client-side filters — all data loaded once

import { useEffect, useMemo, useState } from "react";
import type { SubRow, ListResp, PaymentStatusFilter, ExpiringFilter } from "./subscriptionsTableTypes";
import { SubscriptionsDataTable } from "./ui/subscriptionsDataTable";
import { BillingModal }            from "./ui/billingModal";
import { VpsAssignModal }          from "./ui/vpsAssignModal";
import { CreateSubscriptionModal } from "./ui/createSubscriptionModal";
import { CLR }                     from "@/components/ui/admin-ui";
import Icon from "@/components/ui/Icon";  // ✅ default export, capital I, no s
import { daysUntil }               from "./ui/subscriptionsUtils";

type ProductTypeFilter = "" | "plan" | "addon" | "service";

const C = {
  primary:   "#318774",
  primaryBg: "#eaf4f2",
  border:    "#e2e8f0",
  text:      "#0f172a",
  muted:     "#64748b",
  faint:     "#94a3b8",
};

const INP: React.CSSProperties = {
  padding: "7px 10px", fontSize: 13, fontFamily: "inherit",
  background: "#fff", border: `1px solid ${C.border}`,
  color: C.text, outline: "none",
};

export function SubscriptionsTable() {
  const [allRows, setAllRows]     = useState<SubRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);

  // Filters
  const [fEmail,    setFEmail]    = useState("");
  const [fMarket,   setFMarket]   = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fStatus,   setFStatus]   = useState("");
  const [fType,     setFType]     = useState<ProductTypeFilter>("");
  const [fPayment,  setFPayment]  = useState<PaymentStatusFilter>("");
  const [fExpiring, setFExpiring] = useState<ExpiringFilter>("");

  // Modals
  const [billOpen, setBillOpen]     = useState(false);
  const [billSub, setBillSub]       = useState<SubRow | null>(null);
  const [vpsOpen, setVpsOpen]       = useState(false);
  const [vpsSub, setVpsSub]         = useState<SubRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/admin/subscriptions?pageSize=9999", { cache: "no-store" });
      const j = await r.json().catch(() => null) as ListResp | null;
      if (!r.ok || !j?.ok) { setError(`Failed to load (${r.status})`); return; }
      setAllRows(j.data);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  const markets = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of allRows) map.set(r.market.id, r.market.name);
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allRows]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of allRows) { const c = r.product.category; if (c?.id && c?.name) map.set(c.id, c.name); }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allRows]);

  const filtered = useMemo(() => {
    return allRows.filter(s => {
      if (fEmail    && !s.user.email.toLowerCase().includes(fEmail.toLowerCase())) return false;
      if (fMarket   && s.market.id !== fMarket)              return false;
      if (fCategory && s.product.category?.id !== fCategory) return false;
      if (fStatus   && s.status !== fStatus)                 return false;
      if (fType     && s.product.type !== fType)             return false;
      if (fPayment) {
        const paid = !!s.activatedAt;
        if (fPayment === "PAID" && !paid) return false;
        if (fPayment === "PENDING" && paid) return false;
      }
      if (fExpiring) {
        if (s.status !== "ACTIVE") return false;
        const d = daysUntil(s.currentPeriodEnd);
        if (d === null || d > Number(fExpiring)) return false;
      }
      return true;
    });
  }, [allRows, fEmail, fMarket, fCategory, fStatus, fType, fPayment, fExpiring]);

  const hasFilters = fEmail || fMarket || fCategory || fStatus || fType || fPayment || fExpiring;

  function clearFilters() {
    setFEmail(""); setFMarket(""); setFCategory("");
    setFStatus(""); setFType(""); setFPayment(""); setFExpiring("");
  }

  // Stats for header
  const activeCount  = allRows.filter(r => r.status === "ACTIVE").length;
  const pendingCount = allRows.filter(r => r.status === "PENDING_PAYMENT" || r.status === "PENDING_EXTERNAL").length;
  const expiringCount = allRows.filter(r => {
    const d = daysUntil(r.currentPeriodEnd);
    return r.status === "ACTIVE" && d !== null && d <= 30;
  }).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Header bar ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.text, margin: 0 }}>Subscriptions</h1>
          {!loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
              <span style={{ fontSize: 12, color: C.faint }}>{allRows.length} total</span>
              {activeCount  > 0 && <span style={{ fontSize: 11, padding: "2px 8px", background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", fontWeight: 600 }}>{activeCount} active</span>}
              {pendingCount > 0 && <span style={{ fontSize: 11, padding: "2px 8px", background: "#fffbeb", color: "#92400e", border: "1px solid #fde047", fontWeight: 600 }}>{pendingCount} pending</span>}
              {expiringCount > 0 && <span style={{ fontSize: 11, padding: "2px 8px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", fontWeight: 600 }}>{expiringCount} expiring soon</span>}
            </div>
          )}
        </div>
        <button
          onClick={() => setCreateOpen(true)}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: C.primary, color: "#fff", border: "none", cursor: "pointer", flexShrink: 0 }}
        >
          <Icon name="plus" size={14} color="#fff" />
          Add Subscription
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "12px 16px", background: "#fff", border: `1px solid ${C.border}` }}>
        <div style={{ position: "relative" as const, display: "flex", alignItems: "center" }}>
          <Icon name="search" size={13} color={C.faint} style={{ position: "absolute", left: 9, pointerEvents: "none" }} />
          <input
            style={{ ...INP, width: 220, paddingLeft: 30 }}
            placeholder="Search email…"
            value={fEmail} onChange={e => setFEmail(e.target.value)}
          />
        </div>

        <select style={INP} value={fMarket} onChange={e => setFMarket(e.target.value)}>
          <option value="">All Markets</option>
          {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <select style={INP} value={fCategory} onChange={e => setFCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select style={INP} value={fType} onChange={e => setFType(e.target.value as ProductTypeFilter)}>
          <option value="">All Types</option>
          <option value="plan">Plan</option>
          <option value="addon">Addon</option>
          <option value="service">Service</option>
        </select>

        <select style={INP} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING_PAYMENT">Pending Payment</option>
          <option value="PENDING_EXTERNAL">Pending External</option>
          <option value="CANCELED">Cancelled</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="EXPIRED">Expired</option>
        </select>

        <select style={INP} value={fPayment} onChange={e => setFPayment(e.target.value as PaymentStatusFilter)}>
          <option value="">All Payments</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Unpaid</option>
        </select>

        <select style={INP} value={fExpiring} onChange={e => setFExpiring(e.target.value as ExpiringFilter)}>
          <option value="">Any Expiry</option>
          <option value="7">Expiring in 7d</option>
          <option value="14">Expiring in 14d</option>
          <option value="30">Expiring in 30d</option>
          <option value="90">Expiring in 90d</option>
        </select>

        {hasFilters && (
          <button onClick={clearFilters} style={{ ...INP, color: C.muted, background: "#f8fafc", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Icon name="x" size={11} color={C.faint} /> Clear
          </button>
        )}

        {error && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#dc2626" }}>
            <Icon name="alertCircle" size={13} color="#dc2626" /> {error}
          </span>
        )}

        <span style={{ marginLeft: "auto", fontSize: 12, color: C.faint }}>
          {loading ? "Loading…" : `${filtered.length} of ${allRows.length}`}
        </span>
      </div>

      {/* ── Data table ── */}
      <SubscriptionsDataTable
        rows={filtered}
        loading={loading}
        onOpenVps={sub => { setVpsSub(sub); setVpsOpen(true); }}
        onOpenBilling={sub => { setBillSub(sub); setBillOpen(true); }}
        onChanged={() => void load()}
      />

      <VpsAssignModal open={vpsOpen} sub={vpsSub}
        onClose={() => { setVpsOpen(false); setVpsSub(null); }}
        onSaved={() => void load()} />

      <BillingModal open={billOpen} sub={billSub}
        onClose={() => { setBillOpen(false); setBillSub(null); }}
        onChanged={() => void load()} />

      <CreateSubscriptionModal open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()} />
    </div>
  );
}