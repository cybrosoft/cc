// FILE: app/admin/subscriptions/subscriptionsTable.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  Category,
  ExpiringFilter,
  ListResp,
  Market,
  PaymentStatusFilter,
  SubRow,
} from "./subscriptionsTableTypes";

import { SubscriptionsFiltersBar } from "./ui/subscriptionsFiltersBar";
import { SubscriptionsDataTable } from "./ui/subscriptionsDataTable";
import { VpsAssignModal } from "./ui/vpsAssignModal";
import { BillingModal } from "./ui/billingModal";
import { CreateSubscriptionModal } from "./ui/createSubscriptionModal";

export default function SubscriptionsTable() {
  // Filters
  const [email, setEmail] = useState("");
  const [marketId, setMarketId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<string>("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusFilter>("");
  const [expiringDays, setExpiringDays] = useState<ExpiringFilter>("");

  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<ListResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [vpsOpen, setVpsOpen] = useState(false);
  const [vpsSub, setVpsSub] = useState<SubRow | null>(null);

  const [billOpen, setBillOpen] = useState(false);
  const [billSub, setBillSub] = useState<SubRow | null>(null);

  const [createOpen, setCreateOpen] = useState(false);

  const totalPages = useMemo(() => {
    if (!resp) return 1;
    return Math.max(1, Math.ceil(resp.total / resp.pageSize));
  }, [resp]);

  const markets = useMemo((): Market[] => {
    const map = new Map<string, Market>();
    for (const r of resp?.data ?? []) map.set(r.market.id, r.market);
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [resp]);

  const categories = useMemo((): Category[] => {
    const map = new Map<string, Category>();
    for (const r of resp?.data ?? []) {
      const c = r.product.category;
      if (c?.id && c?.name) map.set(c.id, { id: c.id, name: c.name });
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [resp]);

  async function load(nextPage?: number): Promise<void> {
    const p = typeof nextPage === "number" ? nextPage : page;

    setLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams();
      qs.set("page", String(p));

      const e = email.trim();
      if (e) qs.set("email", e);
      if (marketId) qs.set("marketId", marketId);
      if (categoryId) qs.set("categoryId", categoryId);
      if (status) qs.set("status", status);
      if (paymentStatus) qs.set("paymentStatus", paymentStatus);
      if (expiringDays) qs.set("expiringDays", expiringDays);

      const res = await fetch(`/api/admin/subscriptions?${qs.toString()}`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as ListResp | null;

      if (!res.ok || !json?.ok) {
        setError(`Failed to load (${res.status})`);
        setResp(null);
        return;
      }

      setResp(json);
    } catch {
      setError("Failed to load (network)");
      setResp(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function applyFilters(): void {
    setPage(1);
    void load(1);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <button
          className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100"
          onClick={() => setCreateOpen(true)}
        >
          Add subscription
        </button>
      </div>

      <SubscriptionsFiltersBar
        loading={loading}
        error={error}
        resp={resp}
        totalPages={totalPages}
        markets={markets}
        categories={categories}
        email={email}
        setEmail={setEmail}
        marketId={marketId}
        setMarketId={setMarketId}
        categoryId={categoryId}
        setCategoryId={setCategoryId}
        status={status}
        setStatus={setStatus}
        paymentStatus={paymentStatus}
        setPaymentStatus={setPaymentStatus}
        expiringDays={expiringDays}
        setExpiringDays={setExpiringDays}
        onApply={applyFilters}
      />

      <SubscriptionsDataTable
        rows={resp?.data ?? []}
        page={page}
        totalPages={totalPages}
        loading={loading}
        onPrev={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        onOpenVps={(sub) => {
          setVpsSub(sub);
          setVpsOpen(true);
        }}
        onOpenBilling={(sub) => {
          setBillSub(sub);
          setBillOpen(true);
        }}
      />

      <VpsAssignModal
        open={vpsOpen}
        sub={vpsSub}
        onClose={() => {
          setVpsOpen(false);
          setVpsSub(null);
        }}
        onSaved={() => void load()}
      />

      <BillingModal
        open={billOpen}
        sub={billSub}
        onClose={() => {
          setBillOpen(false);
          setBillSub(null);
        }}
        onChanged={() => void load()}
      />

      <CreateSubscriptionModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load(1)}
      />
    </div>
  );
}