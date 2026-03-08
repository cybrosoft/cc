// FILE: app/admin/subscriptions/ui/createSubscriptionModal.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  CreateFormResp,
  CustomerOption,
  EligibleResp,
  PricedProductOption,
  CreateSubResp,
} from "../subscriptionsTableTypes";
import { Modal } from "./modal";
import { isRecord, readBoolean, readString } from "./subscriptionsUtils";

function parseCreateForm(raw: unknown): CreateFormResp | null {
  if (!isRecord(raw)) return null;
  const ok = readBoolean(raw, "ok");
  if (ok === true) {
    const customers = raw["customers"];
    if (!Array.isArray(customers)) return null;
    return { ok: true, customers: customers as CustomerOption[] };
  }
  if (ok === false) return { ok: false, error: readString(raw, "error") ?? "UNKNOWN_ERROR" };
  return null;
}

function parseEligible(raw: unknown): EligibleResp | null {
  if (!isRecord(raw)) return null;
  const ok = readBoolean(raw, "ok");
  if (ok === true) {
    const products = raw["products"];
    if (!Array.isArray(products)) return null;
    return { ok: true, products: products as PricedProductOption[] };
  }
  if (ok === false) return { ok: false, error: readString(raw, "error") ?? "UNKNOWN_ERROR" };
  return null;
}

function parseCreate(raw: unknown): CreateSubResp | null {
  if (!isRecord(raw)) return null;
  const ok = readBoolean(raw, "ok");
  if (ok === true) {
    const subscriptionId = readString(raw, "subscriptionId");
    if (!subscriptionId) return null;
    return { ok: true, subscriptionId };
  }
  if (ok === false) return { ok: false, error: readString(raw, "error") ?? "UNKNOWN_ERROR" };
  return null;
}

