"use client";
// app/admin/subscriptions/ui/createSubscriptionModal.tsx
// Rich new-subscription form: customer → products with pricing pills → billing period →
// location + OS template → addons → start date → price override → running total

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CustomerOption,
  CreateSubResp,
} from "../subscriptionsTableTypes";
import { isRecord, readBoolean, readString } from "./subscriptionsUtils";

// ─── Extended types ────────────────────────────────────────────────────────────
type Tag = { id: string; key: string; name: string };

type RichProduct = {
  id: string;
  name: string;
  key: string;
  type: "plan" | "addon" | "service" | "product";
  category: { id: string; key: string; name: string } | null;
  tags: Tag[];
  billingPeriods: string[];
  prices: Array<{ billingPeriod: string; priceCents: number; currency: string; isOverride: boolean }>;
  // addon-specific
  addonPricingType: string | null; // "fixed" | "percentage" | "per_unit" | null
  addonBehavior: string | null;    // "optional" | "required" | null
  addonUnitLabel: string | null;
  addonMinUnits: number | null;
  addonMaxUnits: number | null;
  addonPercentage: number | null;
  applicableTags: string[];        // tag keys that trigger this addon
  // metered
  unitLabel: string | null;
};

type RichEligibleResp = {
  ok: true;
  currency: string;
  customerGroup: string;
  market: { key: string; name: string };
  plans: RichProduct[];
  addons: RichProduct[];
  services: RichProduct[];
};

type LocationRow = {
  id: string; code: string; name: string; flag: string | null;
  family: string | null; includeTags: string[]; excludeTags: string[];
  status: string; isDefault: boolean;
};

