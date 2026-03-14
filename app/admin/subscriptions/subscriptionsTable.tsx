"use client";
// app/admin/subscriptions/subscriptionsTable.tsx
// Expandable-row UI — all data loaded once, instant client-side filters

import { useEffect, useMemo, useState } from "react";
import type { SubRow, ListResp, PaymentStatusFilter, ExpiringFilter } from "./subscriptionsTableTypes";
import { SubscriptionsDataTable } from "./ui/subscriptionsDataTable";
import { CreateSubscriptionModal } from "./ui/createSubscriptionModal";
import { CLR } from "@/components/ui/admin-ui";
import { daysUntil } from "./ui/subscriptionsUtils";

export function SubscriptionsTable() {
  const [allRows,    setAllRows]    = useState<SubRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Client-side filters
  const [fEmail,    setFEmail]    = useState("");
  const [fMarket,   setFMarket]   = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fStatus,   setFStatus]   = useState("");
  const [fPayment,  setFPayment]  = useState<PaymentStatusFilter>("");
  const [fExpiring, setFExpiring] = useState<ExpiringFilter>("");

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

  // Derive filter options from loaded data
  const markets = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of allRows) map.set(r.market.id, r.market.name);
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allRows]);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of allRows) {
      const c = r.product.category;
      if (c?.id && c?.name) map.set(c.id, c.name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [allRows]);

  // Client-side filtering
  const filtered = useMemo(() => {
    return allRows.filter(s => {
      if (fEmail    && !s.user.email.toLowerCase().includes(fEmail.toLowerCase())) return false;
      if (fMarket   && s.market.id !== fMarket)                                   return false;
      if (fCategory && s.product.category?.id !== fCategory)                      return false;
      if (fStatus   && s.status !== fStatus)                                       return false;
      if (fPayment) {
        const paid = s.paymentStatus === "PAID";
        if (fPayment === "PAID"    && !paid) return false;
        if (fPayment === "PENDING" &&  paid) return false;
      }
      if (fExpiring) {
        if (s.status !== "ACTIVE") return false;
        const d = daysUntil(s.currentPeriodEnd);
        if (d === null || d > Number(fExpiring)) return false;
      }
      return true;
    });
  }, [allRows, fEmail, fMarket, fCategory, fStatus, fPayment, fExpiring]);

  const hasFilters = fEmail || fMarket || fCategory || fStatus || fPayment || fExpiring;

  function clearFilters() {
    setFEmail(""); setFMarket(""); setFCategory("");
    setFStatus(""); setFPayment(""); setFExpiring("");
  }

  const inp: React.CSSProperties = {
    padding: "6px 10px", fontSize: 12, fontFamily: "inherit",
    background: "#fff", border: `1px solid ${CLR.border}`, color: "#374151", outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Top bar — Add Subscription */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            padding: "7px 16px", fontSize: 13, fontWeight: 600,
            background: CLR.primary, color: "#fff", border: `1px solid ${CLR.primary}`,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          + Add Subscription
        </button>
      </div>

      {/* Filter bar */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
        padding: "10px 14px", background: "#fff", border: `1px solid ${CLR.border}`,
        marginBottom: 1,
      }}>
        <input
          style={{ ...inp, width: 210 }}
          placeholder="Search email…"
          value={fEmail}
          onChange={e => setFEmail(e.target.value)}
        />

        <select style={inp} value={fMarket} onChange={e => setFMarket(e.target.value)}>
          <option value="">All Markets</option>
          {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <select style={inp} value={fCategory} onChange={e => setFCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select style={inp} value={fStatus} onChange={e => setFStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING_PAYMENT">Pending Payment</option>
          <option value="PENDING_EXTERNAL">Pending External</option>
          <option value="CANCELED">Cancelled</option>
        </select>

        <select style={inp} value={fPayment} onChange={e => setFPayment(e.target.value as PaymentStatusFilter)}>
          <option value="">All Payments</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
        </select>

        <select style={inp} value={fExpiring} onChange={e => setFExpiring(e.target.value as ExpiringFilter)}>
          <option value="">Any Expiry</option>
          <option value="7">Expiring in 7d</option>
          <option value="14">Expiring in 14d</option>
          <option value="30">Expiring in 30d</option>
          <option value="90">Expiring in 90d</option>
        </select>

        {hasFilters && (
          <button
            onClick={clearFilters}
            style={{ ...inp, color: CLR.muted, background: "#f9fafb", cursor: "pointer" }}
          >
            Clear
          </button>
        )}

        {error && <span style={{ fontSize: 12, color: "#dc2626" }}>⚠ {error}</span>}

        <span style={{ marginLeft: "auto", fontSize: 12, color: CLR.faint }}>
          {loading ? "Loading…" : `${filtered.length} of ${allRows.length} subscription${allRows.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Expandable data table — no separate modals needed */}
      <SubscriptionsDataTable
        rows={filtered}
        loading={loading}
        onChanged={() => void load()}
      />

      {/* Create modal */}
      <CreateSubscriptionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => { setCreateOpen(false); void load(); }}
      />
    </div>
  );
}