function money(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

const LOCATIONS_SERVERS_G = ["Europe Central"] as const;

const LOCATIONS_SERVERS_O = [
  "Saudi Arabia - Jeddah",
  "Saudi Arabia - Riyadh",
  "United States",
  "United Kingdome",
  "United Aarab Emirates",
  "Australia",
  "India",
  "Japan",
  "Malaysia",
  "Singapore",
  "South Korea",
] as const;

function locationsForCategoryKey(categoryKey: string | null | undefined): readonly string[] | null {
  if (!categoryKey) return null;
  if (categoryKey === "servers-g") return LOCATIONS_SERVERS_G;
  if (categoryKey === "servers-o") return LOCATIONS_SERVERS_O;
  return null;
}

export function CreateSubscriptionModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [custId, setCustId] = useState("");
  const [products, setProducts] = useState<PricedProductOption[]>([]);
  const [productId, setProductId] = useState("");

  // Location (servers only)
  const [location, setLocation] = useState<string>("");

  // ✅ NEW: customer-visible content
  const [productDetails, setProductDetails] = useState<string>("");
  const [productNote, setProductNote] = useState<string>("");

  const [msg, setMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyCreate, setBusyCreate] = useState(false);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === custId) ?? null, [customers, custId]);
  const selectedProduct = useMemo(() => products.find((p) => p.id === productId) ?? null, [products, productId]);

  const categoryKey = selectedProduct?.categoryKey ?? null;
  const locationOptions = useMemo(() => locationsForCategoryKey(categoryKey), [categoryKey]);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    setCustomers([]);
    setCustId("");
    setProducts([]);
    setProductId("");
    setLocation("");

    // ✅ NEW reset
    setProductDetails("");
    setProductNote("");

    setMsg(null);
    setSuccess(null);
    setBusyCreate(false);

    void (async () => {
      try {
        const res = await fetch("/api/admin/subscriptions/create-form", { cache: "no-store" });
        const raw = (await res.json().catch(() => null)) as unknown;
        const parsed = parseCreateForm(raw);

        if (!res.ok || !parsed || !parsed.ok) {
          setMsg(parsed && !parsed.ok ? parsed.error : `LOAD_FAILED_${res.status}`);
          return;
        }

        setCustomers(parsed.customers);
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (!selectedCustomer) {
      setProducts([]);
      setProductId("");
      setLocation("");
      return;
    }

    setMsg(null);
    setSuccess(null);
    setProducts([]);
    setProductId("");
    setLocation("");

    void (async () => {
      const qs = new URLSearchParams();
      qs.set("customerId", selectedCustomer.id);

      const res = await fetch(`/api/admin/subscriptions/eligible-products?${qs.toString()}`, { cache: "no-store" });
      const raw = (await res.json().catch(() => null)) as unknown;
      const parsed = parseEligible(raw);

      if (!res.ok || !parsed || !parsed.ok) {
        setMsg(parsed && !parsed.ok ? parsed.error : `PRODUCTS_FAILED_${res.status}`);
        return;
      }

      setProducts(parsed.products);
    })();
  }, [open, selectedCustomer]);

  // When product changes, set default location if needed
  useEffect(() => {
    if (!open) return;
    if (!locationOptions) {
      setLocation("");
      return;
    }
    const first = locationOptions[0] ?? "";
    setLocation(first);
  }, [open, locationOptions, productId]);

  async function create(): Promise<void> {
    if (!selectedCustomer) return setMsg("Select a customer.");
    if (!selectedProduct) return setMsg("Select a product.");

    if (locationOptions && !location) return setMsg("Select a location.");

    setBusyCreate(true);
    setMsg(null);
    setSuccess(null);

    try {
      const payload: {
        customerId: string;
        productId: string;
        location?: string;
        productDetails?: string;
        productNote?: string;
      } = {
        customerId: selectedCustomer.id,
        productId: selectedProduct.id,
      };

      if (locationOptions) payload.location = location;

      // ✅ NEW: send trimmed values (backend stores null if empty)
      const d = productDetails.trim();
      const n = productNote.trim();
      if (d) payload.productDetails = d;
      if (n) payload.productNote = n;

      const res = await fetch("/api/admin/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });

      const raw = (await res.json().catch(() => null)) as unknown;
      const parsed = parseCreate(raw);

      if (!res.ok || !parsed || !parsed.ok) {
        setMsg(parsed && !parsed.ok ? parsed.error : `CREATE_FAILED_${res.status}`);
        return;
      }

      setSuccess("Subscription created");
      onCreated();
    } finally {
      setBusyCreate(false);
    }
  }

  if (!open) return null;

  return (
    <Modal title="Add Subscription" onClose={onClose}>
      <div className="space-y-3">
        {loading ? <div className="text-sm text-gray-600">Loading…</div> : null}

        <div className="space-y-1">
          <label className="text-sm font-medium">Customer</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={custId}
            onChange={(e) => setCustId(e.target.value)}
            disabled={loading || busyCreate}
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.email}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Product</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            disabled={!selectedCustomer || busyCreate}
          >
            <option value="">{!selectedCustomer ? "Select customer first" : "Select product"}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.key}) — {money(p.yearlyPriceCents, p.currency)}
                {p.introMonthCents != null ? ` / Intro ${money(p.introMonthCents, p.currency)}` : ""}
              </option>
            ))}
          </select>
          {selectedCustomer && products.length === 0 ? (
            <div className="text-xs text-gray-500">No priced products for this customer’s market/group.</div>
          ) : null}
        </div>

        {/* Location dropdown only for servers-g / servers-o */}
        {locationOptions ? (
          <div className="space-y-1">
            <label className="text-sm font-medium">Location</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={busyCreate}
            >
              {locationOptions.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {/* ✅ NEW: Details + Note (customer-visible) */}
        <div className="space-y-1">
          <label className="text-sm font-medium">Details</label>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm"
            rows={3}
            value={productDetails}
            onChange={(e) => setProductDetails(e.target.value)}
            placeholder="e.g. domain name, username, special requirements…"
            disabled={busyCreate}
          />
          <div className="text-xs text-gray-500">Shown to the customer on their dashboard.</div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">Note</label>
          <textarea
            className="w-full rounded-md border px-3 py-2 text-sm"
            rows={4}
            value={productNote}
            onChange={(e) => setProductNote(e.target.value)}
            placeholder="Extra notes (instructions, configuration, anything the customer should see)…"
            disabled={busyCreate}
          />
          <div className="text-xs text-gray-500">Also customer-visible.</div>
        </div>

        {msg ? (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700">{msg}</div>
        ) : null}

        {success ? (
          <div className="rounded-md border border-green-200 bg-green-50 p-2 text-sm text-green-700">{success}</div>
        ) : null}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100" onClick={onClose} disabled={busyCreate}>
            Close
          </button>

          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
            onClick={() => void create()}
            disabled={busyCreate || !selectedCustomer || !selectedProduct}
          >
            {busyCreate ? "Submitting..." : "Create"}
          </button>
        </div>
      </div>
    </Modal>
  );
}