type OsTemplateRow = {
  id: string; slug: string; name: string; family: string | null;
  iconType: string; iconValue: string | null; category: string;
  includeTags: string[]; excludeTags: string[]; isDefault: boolean; status: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PERIOD_LABELS: Record<string, string> = {
  MONTHLY:    "Monthly",
  SIX_MONTHS: "6 Months",
  YEARLY:     "Yearly",
  ONE_TIME:   "One-time",
};

function fmt(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function locationMatchesProduct(loc: LocationRow, productTagKeys: string[]): boolean {
  if (loc.status !== "active") return false;
  if (loc.includeTags.length === 0 && loc.excludeTags.length === 0) return true;
  const hasInclude = loc.includeTags.length === 0 || loc.includeTags.some(t => productTagKeys.includes(t));
  const hasExclude = loc.excludeTags.some(t => productTagKeys.includes(t));
  return hasInclude && !hasExclude;
}

function templateMatchesProduct(tmpl: OsTemplateRow, productTagKeys: string[]): boolean {
  if (tmpl.status !== "active") return false;
  if (tmpl.includeTags.length === 0 && tmpl.excludeTags.length === 0) return true;
  const hasInclude = tmpl.includeTags.length === 0 || tmpl.includeTags.some(t => productTagKeys.includes(t));
  const hasExclude = tmpl.excludeTags.some(t => productTagKeys.includes(t));
  return hasInclude && !hasExclude;
}

// ─── Design tokens (matching admin-ui flat style) ─────────────────────────────
const C = {
  primary:   "#318774",
  primaryBg: "#eaf4f2",
  border:    "#d1d5db",
  borderL:   "#f3f4f6",
  text:      "#111827",
  muted:     "#6b7280",
  faint:     "#9ca3af",
  header:    "#222222",
};

const INP: React.CSSProperties = {
  padding: "7px 10px", fontSize: 13, fontFamily: "inherit",
  background: "#fff", border: `1px solid ${C.border}`,
  color: C.text, outline: "none", width: "100%", boxSizing: "border-box" as const,
};

const LABEL: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: "0.07em",
  textTransform: "uppercase" as const, color: C.faint, marginBottom: 6,
};

function Section({ title, icon, children, dim }: { title: string; icon?: string; children: React.ReactNode; dim?: boolean }) {
  return (
    <div style={{ marginBottom: 20, opacity: dim ? 0.4 : 1, pointerEvents: dim ? "none" : undefined, transition: "opacity 0.2s" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
        <span style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

// Searchable dropdown
function SearchableSelect({
  options, value, onChange, placeholder, renderItem, keyExtractor, labelExtractor, disabled,
}: {
  options: unknown[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  renderItem: (item: unknown) => React.ReactNode;
  keyExtractor: (item: unknown) => string;
  labelExtractor: (item: unknown) => string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(o => labelExtractor(o).toLowerCase().includes(q));
  }, [options, query, labelExtractor]);

  const selectedLabel = useMemo(() => {
    const found = options.find(o => keyExtractor(o) === value);
    return found ? labelExtractor(found) : "";
  }, [options, value, keyExtractor, labelExtractor]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div
        style={{
          ...INP, cursor: disabled ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: disabled ? "#f9fafb" : "#fff", color: selectedLabel ? C.text : C.faint,
        }}
        onClick={() => { if (!disabled) { setOpen(o => !o); setQuery(""); } }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedLabel || placeholder}
        </span>
        <span style={{ fontSize: 10, color: C.faint, flexShrink: 0, marginLeft: 8 }}>▾</span>
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, right: 0, zIndex: 100,
          background: "#fff", border: `1px solid ${C.border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          maxHeight: 260, overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: 8, borderBottom: `1px solid ${C.borderL}` }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              style={{ ...INP, padding: "5px 8px", fontSize: 12 }}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ overflowY: "auto", flex: 1 }}>
            {filtered.length === 0 && (
              <div style={{ padding: "16px 12px", color: C.faint, fontSize: 12, textAlign: "center" }}>No results</div>
            )}
            {filtered.map(o => {
              const k = keyExtractor(o);
              const isSelected = k === value;
              return (
                <div
                  key={k}
                  onClick={() => { onChange(k); setOpen(false); setQuery(""); }}
                  style={{
                    padding: "8px 12px", cursor: "pointer", fontSize: 13,
                    background: isSelected ? C.primaryBg : "#fff",
                    color: isSelected ? C.primary : C.text,
                    borderBottom: `1px solid ${C.borderL}`,
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#f9fafb"; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#fff"; }}
                >
                  {renderItem(o)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Addon row ────────────────────────────────────────────────────────────────
type AddonState = {
  selected: boolean;
  quantity: number;
};

function AddonRow({
  addon, currency, billingPeriod, state, onChange,
}: {
  addon: RichProduct;
  currency: string;
  billingPeriod: string;
  state: AddonState;
  onChange: (s: AddonState) => void;
}) {
  const isPerUnit = addon.addonPricingType === "per_unit";
  const isPercent = addon.addonPricingType === "percentage";
  const isRequired = addon.addonBehavior === "required";

  // Always use parent billing period — addons follow the plan's period
  const price = addon.prices.find(p => p.billingPeriod === billingPeriod) ?? addon.prices[0];

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "10px 12px",
      background: state.selected ? C.primaryBg : "#fff",
      border: `1px solid ${state.selected ? C.primary + "55" : C.border}`,
      marginBottom: 6, transition: "all 0.15s",
    }}>
      {/* Checkbox */}
      <div style={{ paddingTop: 2 }}>
        <input
          type="checkbox"
          checked={state.selected || isRequired}
          disabled={isRequired}
          onChange={e => onChange({ ...state, selected: e.target.checked })}
          style={{ width: 15, height: 15, cursor: isRequired ? "default" : "pointer", accentColor: C.primary }}
        />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{addon.name}</span>
          {isRequired && (
            <span style={{ fontSize: 10, padding: "1px 6px", background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", fontWeight: 700 }}>REQUIRED</span>
          )}
          {isPerUnit && (
            <span style={{ fontSize: 10, padding: "1px 6px", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", fontWeight: 700 }}>
              PER {(addon.addonUnitLabel ?? "UNIT").toUpperCase()}
            </span>
          )}
          {isPercent && (
            <span style={{ fontSize: 10, padding: "1px 6px", background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", fontWeight: 700 }}>
              {addon.addonPercentage ?? "?"}% OF PLAN
            </span>
          )}
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: C.faint, marginTop: 1 }}>{addon.key}</div>
      </div>

      {/* Quantity */}
      {isPerUnit && state.selected && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: C.faint }}>{addon.addonUnitLabel ?? "Units"}</div>
          <input
            type="number"
            value={state.quantity}
            min={addon.addonMinUnits ?? 1}
            max={addon.addonMaxUnits ?? 9999}
            onChange={e => onChange({ ...state, quantity: Math.max(addon.addonMinUnits ?? 1, Number(e.target.value)) })}
            style={{ ...INP, width: 70, textAlign: "right", padding: "4px 8px" }}
          />
        </div>
      )}

      {/* Price display — percentage addons have no pricing rows so we show % directly */}
      {isPercent ? (
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#b45309" }}>
            {addon.addonPercentage ?? "?"}%
          </div>
          <div style={{ fontSize: 10, color: C.faint }}>of plan total</div>
        </div>
      ) : price ? (
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>
            {fmt(price.priceCents * (isPerUnit ? state.quantity : 1), price.currency)}
          </div>
          <div style={{ fontSize: 10, color: C.faint }}>{PERIOD_LABELS[price.billingPeriod] ?? price.billingPeriod}</div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export function CreateSubscriptionModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  // ── Step data ──────────────────────────────────────────────────────────────
  const [loadingForm, setLoadingForm] = useState(false);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [custId, setCustId] = useState("");

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [eligible, setEligible] = useState<RichEligibleResp | null>(null);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [templates, setTemplates] = useState<OsTemplateRow[]>([]);

  // Selections
  const [planId, setPlanId] = useState("");
  const [billingPeriod, setBillingPeriod] = useState("");
  const [planQty, setPlanQty] = useState(1);
  const [locationCode, setLocationCode] = useState("");
  const [templateSlug, setTemplateSlug] = useState("");
  const [addonStates, setAddonStates] = useState<Record<string, AddonState>>({});
  const [startDate, setStartDate] = useState("");
  const [overridePrice, setOverridePrice] = useState(false);
  const [manualTotal, setManualTotal] = useState("");

  const [productDetails, setProductDetails] = useState("");
  const [productNote, setProductNote] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedCustomer = useMemo(() => customers.find(c => c.id === custId) ?? null, [customers, custId]);
  const selectedPlan = useMemo(() => eligible?.plans.find(p => p.id === planId) ?? null, [eligible, planId]);

  const planTagKeys = useMemo(() => selectedPlan?.tags.map(t => t.key) ?? [], [selectedPlan]);

  const planPrice = useMemo(() => {
    if (!selectedPlan || !billingPeriod) return null;
    return selectedPlan.prices.find(p => p.billingPeriod === billingPeriod) ?? null;
  }, [selectedPlan, billingPeriod]);

  const currency = eligible?.currency ?? "SAR";

  const isPlanMetered = useMemo(() => selectedPlan?.tags.some(t => t.key === "metered") ?? false, [selectedPlan]);

  // Filter eligible addons based on plan tags
  const visibleAddons = useMemo(() => {
    if (!eligible || !selectedPlan) return [];
    return eligible.addons
      .filter(addon => {
        if (addon.applicableTags.length === 0) return true; // applies to all
        return addon.applicableTags.some(t => planTagKeys.includes(t));
      })
      // Required addons always first, then optional alphabetically
      .sort((a, b) => {
        const aReq = a.addonBehavior === "required" ? 0 : 1;
        const bReq = b.addonBehavior === "required" ? 0 : 1;
        if (aReq !== bReq) return aReq - bReq;
        return a.name.localeCompare(b.name);
      });
  }, [eligible, selectedPlan, planTagKeys]);

  const visibleServices = useMemo(() => eligible?.services ?? [], [eligible]);

  // Filtered locations & templates
  const filteredLocations = useMemo(
    () => locations.filter(l => locationMatchesProduct(l, planTagKeys)),
    [locations, planTagKeys],
  );
  const filteredTemplates = useMemo(
    () => templates.filter(t => templateMatchesProduct(t, planTagKeys)),
    [templates, planTagKeys],
  );

  const showLocationTemplate = filteredLocations.length > 0 || filteredTemplates.length > 0;

  // Running total
  const computedTotal = useMemo(() => {
    if (!planPrice) return 0;
    let total = planPrice.priceCents * (isPlanMetered ? planQty : 1);
    for (const addon of visibleAddons) {
      const state = addonStates[addon.id];
      if (!state?.selected && addon.addonBehavior !== "required") continue;
      if (addon.addonPricingType === "percentage") {
        total += Math.round(total * ((addon.addonPercentage ?? 0) / 100));
      } else {
        const addonPrice = addon.prices.find(p => p.billingPeriod === billingPeriod) ?? addon.prices[0];
        if (addonPrice) {
          const qty = addon.addonPricingType === "per_unit" ? (state?.quantity ?? addon.addonMinUnits ?? 1) : 1;
          total += addonPrice.priceCents * qty;
        }
      }
    }
    return total;
  }, [planPrice, isPlanMetered, planQty, billingPeriod, visibleAddons, addonStates]);

  // ── Load on open ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setLoadingForm(true);
    setCustId(""); setPlanId(""); setBillingPeriod(""); setPlanQty(1);
    setLocationCode(""); setTemplateSlug(""); setAddonStates({});
    setStartDate(""); setOverridePrice(false); setManualTotal("");
    setProductDetails(""); setProductNote("");
    setEligible(null); setMsg(null);

    void (async () => {
      try {
        const [custResp, locResp, tmplResp] = await Promise.all([
          fetch("/api/admin/subscriptions/create-form", { cache: "no-store" }).then(r => r.json()).catch(() => null),
          fetch("/api/admin/catalog/locations", { cache: "no-store" }).then(r => r.json()).catch(() => null),
          fetch("/api/admin/catalog/templates", { cache: "no-store" }).then(r => r.json()).catch(() => null),
        ]);
        if (custResp?.ok) setCustomers(custResp.customers ?? []);
        if (locResp?.ok)  setLocations(locResp.data ?? []);
        if (tmplResp?.ok) setTemplates(tmplResp.data ?? []);
      } finally {
        setLoadingForm(false);
      }
    })();
  }, [open]);

  // ── Load eligible products when customer changes ───────────────────────────
  useEffect(() => {
    if (!open || !custId) { setEligible(null); setPlanId(""); setBillingPeriod(""); return; }
    setLoadingProducts(true);
    setPlanId(""); setBillingPeriod(""); setAddonStates({});

    void (async () => {
      try {
        const r = await fetch(`/api/admin/subscriptions/eligible-products?customerId=${custId}&rich=1`, { cache: "no-store" });
        const j = await r.json().catch(() => null) as unknown;
        if (isRecord(j) && readBoolean(j, "ok")) {
          setEligible(j as unknown as RichEligibleResp);
        } else {
          setMsg(isRecord(j) ? (readString(j, "error") ?? "Failed to load products") : "Failed to load products");
        }
      } finally {
        setLoadingProducts(false);
      }
    })();
  }, [open, custId]);

  // ── Auto-select first billing period when plan changes ─────────────────────
  useEffect(() => {
    if (selectedPlan) {
      // Drive from prices[] — billingPeriods[] on the product may be empty
      // even when pricing rows exist for that product
      const PERIOD_ORDER = ["MONTHLY", "SIX_MONTHS", "YEARLY", "ONE_TIME"];
      const sorted = [...selectedPlan.prices].sort(
        (a, b) => PERIOD_ORDER.indexOf(a.billingPeriod) - PERIOD_ORDER.indexOf(b.billingPeriod)
      );
      setBillingPeriod(sorted[0]?.billingPeriod ?? "");
    } else {
      setBillingPeriod("");
    }
    setAddonStates({});
  }, [selectedPlan]);

  // ── Auto-defaults for location / template ─────────────────────────────────
  useEffect(() => {
    if (filteredLocations.length > 0) {
      const def = filteredLocations.find(l => l.isDefault) ?? filteredLocations[0];
      setLocationCode(def.code);
    } else {
      setLocationCode("");
    }
  }, [filteredLocations]);

  useEffect(() => {
    if (filteredTemplates.length > 0) {
      const def = filteredTemplates.find(t => t.isDefault) ?? filteredTemplates[0];
      setTemplateSlug(def.slug);
    } else {
      setTemplateSlug("");
    }
  }, [filteredTemplates]);

  // ── Addon state init when addon list changes ───────────────────────────────
  useEffect(() => {
    setAddonStates(prev => {
      const next: Record<string, AddonState> = {};
      for (const a of visibleAddons) {
        next[a.id] = prev[a.id] ?? {
          selected: a.addonBehavior === "required",
          quantity: a.addonMinUnits ?? 1,
        };
      }
      return next;
    });
  }, [visibleAddons, billingPeriod]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!selectedCustomer) return setMsg("Select a customer.");
    if (!selectedPlan)     return setMsg("Select a plan or service.");
    if (!billingPeriod)    return setMsg("Select a billing period.");

    setBusy(true); setMsg(null);
    try {
      const selectedAddonIds = visibleAddons
        .filter(a => a.addonBehavior === "required" || addonStates[a.id]?.selected)
        .map(a => ({
          productId: a.id,
          quantity: addonStates[a.id]?.quantity ?? 1,
        }));

      const payload: Record<string, unknown> = {
        customerId:     selectedCustomer.id,
        productId:      selectedPlan.id,
        billingPeriod,
        quantity:       isPlanMetered ? planQty : 1,
        locationCode:   locationCode || null,
        templateSlug:   templateSlug || null,
        addonIds:       selectedAddonIds,
        startDate:      startDate || null,
        productDetails: productDetails.trim() || null,
        productNote:    productNote.trim() || null,
      };

      if (overridePrice && manualTotal.trim()) {
        payload.manualPriceCents = Math.round(parseFloat(manualTotal) * 100);
      }

      const r = await fetch("/api/admin/subscriptions/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => null) as unknown;
      if (!r.ok || !isRecord(j) || !readBoolean(j, "ok")) {
        setMsg(isRecord(j) ? (readString(j, "error") ?? "Create failed") : "Create failed");
        return;
      }
      onCreated();
      onClose();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  if (!open) return null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200,
      background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      overflowY: "auto", padding: "20px 16px",
    }}>
      <div style={{
        width: "100%", maxWidth: 820,
        background: "#fff",
        boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        marginBottom: 20,
      }}>
        {/* Modal header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 20px", background: C.header, borderBottom: `1px solid #333`,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Add Subscription</div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Create a new subscription for a customer</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "1px solid #444", color: "#9ca3af", cursor: "pointer", padding: "4px 10px", fontSize: 12, fontFamily: "inherit" }}
          >
            ✕ Close
          </button>
        </div>

        {/* Body */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", minHeight: 500 }}>

          {/* Left — form */}
          <div style={{ padding: 24, borderRight: `1px solid ${C.borderL}`, overflowY: "auto", maxHeight: "80vh" }}>

            {loadingForm && (
              <div style={{ textAlign: "center", padding: 40, color: C.faint, fontSize: 13 }}>Loading form…</div>
            )}

            {!loadingForm && (
              <>
                {/* ─ 1. Customer ─────────────────────────────────────────── */}
                <Section>
                  <div style={LABEL}>Select customer</div>
                  <SearchableSelect
                    options={customers}
                    value={custId}
                    onChange={setCustId}
                    placeholder="Search by email…"
                    keyExtractor={o => (o as CustomerOption).id}
                    labelExtractor={o => (o as CustomerOption).email}
                    renderItem={o => {
                      const c = o as CustomerOption;
                      return (
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500 }}>{c.email}</div>
                        </div>
                      );
                    }}
                  />
                  {/* Auto-show market + group */}
                  {selectedCustomer && eligible && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 11, padding: "2px 8px", background: "#f3f4f6", color: C.muted, border: "1px solid #e5e7eb" }}>
                        Market: {eligible.market.name}
                      </span>
                      <span style={{ fontSize: 11, padding: "2px 8px", background: "#f3f4f6", color: C.muted, border: "1px solid #e5e7eb" }}>
                        {eligible.customerGroup}
                      </span>
                      <span style={{ fontSize: 11, padding: "2px 8px", background: "#f3f4f6", color: C.muted, border: "1px solid #e5e7eb" }}>
                        {eligible.currency}
                      </span>
                    </div>
                  )}
                  {custId && loadingProducts && (
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>Loading products…</div>
                  )}
                </Section>

                {/* ─ 2. Product ─────────────────────────────────────────── */}
                <Section title="Plan or Service" icon="📦" dim={!custId || loadingProducts}>
                  {eligible && eligible.plans.length === 0 && eligible.services.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#dc2626", padding: "10px 12px", background: "#fef2f2", border: "1px solid #fca5a5" }}>
                      No priced products available for this customer's market and group.
                    </div>
                  ) : (
                    <>
                      {/* Searchable product dropdown */}
                      {eligible && (
                        <SearchableSelect
                          options={[...eligible.plans, ...eligible.services]}
                          value={planId}
                          onChange={setPlanId}
                          placeholder={loadingProducts ? "Loading products…" : "Search by name, ID or tag…"}
                          disabled={!eligible || loadingProducts}
                          keyExtractor={o => (o as RichProduct).id}
                          labelExtractor={o => {
                            const p = o as RichProduct;
                            return `${p.name} · ${p.key}`;
                          }}
                          renderItem={o => {
                            const p = o as RichProduct;
                            const isMetered = p.tags.some(t => t.key === "metered");
                            return (
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                {/* Type chip */}
                                <span style={{
                                  fontSize: 9, fontWeight: 700, padding: "1px 6px", flexShrink: 0,
                                  background: p.type === "plan" ? "#eff6ff" : p.type === "addon" ? "#f5f3ff" : "#fffbeb",
                                  color:      p.type === "plan" ? "#1d4ed8" : p.type === "addon" ? "#7c3aed" : "#b45309",
                                  border:     `1px solid ${p.type === "plan" ? "#bfdbfe" : p.type === "addon" ? "#ddd6fe" : "#fde68a"}`,
                                }}>{p.type.toUpperCase()}</span>

                                {/* Name + ID */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</div>
                                  <div style={{ fontFamily: "monospace", fontSize: 10, color: C.faint }}>{p.key}</div>
                                </div>

                                {/* Tags */}
                                <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 140 }}>
                                  {isMetered && (
                                    <span style={{ fontSize: 9, padding: "1px 5px", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>
                                      METERED
                                    </span>
                                  )}
                                  {p.tags.filter(t => t.key !== "metered").slice(0, 3).map(t => (
                                    <span key={t.key} style={{ fontSize: 9, padding: "1px 5px", background: "#f3f4f6", color: C.muted, border: `1px solid ${C.border}` }}>
                                      {t.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          }}
                        />
                      )}

                      {/* Selected product summary strip */}
                      {selectedPlan && (
                        <div style={{
                          marginTop: 8, padding: "8px 12px",
                          background: C.primaryBg, border: `1px solid ${C.primary}33`,
                          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
                        }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.primary }}>{selectedPlan.name}</span>
                          <span style={{ fontFamily: "monospace", fontSize: 10, color: C.faint }}>{selectedPlan.key}</span>
                          {selectedPlan.tags.map(t => (
                            <span key={t.key} style={{ fontSize: 9, padding: "1px 6px", background: "#fff", color: C.muted, border: `1px solid ${C.border}` }}>
                              {t.name}
                            </span>
                          ))}
                          {selectedPlan.prices[0]?.isOverride && (
                            <span style={{ fontSize: 9, padding: "1px 6px", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", marginLeft: "auto" }}>
                              ★ Enterprise price
                            </span>
                          )}
                        </div>
                      )}

                      {/* 2a. Metered quantity */}
                      {selectedPlan && isPlanMetered && (
                        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a" }}>
                          <span style={{ fontSize: 11, color: "#92400e", fontWeight: 600 }}>Quantity</span>
                          <span style={{ fontSize: 11, color: "#b45309" }}>per {selectedPlan.unitLabel ?? "unit"}</span>
                          <input
                            type="number"
                            value={planQty}
                            min={1}
                            onChange={e => setPlanQty(Math.max(1, Number(e.target.value)))}
                            style={{ ...INP, width: 80, padding: "4px 8px", marginLeft: "auto" }}
                          />
                        </div>
                      )}

                      {/* ─ 3. Billing Period pills — driven by prices[], shown once product selected ── */}
                      {selectedPlan && selectedPlan.prices.length > 0 && (
                        <div style={{ marginTop: 14 }}>
                          <div style={{ ...LABEL, marginBottom: 8 }}>Billing Period</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            {[...selectedPlan.prices]
                              .sort((a, b) => ["MONTHLY","SIX_MONTHS","YEARLY","ONE_TIME"].indexOf(a.billingPeriod) - ["MONTHLY","SIX_MONTHS","YEARLY","ONE_TIME"].indexOf(b.billingPeriod))
                              .map(price => {
                              const period = price.billingPeriod;
                              const isActive = billingPeriod === period;
                              return (
                                <button
                                  key={period}
                                  type="button"
                                  onClick={() => setBillingPeriod(period)}
                                  style={{
                                    padding: "9px 18px", fontFamily: "inherit", cursor: "pointer",
                                    background: isActive ? C.primary : "#fff",
                                    color:      isActive ? "#fff" : C.text,
                                    border:     `2px solid ${isActive ? C.primary : C.border}`,
                                    transition: "all 0.12s",
                                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                                    minWidth: 90,
                                  }}
                                >
                                  <span style={{ fontSize: 13, fontWeight: 700 }}>{PERIOD_LABELS[period] ?? period}</span>
                                  {price && (
                                    <span style={{ fontSize: 11, fontWeight: 500, opacity: isActive ? 0.92 : 0.7 }}>
                                      {fmt(price.priceCents, price.currency)}
                                      {price.isOverride && <span style={{ marginLeft: 3, fontSize: 9 }}>★</span>}
                                    </span>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </Section>

                {/* ─ 4 & 5. Location + OS Template ──────────────────────── */}
                {selectedPlan && showLocationTemplate && (
                  <Section title="Location & Template" icon="📍">
                    <div style={{ display: "grid", gridTemplateColumns: filteredLocations.length > 0 && filteredTemplates.length > 0 ? "1fr 1fr" : "1fr", gap: 12 }}>
                      {filteredLocations.length > 0 && (
                        <div>
                          <div style={LABEL}>Location</div>
                          <SearchableSelect
                            options={filteredLocations}
                            value={locationCode}
                            onChange={setLocationCode}
                            placeholder="Select location…"
                            keyExtractor={o => (o as LocationRow).code}
                            labelExtractor={o => {
                              const l = o as LocationRow;
                              return `${l.flag ? l.flag + " " : ""}${l.name}`;
                            }}
                            renderItem={o => {
                              const l = o as LocationRow;
                              return (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {l.flag && <span style={{ fontSize: 16 }}>{l.flag}</span>}
                                  <div>
                                    <div style={{ fontWeight: 500 }}>{l.name}</div>
                                    {l.family && <div style={{ fontSize: 11, color: C.faint }}>{l.family}</div>}
                                  </div>
                                  {l.isDefault && <span style={{ fontSize: 9, padding: "1px 5px", background: C.primaryBg, color: C.primary, border: "1px solid #a7d9d1", marginLeft: "auto" }}>DEFAULT</span>}
                                </div>
                              );
                            }}
                          />
                        </div>
                      )}
                      {filteredTemplates.length > 0 && (
                        <div>
                          <div style={LABEL}>OS Template</div>
                          <SearchableSelect
                            options={filteredTemplates}
                            value={templateSlug}
                            onChange={setTemplateSlug}
                            placeholder="Select template…"
                            keyExtractor={o => (o as OsTemplateRow).slug}
                            labelExtractor={o => (o as OsTemplateRow).name}
                            renderItem={o => {
                              const t = o as OsTemplateRow;
                              return (
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {t.iconType === "devicon" && t.iconValue && (
                                    <i className={t.iconValue} style={{ fontSize: 18, color: C.muted }} />
                                  )}
                                  <div>
                                    <div style={{ fontWeight: 500 }}>{t.name}</div>
                                    {t.family && <div style={{ fontSize: 11, color: C.faint }}>{t.family}</div>}
                                  </div>
                                  {t.isDefault && <span style={{ fontSize: 9, padding: "1px 5px", background: C.primaryBg, color: C.primary, border: "1px solid #a7d9d1", marginLeft: "auto" }}>DEFAULT</span>}
                                </div>
                              );
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </Section>
                )}

                {/* ─ 6. Addons ──────────────────────────────────────────── */}
                {selectedPlan && visibleAddons.length > 0 && (
                  <Section title="Add-ons" icon="🧩">
                    {visibleAddons.map(addon => (
                      <AddonRow
                        key={addon.id}
                        addon={addon}
                        currency={currency}
                        billingPeriod={billingPeriod}
                        state={addonStates[addon.id] ?? { selected: addon.addonBehavior === "required", quantity: addon.addonMinUnits ?? 1 }}
                        onChange={s => setAddonStates(prev => ({ ...prev, [addon.id]: s }))}
                      />
                    ))}
                  </Section>
                )}

                {/* ─ 7. Start Date ──────────────────────────────────────── */}
                <Section title="Start Date" icon="📆" dim={!selectedPlan}>
                  <div style={LABEL}>Subscription start date</div>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    style={{ ...INP, width: 200 }}
                  />
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>Leave blank — period is set when billing is approved.</div>
                </Section>

                {/* ─ 8. Price Override ──────────────────────────────────── */}
                <Section title="Price Override" icon="💰" dim={!selectedPlan}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
                    <input
                      type="checkbox"
                      checked={overridePrice}
                      onChange={e => setOverridePrice(e.target.checked)}
                      style={{ width: 15, height: 15, accentColor: C.primary }}
                    />
                    <span style={{ fontSize: 13, color: C.text }}>Override calculated total with a manual price</span>
                  </label>
                  {overridePrice && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{currency}</span>
                      <input
                        type="number"
                        value={manualTotal}
                        onChange={e => setManualTotal(e.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        style={{ ...INP, width: 160 }}
                      />
                    </div>
                  )}
                </Section>

                {/* Details + Note */}
                <Section title="Notes & Details" icon="📝" dim={!selectedPlan}>
                  <div style={{ marginBottom: 10 }}>
                    <div style={LABEL}>Customer-visible details</div>
                    <textarea
                      value={productDetails}
                      onChange={e => setProductDetails(e.target.value)}
                      rows={2}
                      placeholder="e.g. domain, username…"
                      style={{ ...INP, resize: "vertical" }}
                    />
                  </div>
                  <div>
                    <div style={LABEL}>Note</div>
                    <textarea
                      value={productNote}
                      onChange={e => setProductNote(e.target.value)}
                      rows={2}
                      placeholder="Extra instructions…"
                      style={{ ...INP, resize: "vertical" }}
                    />
                  </div>
                </Section>

                {msg && (
                  <div style={{ fontSize: 12, color: "#dc2626", padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", marginTop: 8 }}>
                    ⚠ {msg}
                  </div>
                )}
              </>
            )}
          </div>

          {/* ─ Right — running total ──────────────────────────────────────── */}
          <div style={{ padding: 20, background: "#f9fafb", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              Order Summary
            </div>

            {!selectedPlan ? (
              <div style={{ fontSize: 12, color: C.faint, textAlign: "center", padding: "20px 0" }}>
                Select a plan to see pricing
              </div>
            ) : (
              <>
                {/* Plan line */}
                <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.borderL}` }}>
                  <div style={{ fontSize: 11, color: C.faint, marginBottom: 4 }}>
                    {selectedPlan.category?.name ?? "Plan"}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{selectedPlan.name}</div>
                  {isPlanMetered && (
                    <div style={{ fontSize: 11, color: C.muted }}>× {planQty} {selectedPlan.unitLabel ?? "units"}</div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: C.muted }}>
                      {billingPeriod ? PERIOD_LABELS[billingPeriod] : "—"}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.primary }}>
                      {planPrice ? fmt(planPrice.priceCents * (isPlanMetered ? planQty : 1), currency) : "—"}
                    </span>
                  </div>
                </div>

                {/* Addon lines */}
                {visibleAddons
                  .filter(a => a.addonBehavior === "required" || addonStates[a.id]?.selected)
                  .map(a => {
                    const state = addonStates[a.id];
                    const price = a.prices.find(p => p.billingPeriod === billingPeriod) ?? a.prices[0];
                    const qty = a.addonPricingType === "per_unit" ? (state?.quantity ?? 1) : 1;
                    const isPercent = a.addonPricingType === "percentage";
                    const percentAmount = isPercent
                      ? Math.round((planPrice?.priceCents ?? 0) * ((a.addonPercentage ?? 0) / 100))
                      : 0;
                    return (
                      <div key={a.id} style={{ padding: "6px 0", borderBottom: `1px solid ${C.borderL}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 12, color: C.text }}>{a.name}</span>
                            {a.addonPricingType === "per_unit" && (
                              <span style={{ fontSize: 10, color: C.faint }}> × {qty} {a.addonUnitLabel}</span>
                            )}
                            {isPercent && (
                              <span style={{ fontSize: 10, color: C.faint }}> ({a.addonPercentage ?? "?"}% of plan)</span>
                            )}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.primary, flexShrink: 0 }}>
                            {isPercent
                              ? fmt(percentAmount, currency)
                              : price ? fmt(price.priceCents * qty, currency) : "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                {/* Total */}
                <div style={{ marginTop: 8, padding: "12px 0", borderTop: `2px solid ${C.border}` }}>
                  {overridePrice && manualTotal ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.faint, marginBottom: 4 }}>
                        <span>Calculated</span>
                        <span style={{ textDecoration: "line-through" }}>{fmt(computedTotal, currency)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>OVERRIDE TOTAL</span>
                        <span style={{ fontSize: 16, fontWeight: 800, color: "#7c3aed" }}>
                          {currency} {parseFloat(manualTotal || "0").toFixed(2)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>TOTAL</span>
                      <span style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>
                        {fmt(computedTotal, currency)}
                      </span>
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: C.faint, marginTop: 4 }}>
                    {billingPeriod ? `Per ${(PERIOD_LABELS[billingPeriod] ?? billingPeriod).toLowerCase()}` : ""}
                  </div>
                </div>
              </>
            )}

            {/* CTA */}
            <div style={{ marginTop: "auto" }}>
              <button
                disabled={busy || !selectedPlan || !billingPeriod || loadingProducts}
                onClick={() => void handleCreate()}
                style={{
                  width: "100%", padding: "11px 0", fontSize: 14, fontWeight: 700,
                  cursor: busy || !selectedPlan || !billingPeriod ? "not-allowed" : "pointer",
                  background: busy || !selectedPlan || !billingPeriod ? "#d1d5db" : C.primary,
                  color: busy || !selectedPlan || !billingPeriod ? C.muted : "#fff",
                  border: "none", fontFamily: "inherit",
                  transition: "background 0.15s",
                }}
              >
                {busy ? "Creating…" : "Create Subscription"}
              </button>
              <button
                onClick={onClose}
                style={{
                  width: "100%", marginTop: 8, padding: "9px 0", fontSize: 13,
                  cursor: "pointer", background: "transparent",
                  color: C.muted, border: `1px solid ${C.border}`, fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}