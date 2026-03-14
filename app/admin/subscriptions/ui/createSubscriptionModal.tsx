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
import { Icon } from "@/components/ui/Icon";

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
  addonPricingType: string | null;
  addonBehavior: string | null;
  addonUnitLabel: string | null;
  addonMinUnits: number | null;
  addonMaxUnits: number | null;
  addonPercentage: number | null;
  applicableTags: string[];
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

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary:    "#318774",
  primaryBg:  "#eaf4f2",
  primaryMid: "#a7d9d1",
  border:     "#e2e8f0",
  borderL:    "#f1f5f9",
  text:       "#0f172a",
  muted:      "#64748b",
  faint:      "#94a3b8",
  header:     "#1a1a2e",
  sidebarBg:  "#f8fafc",
  inputBg:    "#ffffff",
  inputFocus: "#318774",
};

const INP: React.CSSProperties = {
  padding: "8px 11px", fontSize: 13, fontFamily: "inherit",
  background: "#ffffff", border: "1px solid #e2e8f0",
  color: "#0f172a", outline: "none", width: "100%", boxSizing: "border-box" as const,
  transition: "border-color 0.15s",
};

const LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase" as const, color: "#94a3b8", marginBottom: 6,
  display: "block",
};

function Section({ title, icon, children, dim }: { title?: string; icon?: string; children: React.ReactNode; dim?: boolean }) {
  return (
    <div style={{ marginBottom: 22, opacity: dim ? 0.35 : 1, pointerEvents: dim ? "none" : undefined, transition: "opacity 0.2s" }}>
      {title && (
        <div style={{
          display: "flex", alignItems: "center", gap: 7, marginBottom: 12,
          paddingBottom: 8, borderBottom: "1px solid #f1f5f9",
        }}>
          {icon && (
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 26, height: 26, background: "#eaf4f2", flexShrink: 0,
            }}>
              <Icon name={icon} size={13} color="#318774" />
            </span>
          )}
          <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>{title}</span>
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Searchable dropdown ──────────────────────────────────────────────────────
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
          background: disabled ? "#f8fafc" : "#ffffff",
          color: selectedLabel ? "#0f172a" : "#94a3b8",
          borderColor: open ? "#318774" : "#e2e8f0",
          boxShadow: open ? "0 0 0 3px rgba(49,135,116,0.1)" : "none",
        }}
        onClick={() => { if (!disabled) { setOpen(o => !o); setQuery(""); } }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {selectedLabel || placeholder}
        </span>
        <Icon name="chevronDown" size={12} color={open ? "#318774" : "#94a3b8"} />
      </div>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, zIndex: 100,
          background: "#fff", border: "1px solid #318774", boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
          maxHeight: 260, overflow: "hidden", display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: 8, borderBottom: `1px solid ${C.borderL}` }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search…"
              style={{ ...INP, padding: "6px 9px", fontSize: 12, background: "#f8fafc", border: "1px solid #e2e8f0" }}
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
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#f8fafc"; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = "#ffffff"; }}
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
type AddonState = { selected: boolean; quantity: number };

