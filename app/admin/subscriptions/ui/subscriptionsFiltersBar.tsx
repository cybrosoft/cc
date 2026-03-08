// app/admin/subscriptions/ui/subscriptionsFiltersBar.tsx
"use client";

import type {
  Category,
  ExpiringFilter,
  ListResp,
  Market,
  PaymentStatusFilter,
} from "../subscriptionsTableTypes";

export function SubscriptionsFiltersBar({
  loading,
  error,
  resp,
  totalPages,

  markets,
  categories,

  email,
  setEmail,

  marketId,
  setMarketId,

  categoryId,
  setCategoryId,

  status,
  setStatus,

  paymentStatus,
  setPaymentStatus,

  expiringDays,
  setExpiringDays,

  onApply,
}: {
  loading: boolean;
  error: string | null;
  resp: ListResp | null;
  totalPages: number;

  markets: Market[];
  categories: Category[];

  email: string;
  setEmail: (v: string) => void;

  marketId: string;
  setMarketId: (v: string) => void;

  categoryId: string;
  setCategoryId: (v: string) => void;

  status: string;
  setStatus: (v: string) => void;

  paymentStatus: PaymentStatusFilter;
  setPaymentStatus: (v: PaymentStatusFilter) => void;

  expiringDays: ExpiringFilter;
  setExpiringDays: (v: ExpiringFilter) => void;

  onApply: () => void;
}) {
  return (
    <div className="rounded-lg border bg-white p-3">
      <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
        <input
          className="w-full rounded-md border px-3 py-2 text-sm"
          placeholder="Search email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={marketId}
          onChange={(e) => setMarketId(e.target.value)}
        >
          <option value="">All markets</option>
          {markets.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="PENDING_PAYMENT">PENDING_PAYMENT</option>
          <option value="PENDING_EXTERNAL">PENDING_EXTERNAL</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="CANCELED">CANCELED</option>
        </select>

        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={paymentStatus}
          onChange={(e) => setPaymentStatus(e.target.value as PaymentStatusFilter)}
        >
          <option value="">All payment</option>
          <option value="PAID">PAID</option>
          <option value="PENDING">PENDING</option>
        </select>

        <select
          className="w-full rounded-md border px-3 py-2 text-sm"
          value={expiringDays}
          onChange={(e) => setExpiringDays(e.target.value as ExpiringFilter)}
        >
          <option value="">Expiring: All</option>
          <option value="7">Expiring in 1 week</option>
          <option value="14">Expiring in 2 weeks</option>
          <option value="30">Expiring in 1 month</option>
          <option value="90">Expiring in 3 months</option>
        </select>

        <button
          className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100 md:col-span-2"
          onClick={onApply}
          disabled={loading}
        >
          {loading ? "Loading..." : "Apply"}
        </button>

        <div className="flex items-center justify-end text-sm text-gray-600 md:col-span-4">
          {resp ? (
            <span>
              {resp.total} total • page {resp.page}/{totalPages}
            </span>
          ) : (
            <span>—</span>
          )}
        </div>
      </div>

      {error ? <div className="mt-2 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}