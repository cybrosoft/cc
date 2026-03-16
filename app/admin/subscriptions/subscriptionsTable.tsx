"use client";
// app/admin/subscriptions/subscriptionsTable.tsx

import { useEffect, useMemo, useState } from "react";
import type { SubRow, ListResp, PaymentStatusFilter, ExpiringFilter } from "./subscriptionsTableTypes";
import { SubscriptionsDataTable } from "./ui/subscriptionsDataTable";
import { BillingModal }            from "./ui/billingModal";
import { CreateSubscriptionModal } from "./ui/createSubscriptionModal";
import {
  PageShell, Card, FiltersBar, Input, Select, Btn, Alert, CLR,
} from "@/components/ui/admin-ui";
import { daysUntil } from "./ui/subscriptionsUtils";

type ProductTypeFilter = "" | "plan" | "addon" | "service";

export function SubscriptionsTable() {
  const [allRows, setAllRows] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [fEmail,    setFEmail]    = useState("");
  const [fMarket,   setFMarket]   = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fStatus,   setFStatus]   = useState("");
  const [fType,     setFType]     = useState<ProductTypeFilter>("");
  const [fParent,   setFParent]   = useState("");
  const [fPayment,  setFPayment]  = useState<PaymentStatusFilter>("");
  const [fExpiring, setFExpiring] = useState<ExpiringFilter>("");

  const [billOpen,   setBillOpen]   = useState(false);
  const [billSub,    setBillSub]    = useState<SubRow | null>(null);
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
  useEffect(() => { if (fType !== "addon") setFParent(""); }, [fType]);

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

  const planSubs = useMemo(() =>
    allRows.filter(r => r.product.type === "plan")
      .map(r => ({ id: r.id, name: r.product.name, email: r.user.email })),
    [allRows]);

  const hasPartial = useMemo(() => allRows.some(r => r.paymentStatus === "PARTIAL"), [allRows]);

  const filtered = useMemo(() => {
    return allRows.filter(s => {
      if (fEmail) {
        const q = fEmail.toLowerCase();
        if (!s.user.email.toLowerCase().includes(q) && !(s.user as any).fullName?.toLowerCase().includes(q)) return false;
      }
      if (fMarket   && s.market.id !== fMarket)              return false;
      if (fCategory && s.product.category?.id !== fCategory) return false;
      if (fStatus   && s.status !== fStatus)                 return false;
      if (fType     && s.product.type !== fType)             return false;
      if (fParent   && (s as any).parentSubscriptionId !== fParent) return false;
      if (fPayment) {
        if (fPayment === "PAID"    && s.paymentStatus !== "PAID")    return false;
        if (fPayment === "PARTIAL" && s.paymentStatus !== "PARTIAL") return false;
        if (fPayment === "PENDING" && s.paymentStatus !== "UNPAID")  return false;
      }
      if (fExpiring) {
        if (s.status !== "ACTIVE") return false;
        const d = daysUntil(s.currentPeriodEnd);
        if (d === null || d > Number(fExpiring)) return false;
      }
      return true;
    });
  }, [allRows, fEmail, fMarket, fCategory, fStatus, fType, fPayment, fExpiring, fParent]);

  const hasFilters = !!(fEmail || fMarket || fCategory || fStatus || fType || fPayment || fExpiring || fParent);

  function clearFilters() {
    setFEmail(""); setFMarket(""); setFCategory("");
    setFStatus(""); setFType(""); setFPayment(""); setFExpiring(""); setFParent("");
  }

  const activeCount   = allRows.filter(r => r.status === "ACTIVE").length;
  const pendingCount  = allRows.filter(r => r.status === "PENDING_PAYMENT" || r.status === "PROCESSING").length;
  const expiringCount = allRows.filter(r => {
    const d = daysUntil(r.currentPeriodEnd);
    return r.status === "ACTIVE" && d !== null && d <= 30;
  }).length;

  return (
    <PageShell
      breadcrumb="ADMIN / SUBSCRIPTIONS"
      title="Subscriptions"
      ctaLabel="Add Subscription"
      ctaOnClick={() => setCreateOpen(true)}
    >
      {/* Stats pills */}
      {!loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: CLR.faint }}>{allRows.length} total</span>
          {activeCount   > 0 && <span style={{ fontSize: 11, padding: "2px 8px", background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", fontWeight: 600 }}>{activeCount} active</span>}
          {pendingCount  > 0 && <span style={{ fontSize: 11, padding: "2px 8px", background: "#fffbeb", color: "#92400e", border: "1px solid #fde047", fontWeight: 600 }}>{pendingCount} pending</span>}
          {expiringCount > 0 && <span style={{ fontSize: 11, padding: "2px 8px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", fontWeight: 600 }}>{expiringCount} expiring</span>}
        </div>
      )}

      {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

      <Card>
        <FiltersBar>
          <Input value={fEmail} onChange={setFEmail} placeholder="Search name or email…" style={{ width: 220, maxWidth: "100%" }} />
          <Select value={fMarket} onChange={setFMarket} style={{ width: 130, maxWidth: "100%" }}>
            <option value="">All Markets</option>
            {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select value={fCategory} onChange={setFCategory} style={{ width: 140, maxWidth: "100%" }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={fType} onChange={v => setFType(v as ProductTypeFilter)} style={{ width: 120, maxWidth: "100%" }}>
            <option value="">All Types</option>
            <option value="plan">Plan</option>
            <option value="addon">Addon</option>
            <option value="service">Service</option>
          </Select>
          {fType === "addon" && planSubs.length > 0 && (
            <Select value={fParent} onChange={setFParent} style={{ width: 180, maxWidth: "100%" }}>
              <option value="">All Plans</option>
              {planSubs.map(p => <option key={p.id} value={p.id}>{p.name} · {p.email}</option>)}
            </Select>
          )}
          <Select value={fStatus} onChange={setFStatus} style={{ width: 150, maxWidth: "100%" }}>
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PENDING_PAYMENT">Pending Payment</option>
            <option value="PROCESSING">Processing</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELED">Cancelled</option>
          </Select>
          <Select value={fPayment} onChange={v => setFPayment(v as PaymentStatusFilter)} style={{ width: 140, maxWidth: "100%" }}>
            <option value="">All Payments</option>
            <option value="PAID">Paid</option>
            {hasPartial && <option value="PARTIAL">Partially Paid</option>}
            <option value="PENDING">Unpaid</option>
          </Select>
          <Select value={fExpiring} onChange={v => setFExpiring(v as ExpiringFilter)} style={{ width: 140, maxWidth: "100%" }}>
            <option value="">Any Expiry</option>
            <option value="7">Expiring in 7d</option>
            <option value="14">Expiring in 14d</option>
            <option value="30">Expiring in 30d</option>
            <option value="90">Expiring in 90d</option>
          </Select>
          {hasFilters && <Btn variant="ghost" onClick={clearFilters}>Clear</Btn>}
          <span style={{ marginLeft: "auto", fontSize: 12, color: CLR.faint }}>
            {loading ? "Loading…" : `${filtered.length} of ${allRows.length}`}
          </span>
        </FiltersBar>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: CLR.faint }}>Loading…</div>
        ) : (
          <SubscriptionsDataTable rows={filtered} loading={loading} onChanged={() => void load()} />
        )}
      </Card>

      <BillingModal open={billOpen} sub={billSub}
        onClose={() => { setBillOpen(false); setBillSub(null); }}
        onChanged={() => void load()} />

      <CreateSubscriptionModal open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()} />
    </PageShell>
  );
}