function AddonRow({ addon, currency, billingPeriod, state, onChange }: {
  addon: RichProduct; currency: string; billingPeriod: string;
  state: AddonState; onChange: (s: AddonState) => void;
}) {
  const isPerUnit  = addon.addonPricingType === "per_unit";
  const isPercent  = addon.addonPricingType === "percentage";
  const isRequired = addon.addonBehavior === "required";
  const price = addon.prices.find(p => p.billingPeriod === billingPeriod) ?? addon.prices[0];

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: "10px 14px",
      background: state.selected ? "#eaf4f2" : "#fafafa",
      border: `1px solid ${state.selected ? "#a7d9d1" : "#e2e8f0"}`,
      marginBottom: 6, transition: "all 0.15s",
    }}>
      <div style={{ paddingTop: 2 }}>
        <input type="checkbox" checked={state.selected || isRequired} disabled={isRequired}
          onChange={e => onChange({ ...state, selected: e.target.checked })}
          style={{ width: 15, height: 15, cursor: isRequired ? "default" : "pointer", accentColor: C.primary }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{addon.name}</span>
          {isRequired && <span style={{ fontSize: 10, padding: "1px 6px", background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d", fontWeight: 700 }}>REQUIRED</span>}
          {isPerUnit  && <span style={{ fontSize: 10, padding: "1px 6px", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", fontWeight: 700 }}>PER {(addon.addonUnitLabel ?? "UNIT").toUpperCase()}</span>}
          {isPercent  && <span style={{ fontSize: 10, padding: "1px 6px", background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a", fontWeight: 700 }}>{addon.addonPercentage ?? "?"}% OF PLAN</span>}
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 10, color: C.faint, marginTop: 1 }}>{addon.key}</div>
      </div>
      {isPerUnit && state.selected && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: C.faint }}>{addon.addonUnitLabel ?? "Units"}</div>
          <input type="number" value={state.quantity} min={addon.addonMinUnits ?? 1} max={addon.addonMaxUnits ?? 9999}
            onChange={e => onChange({ ...state, quantity: Math.max(addon.addonMinUnits ?? 1, Number(e.target.value)) })}
            style={{ ...INP, width: 70, textAlign: "right", padding: "4px 8px" }} />
        </div>
      )}
      {isPercent ? (
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#b45309" }}>{addon.addonPercentage ?? "?"}%</div>
          <div style={{ fontSize: 10, color: C.faint }}>of plan total</div>
        </div>
      ) : price ? (
        <div style={{ flexShrink: 0, textAlign: "right" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>{fmt(price.priceCents * (isPerUnit ? state.quantity : 1), price.currency)}</div>
          <div style={{ fontSize: 10, color: C.faint }}>{PERIOD_LABELS[price.billingPeriod] ?? price.billingPeriod}</div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
export function CreateSubscriptionModal({ open, onClose, onCreated }: {
  open: boolean; onClose: () => void; onCreated: () => void;
}) {
  const [loadingForm, setLoadingForm]       = useState(false);
  const [customers, setCustomers]           = useState<CustomerOption[]>([]);
  const [custId, setCustId]                 = useState("");

  const [loadingProducts, setLoadingProducts] = useState(false);
  const [eligible, setEligible]             = useState<RichEligibleResp | null>(null);

  const [locations, setLocations]           = useState<LocationRow[]>([]);
  const [templates, setTemplates]           = useState<OsTemplateRow[]>([]);

  // ── NEW: location filter for product list ────────────────────────────────
  const [filterLocId, setFilterLocId]       = useState("");

  // Selections
  const [planId, setPlanId]                 = useState("");
  const [billingPeriod, setBillingPeriod]   = useState("");
  const [planQty, setPlanQty]               = useState(1);
  const [locationCode, setLocationCode]     = useState("");
  const [templateSlug, setTemplateSlug]     = useState("");
  const [addonStates, setAddonStates]       = useState<Record<string, AddonState>>({});
  const [startDate, setStartDate]           = useState("");
  const [overridePrice, setOverridePrice]   = useState(false);
  const [manualTotal, setManualTotal]       = useState("");
  const [productDetails, setProductDetails] = useState("");
  const [productNote, setProductNote]       = useState("");

  const [busy, setBusy] = useState(false);
  const [msg,  setMsg]  = useState<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
  const selectedCustomer = useMemo(() => customers.find(c => c.id === custId) ?? null, [customers, custId]);

  // Plans + services only (no addons/products), then filtered by location
  const plansAndServices = useMemo(() => {
    const base = [
      ...(eligible?.plans    ?? []),
      ...(eligible?.services ?? []).filter(p => p.type === "service"),
    ];
    if (!filterLocId) return base;
    const loc = locations.find(l => l.id === filterLocId);
    if (!loc || (loc.includeTags.length === 0 && loc.excludeTags.length === 0)) return base;
    return base.filter(p => {
      const tagKeys = p.tags.map(t => t.key);
      const hasInclude = loc.includeTags.length === 0 || loc.includeTags.some(t => tagKeys.includes(t));
      const hasExclude = loc.excludeTags.some(t => tagKeys.includes(t));
      return hasInclude && !hasExclude;
    });
  }, [eligible, filterLocId, locations]);

  const selectedPlan     = useMemo(() => plansAndServices.find(p => p.id === planId) ?? null, [plansAndServices, planId]);
  const planTagKeys      = useMemo(() => selectedPlan?.tags.map(t => t.key) ?? [], [selectedPlan]);
  const planPrice        = useMemo(() => {
    if (!selectedPlan || !billingPeriod) return null;
    return selectedPlan.prices.find(p => p.billingPeriod === billingPeriod) ?? null;
  }, [selectedPlan, billingPeriod]);
  const currency         = eligible?.currency ?? "SAR";
  const isPlanMetered    = useMemo(() => selectedPlan?.tags.some(t => t.key === "metered") ?? false, [selectedPlan]);

  const visibleAddons = useMemo(() => {
    if (!eligible || !selectedPlan) return [];
    return eligible.addons
      .filter(addon => addon.applicableTags.length === 0 || addon.applicableTags.some(t => planTagKeys.includes(t)))
      .sort((a, b) => {
        const aR = a.addonBehavior === "required" ? 0 : 1;
        const bR = b.addonBehavior === "required" ? 0 : 1;
        if (aR !== bR) return aR - bR;
        return a.name.localeCompare(b.name);
      });
  }, [eligible, selectedPlan, planTagKeys]);

  const filteredLocations = useMemo(() => locations.filter(l => locationMatchesProduct(l, planTagKeys)), [locations, planTagKeys]);
  const filteredTemplates = useMemo(() => templates.filter(t => templateMatchesProduct(t, planTagKeys)), [templates, planTagKeys]);
  const showLocationTemplate = filteredLocations.length > 0 || filteredTemplates.length > 0;

  // Location groups for the filter dropdown
  const locationGroups = useMemo(() => {
    const families = [...new Set(locations.map(l => l.family).filter(Boolean))] as string[];
    return families.map(f => ({ family: f, locs: locations.filter(l => l.family === f) }));
  }, [locations]);
  const standaloneLocations = useMemo(() => locations.filter(l => !l.family), [locations]);

  const computedTotal = useMemo(() => {
    if (!planPrice) return 0;
    let total = planPrice.priceCents * (isPlanMetered ? planQty : 1);
    for (const addon of visibleAddons) {
      const state = addonStates[addon.id];
      if (!state?.selected && addon.addonBehavior !== "required") continue;
      if (addon.addonPricingType === "percentage") {
        total += Math.round(total * ((addon.addonPercentage ?? 0) / 100));
      } else {
        const ap = addon.prices.find(p => p.billingPeriod === billingPeriod) ?? addon.prices[0];
        if (ap) {
          const qty = addon.addonPricingType === "per_unit" ? (state?.quantity ?? addon.addonMinUnits ?? 1) : 1;
          total += ap.priceCents * qty;
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
    setFilterLocId(""); setLocationCode(""); setTemplateSlug("");
    setAddonStates({}); setStartDate(""); setOverridePrice(false);
    setManualTotal(""); setProductDetails(""); setProductNote("");
    setEligible(null); setMsg(null);

    void (async () => {
      try {
        const [custResp, locResp, tmplResp] = await Promise.all([
          fetch("/api/admin/subscriptions/create-form", { cache: "no-store" }).then(r => r.json()).catch(() => null),
          fetch("/api/admin/catalog/locations",          { cache: "no-store" }).then(r => r.json()).catch(() => null),
          fetch("/api/admin/catalog/templates",          { cache: "no-store" }).then(r => r.json()).catch(() => null),
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

  // Reset product when location filter changes
  useEffect(() => { setPlanId(""); }, [filterLocId]);

  // ── Auto-select first billing period when plan changes ─────────────────────
  useEffect(() => {
    if (selectedPlan) {
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

  useEffect(() => {
    if (filteredLocations.length > 0) {
      const def = filteredLocations.find(l => l.isDefault) ?? filteredLocations[0];
      setLocationCode(def.code);
    } else { setLocationCode(""); }
  }, [filteredLocations]);

  useEffect(() => {
    if (filteredTemplates.length > 0) {
      const def = filteredTemplates.find(t => t.isDefault) ?? filteredTemplates[0];
      setTemplateSlug(def.slug);
    } else { setTemplateSlug(""); }
  }, [filteredTemplates]);

  useEffect(() => {
    setAddonStates(prev => {
      const next: Record<string, AddonState> = {};
      for (const a of visibleAddons) {
        next[a.id] = prev[a.id] ?? { selected: a.addonBehavior === "required", quantity: a.addonMinUnits ?? 1 };
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
        .map(a => ({ productId: a.id, quantity: addonStates[a.id]?.quantity ?? 1 }));

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
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => null) as unknown;
      if (!r.ok || !isRecord(j) || !readBoolean(j, "ok")) {
        setMsg(isRecord(j) ? (readString(j, "error") ?? "Create failed") : "Create failed"); return;
      }
      onCreated(); onClose();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  if (!open) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, background: "rgba(15,23,42,0.6)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      overflowY: "auto", padding: "20px 16px",
    }}>
      <div style={{ width: "100%", maxWidth: 820, background: "#fff", boxShadow: "0 24px 64px rgba(0,0,0,0.2)", marginBottom: 20, borderTop: "3px solid #318774" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "15px 22px", background: "#1a1a2e", borderBottom: "1px solid #2d2d44",
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.01em" }}>Add Subscription</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>Create a new subscription for a customer</div>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "1px solid #3d3d5c", color: "#94a3b8",
            cursor: "pointer", padding: "5px 12px", fontSize: 12, fontFamily: "inherit",
            display: "flex", alignItems: "center", gap: 5, transition: "border-color 0.15s",
          }}>
            <Icon name="x" size={12} color="#9ca3af" /> Close
          </button>
        </div>

        {/* Body */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 260px", minHeight: 500 }}>

          {/* Left — form */}
          <div style={{ padding: "24px 26px", borderRight: "1px solid #f1f5f9", overflowY: "auto", maxHeight: "80vh" }}>

            {loadingForm && (
              <div style={{ textAlign: "center", padding: 48, color: "#94a3b8", fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}><Icon name="loader" size={20} color="#a7d9d1" />Loading form…</div>
            )}

            {!loadingForm && (<>

              {/* ── 1. Customer ──────────────────────────────────────────── */}
              <Section title="Select Customer" icon="user">
                <SearchableSelect
                  options={customers} value={custId} onChange={setCustId}
                  placeholder="Search by email…"
                  keyExtractor={o => (o as CustomerOption).id}
                  labelExtractor={o => (o as CustomerOption).email}
                  renderItem={o => <div style={{ fontSize: 13, fontWeight: 500 }}>{(o as CustomerOption).email}</div>}
                />
                {selectedCustomer && eligible && (
                  <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 10, padding: "3px 9px", background: "#eaf4f2", color: "#318774", border: "1px solid #a7d9d1", fontWeight: 600 }}>Market: {eligible.market.name}</span>
                    <span style={{ fontSize: 10, padding: "3px 9px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", fontWeight: 600 }}>{eligible.customerGroup}</span>
                    <span style={{ fontSize: 10, padding: "3px 9px", background: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0", fontWeight: 600 }}>{eligible.currency}</span>
                  </div>
                )}
                {custId && loadingProducts && (
                  <div style={{ fontSize: 11, color: C.faint, marginTop: 6 }}>Loading products…</div>
                )}
              </Section>

              {/* ── 2. Filter by Location (NEW) ─────────────────────────── */}
              {custId && (
                <Section title="Filter by Location" icon="pin">
                  <select
                    value={filterLocId}
                    onChange={e => setFilterLocId(e.target.value)}
                    style={{ ...INP }}
                  >
                    <option value="">🌐 All Locations</option>
                    {locationGroups.map(g => (
                      <optgroup key={g.family} label={g.family}>
                        {g.locs.map(l => (
                          <option key={l.id} value={l.id}>
                            {l.flag ? `${l.flag} ` : ""}{l.name} ({l.code})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    {standaloneLocations.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.flag ? `${l.flag} ` : ""}{l.name} ({l.code})
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 5 }}>
                    Filters plans &amp; services to those available at this location
                  </div>
                </Section>
              )}

              {/* ── 3. Plan or Service ───────────────────────────────────── */}
              <Section title="Plan or Service" icon="box" dim={!custId || loadingProducts}>
                {eligible && plansAndServices.length === 0 ? (
                  <div style={{ fontSize: 12, color: "#dc2626", padding: "10px 12px", background: "#fef2f2", border: "1px solid #fca5a5" }}>
                    {filterLocId
                      ? "No plans or services available at this location — try \"All Locations\"."
                      : "No priced products available for this customer's market and group."}
                  </div>
                ) : eligible && (
                  <>
                    <SearchableSelect
                      options={plansAndServices}
                      value={planId}
                      onChange={setPlanId}
                      placeholder={loadingProducts ? "Loading products…" : "Search by name, ID or tag…"}
                      disabled={!eligible || loadingProducts}
                      keyExtractor={o => (o as RichProduct).id}
                      labelExtractor={o => { const p = o as RichProduct; return `${p.name} · ${p.key}`; }}
                      renderItem={o => {
                        const p = o as RichProduct;
                        const isMetered = p.tags.some(t => t.key === "metered");
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{
                              fontSize: 9, fontWeight: 700, padding: "1px 6px", flexShrink: 0,
                              background: p.type === "plan" ? "#eff6ff" : "#fffbeb",
                              color:      p.type === "plan" ? "#1d4ed8" : "#b45309",
                              border:     `1px solid ${p.type === "plan" ? "#bfdbfe" : "#fde68a"}`,
                            }}>{p.type.toUpperCase()}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{p.name}</div>
                              <div style={{ fontFamily: "monospace", fontSize: 10, color: C.faint }}>{p.key}</div>
                            </div>
                            <div style={{ display: "flex", gap: 4, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 140 }}>
                              {isMetered && <span style={{ fontSize: 9, padding: "1px 5px", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a" }}>METERED</span>}
                              {p.tags.filter(t => t.key !== "metered").slice(0, 3).map(t => (
                                <span key={t.key} style={{ fontSize: 9, padding: "1px 5px", background: "#f3f4f6", color: C.muted, border: `1px solid ${C.border}` }}>{t.name}</span>
                              ))}
                            </div>
                          </div>
                        );
                      }}
                    />

                    {selectedPlan && (
                      <div style={{ marginTop: 8, padding: "9px 13px", background: "#eaf4f2", border: "1px solid #a7d9d1", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.primary }}>{selectedPlan.name}</span>
                        <span style={{ fontFamily: "monospace", fontSize: 10, color: C.faint }}>{selectedPlan.key}</span>
                        {selectedPlan.tags.map(t => (
                          <span key={t.key} style={{ fontSize: 9, padding: "1px 6px", background: "#fff", color: C.muted, border: `1px solid ${C.border}` }}>{t.name}</span>
                        ))}
                        {selectedPlan.prices[0]?.isOverride && (
                          <span style={{ fontSize: 9, padding: "1px 6px", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", marginLeft: "auto" }}>★ Enterprise price</span>
                        )}
                      </div>
                    )}

                    {selectedPlan && isPlanMetered && (
                      <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#fffbeb", border: "1px solid #fde68a" }}>
                        <span style={{ fontSize: 11, color: "#92400e", fontWeight: 600 }}>Quantity</span>
                        <span style={{ fontSize: 11, color: "#b45309" }}>per {selectedPlan.unitLabel ?? "unit"}</span>
                        <input type="number" value={planQty} min={1} onChange={e => setPlanQty(Math.max(1, Number(e.target.value)))}
                          style={{ ...INP, width: 80, padding: "4px 8px", marginLeft: "auto" }} />
                      </div>
                    )}

                    {selectedPlan && selectedPlan.prices.length > 0 && (
                      <div style={{ marginTop: 14 }}>
                        <div style={{ ...LABEL, marginBottom: 8 }}>Billing Period</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                          {[...selectedPlan.prices]
                            .sort((a, b) => ["MONTHLY","SIX_MONTHS","YEARLY","ONE_TIME"].indexOf(a.billingPeriod) - ["MONTHLY","SIX_MONTHS","YEARLY","ONE_TIME"].indexOf(b.billingPeriod))
                            .map(price => {
                              const isActive = billingPeriod === price.billingPeriod;
                              return (
                                <button key={price.billingPeriod} type="button" onClick={() => setBillingPeriod(price.billingPeriod)}
                                  style={{
                                    padding: "10px 18px", fontFamily: "inherit", cursor: "pointer",
                                    background: isActive ? "#318774" : "#ffffff",
                                    color: isActive ? "#ffffff" : "#0f172a",
                                    border: `2px solid ${isActive ? "#318774" : "#e2e8f0"}`,
                                    transition: "all 0.15s",
                                    display: "flex", flexDirection: "column", alignItems: "center", gap: 3, minWidth: 90,
                                    boxShadow: isActive ? "0 2px 8px rgba(49,135,116,0.25)" : "none",
                                  }}
                                >
                                  <span style={{ fontSize: 13, fontWeight: 700 }}>{PERIOD_LABELS[price.billingPeriod] ?? price.billingPeriod}</span>
                                  <span style={{ fontSize: 11, fontWeight: 500, opacity: isActive ? 0.92 : 0.7 }}>
                                    {fmt(price.priceCents, price.currency)}{price.isOverride && <span style={{ marginLeft: 3, fontSize: 9 }}>★</span>}
                                  </span>
                                </button>
                              );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Section>

              {/* ── 4. Location & Template ───────────────────────────────── */}
              {selectedPlan && showLocationTemplate && (
                <Section title="Location & Template" icon="pin">
                  <div style={{ display: "grid", gridTemplateColumns: filteredLocations.length > 0 && filteredTemplates.length > 0 ? "1fr 1fr" : "1fr", gap: 12 }}>
                    {filteredLocations.length > 0 && (
                      <div>
                        <div style={LABEL}>Location</div>
                        <SearchableSelect
                          options={filteredLocations} value={locationCode} onChange={setLocationCode}
                          placeholder="Select location…"
                          keyExtractor={o => (o as LocationRow).code}
                          labelExtractor={o => { const l = o as LocationRow; return `${l.flag ? l.flag + " " : ""}${l.name}`; }}
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
                          options={filteredTemplates} value={templateSlug} onChange={setTemplateSlug}
                          placeholder="Select template…"
                          keyExtractor={o => (o as OsTemplateRow).slug}
                          labelExtractor={o => (o as OsTemplateRow).name}
                          renderItem={o => {
                            const t = o as OsTemplateRow;
                            return (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {t.iconType === "devicon" && t.iconValue && <i className={t.iconValue} style={{ fontSize: 18, color: C.muted }} />}
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

              {/* ── 5. Addons ────────────────────────────────────────────── */}
              {selectedPlan && visibleAddons.length > 0 && (
                <Section title="Add-ons" icon="puzzle">
                  {visibleAddons.map(addon => (
                    <AddonRow key={addon.id} addon={addon} currency={currency} billingPeriod={billingPeriod}
                      state={addonStates[addon.id] ?? { selected: addon.addonBehavior === "required", quantity: addon.addonMinUnits ?? 1 }}
                      onChange={s => setAddonStates(prev => ({ ...prev, [addon.id]: s }))}
                    />
                  ))}
                </Section>
              )}

              {/* ── 6. Start Date ────────────────────────────────────────── */}
              <Section title="Start Date" icon="calendar" dim={!selectedPlan}>
                <div style={LABEL}>Subscription start date</div>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ ...INP, width: 200 }} />
                <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>Leave blank — period is set when billing is approved.</div>
              </Section>

              {/* ── 7. Price Override ────────────────────────────────────── */}
              <Section title="Price Override" icon="money" dim={!selectedPlan}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 10 }}>
                  <input type="checkbox" checked={overridePrice} onChange={e => setOverridePrice(e.target.checked)}
                    style={{ width: 15, height: 15, accentColor: C.primary }} />
                  <span style={{ fontSize: 13, color: C.text }}>Override calculated total with a manual price</span>
                </label>
                {overridePrice && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{currency}</span>
                    <input type="number" value={manualTotal} onChange={e => setManualTotal(e.target.value)}
                      placeholder="0.00" step="0.01" style={{ ...INP, width: 160 }} />
                  </div>
                )}
              </Section>

              {/* ── 8. Notes & Details ───────────────────────────────────── */}
              <Section title="Notes & Details" icon="note" dim={!selectedPlan}>
                <div style={{ marginBottom: 10 }}>
                  <div style={LABEL}>Customer-visible details</div>
                  <textarea value={productDetails} onChange={e => setProductDetails(e.target.value)} rows={2}
                    placeholder="e.g. domain, username…" style={{ ...INP, resize: "vertical" }} />
                </div>
                <div>
                  <div style={LABEL}>Note</div>
                  <textarea value={productNote} onChange={e => setProductNote(e.target.value)} rows={2}
                    placeholder="Extra instructions…" style={{ ...INP, resize: "vertical" }} />
                </div>
              </Section>

              {msg && (
                <div style={{ fontSize: 12, color: "#dc2626", padding: "9px 13px", background: "#fef2f2", border: "1px solid #fca5a5", marginTop: 8, display: "flex", alignItems: "center", gap: 7 }}>
                  <Icon name="alertCircle" size={14} color="#dc2626" />
                  {msg}
                </div>
              )}
            </>)}
          </div>

          {/* ── Right — order summary ──────────────────────────────────────── */}
          <div style={{ padding: "22px 20px", background: "#f8fafc", display: "flex", flexDirection: "column", gap: 14, borderLeft: "1px solid #f1f5f9" }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: "#94a3b8",
              textTransform: "uppercase", letterSpacing: "0.1em",
              paddingBottom: 10, borderBottom: "1px solid #e2e8f0",
            }}>Order Summary</div>

            {!selectedPlan ? (
              <div style={{ fontSize: 12, color: C.faint, textAlign: "center", padding: "20px 0" }}>Select a plan to see pricing</div>
            ) : (<>
              <div style={{ padding: "10px 0", borderBottom: `1px solid ${C.borderL}` }}>
                <div style={{ fontSize: 11, color: C.faint, marginBottom: 4 }}>{selectedPlan.category?.name ?? "Plan"}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{selectedPlan.name}</div>
                {isPlanMetered && <div style={{ fontSize: 11, color: C.muted }}>× {planQty} {selectedPlan.unitLabel ?? "units"}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{billingPeriod ? PERIOD_LABELS[billingPeriod] : "—"}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.primary }}>
                    {planPrice ? fmt(planPrice.priceCents * (isPlanMetered ? planQty : 1), currency) : "—"}
                  </span>
                </div>
              </div>

              {visibleAddons.filter(a => a.addonBehavior === "required" || addonStates[a.id]?.selected).map(a => {
                const state = addonStates[a.id];
                const price = a.prices.find(p => p.billingPeriod === billingPeriod) ?? a.prices[0];
                const qty = a.addonPricingType === "per_unit" ? (state?.quantity ?? 1) : 1;
                const isPercent = a.addonPricingType === "percentage";
                const percentAmt = isPercent ? Math.round((planPrice?.priceCents ?? 0) * ((a.addonPercentage ?? 0) / 100)) : 0;
                return (
                  <div key={a.id} style={{ padding: "6px 0", borderBottom: `1px solid ${C.borderL}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 12, color: C.text }}>{a.name}</span>
                        {a.addonPricingType === "per_unit" && <span style={{ fontSize: 10, color: C.faint }}> × {qty} {a.addonUnitLabel}</span>}
                        {isPercent && <span style={{ fontSize: 10, color: C.faint }}> ({a.addonPercentage ?? "?"}% of plan)</span>}
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: C.primary, flexShrink: 0 }}>
                        {isPercent ? fmt(percentAmt, currency) : price ? fmt(price.priceCents * qty, currency) : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div style={{ marginTop: 8, padding: "12px 0", borderTop: `2px solid ${C.border}` }}>
                {overridePrice && manualTotal ? (<>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.faint, marginBottom: 4 }}>
                    <span>Calculated</span>
                    <span style={{ textDecoration: "line-through" }}>{fmt(computedTotal, currency)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>OVERRIDE TOTAL</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#7c3aed" }}>{currency} {parseFloat(manualTotal || "0").toFixed(2)}</span>
                  </div>
                </>) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>TOTAL</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: C.primary }}>{fmt(computedTotal, currency)}</span>
                  </div>
                )}
                <div style={{ fontSize: 10, color: C.faint, marginTop: 4 }}>
                  {billingPeriod ? `Per ${(PERIOD_LABELS[billingPeriod] ?? billingPeriod).toLowerCase()}` : ""}
                </div>
              </div>
            </>)}

            <div style={{ marginTop: "auto" }}>
              <button
                disabled={busy || !selectedPlan || !billingPeriod || loadingProducts}
                onClick={() => void handleCreate()}
                style={{
                  width: "100%", padding: "12px 0", fontSize: 13, fontWeight: 700, fontFamily: "inherit",
                  cursor: busy || !selectedPlan || !billingPeriod ? "not-allowed" : "pointer",
                  background: busy || !selectedPlan || !billingPeriod ? "#e2e8f0" : "#318774",
                  color: busy || !selectedPlan || !billingPeriod ? "#94a3b8" : "#ffffff",
                  border: "none", transition: "background 0.15s",
                  letterSpacing: "0.02em",
                  boxShadow: (!busy && selectedPlan && billingPeriod) ? "0 2px 8px rgba(49,135,116,0.3)" : "none",
                }}
              >{busy ? "Creating…" : "Create Subscription"}</button>
              <button onClick={onClose} style={{
                width: "100%", marginTop: 8, padding: "9px 0", fontSize: 13, fontFamily: "inherit",
                cursor: "pointer", background: "transparent", color: "#64748b", border: "1px solid #e2e8f0",
                transition: "border-color 0.15s",
              }}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}