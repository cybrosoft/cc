"use client";
// app/admin/subscriptions/subscriptionsTable.tsx
// Step 6 restyled header/controls. All business logic preserved.

import { useEffect, useMemo, useState } from "react";
import type { SubRow, ListResp, Market, PaymentStatusFilter, ExpiringFilter } from "./subscriptionsTableTypes";
import { SubscriptionsFiltersBar } from "./ui/subscriptionsFiltersBar";
import { SubscriptionsDataTable } from "./ui/subscriptionsDataTable";
import { BillingModal } from "./ui/billingModal";
import { VpsAssignModal } from "./ui/vpsAssignModal";
import { CreateSubscriptionModal } from "./ui/createSubscriptionModal";
import { CLR } from "@/components/ui/admin-ui";

type Category = { id: string; name: string };

export function SubscriptionsTable() {
  const [resp, setResp]       = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [page, setPage]       = useState(1);

  // Filters
  const [email, setEmail]               = useState("");
  const [marketId, setMarketId]         = useState("");
  const [categoryId, setCategoryId]     = useState("");
  const [status, setStatus]             = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>("");
  const [expiringDays, setExpiringDays]   = useState<ExpiringFilter>("");

  // Modals
  const [billOpen, setBillOpen]   = useState(false);
  const [billSub, setBillSub]     = useState<SubRow | null>(null);
  const [vpsOpen, setVpsOpen]     = useState(false);
  const [vpsSub, setVpsSub]       = useState<SubRow | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil((resp?.total ?? 0) / (resp?.pageSize ?? 20)));

  const markets = useMemo((): Market[] => {
    const map = new Map<string, Market>();
    for (const r of resp?.data ?? []) map.set(r.market.id, r.market);
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [resp]);

  const categories = useMemo((): Category[] => {
    const map = new Map<string, Category>();
    for (const r of resp?.data ?? []) {
      const c = r.product.category;
      if (c?.id && c?.name) map.set(c.id, { id: c.id, name: c.name });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [resp]);

  async function load(nextPage?: number) {
    const p = nextPage ?? page;
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ page: String(p) });
      if (email.trim())   qs.set("email",        email.trim());
      if (marketId)       qs.set("marketId",      marketId);
      if (categoryId)     qs.set("categoryId",    categoryId);
      if (status)         qs.set("status",        status);
      if (paymentStatus)  qs.set("paymentStatus", paymentStatus);
      if (expiringDays)   qs.set("expiringDays",  expiringDays);
      const r = await fetch(`/api/admin/subscriptions?${qs}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setError(`Failed to load (${r.status})`); setResp(null); return; }
      setResp(j);
    } catch { setError("Network error"); setResp(null); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [page]);

  function applyFilters() { setPage(1); void load(1); }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top action bar */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setCreateOpen(true)}
          style={{
            padding: "7px 16px", fontSize: 13, fontWeight: 500,
            background: CLR.primary, color: "#fff", border: `1px solid ${CLR.primary}`,
            cursor: "pointer", fontFamily: "inherit",
          }}
        >+ Add Subscription</button>
      </div>

      <SubscriptionsFiltersBar
        loading={loading} error={error} resp={resp} totalPages={totalPages}
        markets={markets} categories={categories}
        email={email} setEmail={setEmail}
        marketId={marketId} setMarketId={setMarketId}
        categoryId={categoryId} setCategoryId={setCategoryId}
        status={status} setStatus={setStatus}
        paymentStatus={paymentStatus} setPaymentStatus={setPaymentStatus}
        expiringDays={expiringDays} setExpiringDays={setExpiringDays}
        onApply={applyFilters}
      />

      <SubscriptionsDataTable
        rows={resp?.data ?? []}
        page={page} totalPages={totalPages} loading={loading}
        onPrev={() => setPage(p => Math.max(1, p - 1))}
        onNext={() => setPage(p => Math.min(totalPages, p + 1))}
        onOpenVps={sub => { setVpsSub(sub); setVpsOpen(true); }}
        onOpenBilling={sub => { setBillSub(sub); setBillOpen(true); }}
      />

      <VpsAssignModal open={vpsOpen} sub={vpsSub}
        onClose={() => { setVpsOpen(false); setVpsSub(null); }}
        onSaved={() => void load()} />

      <BillingModal open={billOpen} sub={billSub}
        onClose={() => { setBillOpen(false); setBillSub(null); }}
        onChanged={() => void load()} />

      <CreateSubscriptionModal open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load(1)} />
    </div>
  );
}
