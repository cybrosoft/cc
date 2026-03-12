"use client";
// app/admin/subscriptions/ui/createSubscriptionModal.tsx

import { useEffect, useMemo, useState } from "react";
import { CLR, Modal, Field, Alert } from "@/components/ui/admin-ui";

// ── Types ─────────────────────────────────────────────────────────────────────
type CustomerOption = { id: string; email: string; marketId: string; customerGroupId: string | null };
type ProductOption  = {
  id: string; name: string; key: string;
  categoryKey: string | null; categoryName: string | null;
  billingPeriod: string; priceCents: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const LOCATIONS_SERVERS_G = ["Europe Central"] as const;
const LOCATIONS_SERVERS_O = [
  "Saudi Arabia - Jeddah", "Saudi Arabia - Riyadh", "United States",
  "United Kingdom", "United Arab Emirates", "Australia", "India",
  "Japan", "Malaysia", "Singapore", "South Korea",
] as const;

function locationsFor(categoryKey: string | null): readonly string[] | null {
  if (categoryKey === "servers-g") return LOCATIONS_SERVERS_G;
  if (categoryKey === "servers-o") return LOCATIONS_SERVERS_O;
  return null;
}

function fmtPrice(cents: number, period: string): string {
  const amt  = (cents / 100).toFixed(2);
  const lbl: Record<string, string> = { YEARLY: "/yr", SIX_MONTHS: "/6mo", MONTHLY: "/mo", ONE_TIME: "" };
  return `${amt} ${lbl[period] ?? ""}`.trim();
}

const inp: React.CSSProperties = {
  width: "100%", padding: "7px 10px", fontSize: 13, fontFamily: "inherit",
  background: "#fff", border: "1px solid #d1d5db", color: "#374151",
  outline: "none", boxSizing: "border-box" as const,
};

const label: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280",
  textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 5,
};

