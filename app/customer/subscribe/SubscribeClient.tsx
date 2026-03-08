"use client";

import React, { useEffect, useMemo, useState } from "react";

type Product = {
  id: string;
  name: string;
  currency: string;
  yearlyPriceCents: number;
  introMonthCents: number | null;
};

type ProductsOk = { ok: true; data: Product[] };
type ProductsErr = { ok: false; error: string };
type ProductsResp = ProductsOk | ProductsErr;

type CreateOk = { ok: true; data: { id: string; status: string } };
type CreateErr = { ok: false; error: string };
type CreateResp = CreateOk | CreateErr;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function readBoolean(obj: Record<string, unknown>, key: string): boolean | null {
  const v = obj[key];
  return typeof v === "boolean" ? v : null;
}
function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

function isProductsResp(v: unknown): v is ProductsResp {
  if (!isRecord(v)) return false;
  const ok = readBoolean(v, "ok");
  if (ok === true) return Array.isArray(v["data"]);
  if (ok === false) return typeof readString(v, "error") === "string";
  return false;
}

function isCreateResp(v: unknown): v is CreateResp {
  if (!isRecord(v)) return false;
  const ok = readBoolean(v, "ok");
  if (ok === true) return isRecord(v["data"]) && typeof readString(v["data"] as Record<string, unknown>, "status") === "string";
  if (ok === false) return typeof readString(v, "error") === "string";
  return false;
}

function money(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

export default function SubscribeClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedProduct = useMemo(() => products.find((p) => p.id === selected) ?? null, [products, selected]);

  useEffect(() => {
    const load = async (): Promise<void> => {
      setLoadError(null);

      const res = await fetch("/api/customer/products", { cache: "no-store" });
      const raw = (await res.json().catch(() => null)) as unknown;

      if (!res.ok || raw === null || !isProductsResp(raw) || !raw.ok) {
        const err =
          raw && isProductsResp(raw) && !raw.ok
            ? raw.error
            : `Failed to load plans (HTTP ${res.status})`;
        setLoadError(err);
        setProducts([]);
        return;
      }

      setProducts(raw.data);
    };

    void load();
  }, []);

  async function create(): Promise<void> {
    if (!selected || loading) return;
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch("/api/customer/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: selected }),
      });

      const raw = (await res.json().catch(() => null)) as unknown;

      if (!res.ok || raw === null || !isCreateResp(raw) || !raw.ok) {
        const err = raw && isCreateResp(raw) && !raw.ok ? raw.error : `Failed (HTTP ${res.status})`;
        setMessage(err);
        return;
      }

      setMessage(
        raw.data.status === "PENDING_PAYMENT"
          ? "Subscription created. Please complete bank transfer."
          : "Subscription created. Waiting for external payment."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <h1 className="text-lg font-semibold">Select Plan</h1>

      {loadError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      <select
        className="w-full rounded-md border px-3 py-2 text-sm"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        disabled={products.length === 0}
      >
        <option value="">
          {products.length === 0 ? "No plans available" : "Choose plan"}
        </option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} — {money(p.yearlyPriceCents, p.currency)}
          </option>
        ))}
      </select>

      {selectedProduct ? (
        <div className="text-sm text-gray-700">
          <div>
            Yearly: <span className="font-medium">{money(selectedProduct.yearlyPriceCents, selectedProduct.currency)}</span>
          </div>
          {selectedProduct.introMonthCents != null ? (
            <div>
              Intro month: <span className="font-medium">{money(selectedProduct.introMonthCents, selectedProduct.currency)}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <button
        className="rounded-md border px-4 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
        disabled={!selected || loading}
        onClick={() => void create()}
      >
        {loading ? "Creating..." : "Create Subscription"}
      </button>

      {message ? (
        <div className="rounded-md border bg-white px-3 py-2 text-sm">
          {message}
        </div>
      ) : null}
    </div>
  );
}