// ── Component ─────────────────────────────────────────────────────────────────
export function CreateSubscriptionModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingProducts,  setLoadingProducts]  = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products,  setProducts]  = useState<ProductOption[]>([]);
  const [custId,    setCustId]    = useState("");
  const [productId, setProductId] = useState("");
  const [location,  setLocation]  = useState("");
  const [details,   setDetails]   = useState("");
  const [note,      setNote]      = useState("");
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState<string | null>(null);

  const selectedCustomer = useMemo(() => customers.find(c => c.id === custId) ?? null, [customers, custId]);
  const selectedProduct  = useMemo(() => products.find(p => p.id === productId) ?? null, [products, productId]);
  const locationOptions  = useMemo(() => locationsFor(selectedProduct?.categoryKey ?? null), [selectedProduct]);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setCustId(""); setProductId(""); setLocation("");
    setDetails(""); setNote(""); setError(null); setSuccess(null);
    setProducts([]);
    setLoadingCustomers(true);
    fetch("/api/admin/subscriptions/create-form", { cache: "no-store" })
      .then(r => r.json()).catch(() => null)
      .then(j => { if (j?.ok) setCustomers(j.customers ?? []); })
      .finally(() => setLoadingCustomers(false));
  }, [open]);

  // Load products when customer changes
  useEffect(() => {
    if (!open || !custId) { setProducts([]); setProductId(""); return; }
    setLoadingProducts(true); setError(null); setProductId(""); setProducts([]);
    fetch(`/api/admin/subscriptions/eligible-products?customerId=${custId}`, { cache: "no-store" })
      .then(r => r.json()).catch(() => null)
      .then(j => {
        if (j?.ok) setProducts(j.products ?? []);
        else setError(j?.error ?? "PRODUCTS_FAILED");
      })
      .finally(() => setLoadingProducts(false));
  }, [open, custId]);

  // Set default location when product/options change
  useEffect(() => {
    setLocation(locationOptions?.[0] ?? "");
  }, [locationOptions, productId]);

  async function create() {
    if (!custId)    return setError("Please select a customer.");
    if (!productId) return setError("Please select a product.");
    if (locationOptions && !location) return setError("Please select a location.");
    setSaving(true); setError(null); setSuccess(null);
    try {
      const payload: Record<string, unknown> = { customerId: custId, productId };
      if (locationOptions) payload.location = location;
      if (details.trim()) payload.productDetails = details.trim();
      if (note.trim())    payload.productNote    = note.trim();
      const r = await fetch("/api/admin/subscriptions/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setError(j?.error ?? `CREATE_FAILED_${r.status}`); return; }
      setSuccess("Subscription created successfully.");
      onCreated();
      setTimeout(() => onClose(), 1200);
    } catch { setError("Network error."); }
    finally { setSaving(false); }
  }

  if (!open) return null;

  return (
    <Modal title="Add Subscription" onClose={onClose} width={560}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Customer */}
        <div>
          <span style={label}>Customer</span>
          <select style={inp} value={custId} onChange={e => { setCustId(e.target.value); setError(null); }}
            disabled={loadingCustomers || saving}>
            <option value="">{loadingCustomers ? "Loading…" : "— Select customer —"}</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.email}</option>)}
          </select>
        </div>

        {/* Product */}
        <div>
          <span style={label}>Product</span>
          <select style={inp} value={productId} onChange={e => { setProductId(e.target.value); setError(null); }}
            disabled={!custId || loadingProducts || saving}>
            <option value="">
              {!custId ? "Select customer first" : loadingProducts ? "Loading…" : "— Select product —"}
            </option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.key}) — {fmtPrice(p.priceCents, p.billingPeriod)}
                {p.categoryName ? ` · ${p.categoryName}` : ""}
              </option>
            ))}
          </select>
          {custId && !loadingProducts && products.length === 0 && !error && (
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>
              No priced products found for this customer's market/group.
            </div>
          )}
        </div>

        {/* Location — only for server products */}
        {locationOptions && (
          <div>
            <span style={label}>Location</span>
            <select style={inp} value={location} onChange={e => setLocation(e.target.value)} disabled={saving}>
              {locationOptions.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}

        {/* Details */}
        <div>
          <span style={label}>Details <span style={{ color: "#d1d5db", fontWeight: 400, textTransform: "none" as const }}>(customer-visible)</span></span>
          <textarea style={{ ...inp, resize: "vertical" }} rows={3} value={details}
            onChange={e => setDetails(e.target.value)} disabled={saving}
            placeholder="e.g. domain name, username, special requirements…" />
        </div>

        {/* Note */}
        <div>
          <span style={label}>Note <span style={{ color: "#d1d5db", fontWeight: 400, textTransform: "none" as const }}>(customer-visible)</span></span>
          <textarea style={{ ...inp, resize: "vertical" }} rows={3} value={note}
            onChange={e => setNote(e.target.value)} disabled={saving}
            placeholder="Extra notes, instructions, configuration…" />
        </div>

        {/* Error / Success */}
        {error   && <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", fontSize: 12.5, color: "#dc2626" }}>⚠ {error}</div>}
        {success && <div style={{ padding: "8px 12px", background: "#f0fdf4", border: "1px solid #86efac", fontSize: 12.5, color: "#15803d" }}>✓ {success}</div>}

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, borderTop: "1px solid #e5e7eb", paddingTop: 14 }}>
          <button onClick={onClose} disabled={saving} style={{
            padding: "7px 16px", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            background: "#fff", color: "#374151", border: "1px solid #d1d5db",
          }}>Cancel</button>
          <button onClick={create} disabled={saving || !custId || !productId} style={{
            padding: "7px 20px", fontSize: 13, fontWeight: 500, cursor: saving || !custId || !productId ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            background: saving || !custId || !productId ? "#9ca3af" : CLR.primary,
            color: "#fff", border: "none",
            opacity: saving || !custId || !productId ? 0.7 : 1,
          }}>{saving ? "Creating…" : "Create Subscription"}</button>
        </div>
      </div>
    </Modal>
  );
}