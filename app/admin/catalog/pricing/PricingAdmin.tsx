// app/admin/catalog/pricing/PricingAdmin.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PageShell, Card, Table, TR, TD, TypeBadge, TagPill,
  Btn, FiltersBar, CLR,
} from "@/components/ui/admin-ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingPeriod = "MONTHLY" | "SIX_MONTHS" | "YEARLY" | "ONE_TIME";
type ProductType   = "plan" | "addon" | "service" | "product";
type AddonPricingType = "fixed" | "percentage" | "per_unit";

const ALL_PERIODS: BillingPeriod[] = ["MONTHLY", "SIX_MONTHS", "YEARLY", "ONE_TIME"];
const PERIOD_LABELS: Record<BillingPeriod, string> = {
  MONTHLY: "Monthly", SIX_MONTHS: "6 Months", YEARLY: "Yearly", ONE_TIME: "One-time",
};
const GROUP_ORDER = ["standard", "business", "professional", "enterprise"];

type Market        = { id: string; key: string; name: string; defaultCurrency: string };
type CustomerGroup = { id: string; key: string; name: string };
type PricingRow    = { id: string; productId: string; marketId: string; customerGroupId: string; billingPeriod: BillingPeriod; priceCents: number; isActive: boolean };
type Override      = { id: string; productId: string; marketId: string; userId: string; billingPeriod: BillingPeriod; priceCents: number; user: { id: string; fullName: string | null; email: string } };
type TagRow        = { id: string; key: string; name: string };
type Product       = {
  id: string; key: string; name: string; type: ProductType; billingPeriods: BillingPeriod[];
  isActive: boolean; category: { id: string; name: string } | null;
  tags: TagRow[]; unitLabel?: string | null;
  addonPricingType: AddonPricingType | null; addonBehavior: "optional" | "required" | null;
  applicableTags: string[]; addonUnitLabel: string | null;
  addonMinUnits: number | null; addonMaxUnits: number | null; addonPercentage: number | null;
};
type EnterpriseCustomer = { id: string; fullName: string | null; email: string; customerNumber: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const currSym   = (c: string) => { try { return (0).toLocaleString("en", { style: "currency", currency: c, minimumFractionDigits: 0 }).replace(/[\d,. ]/g, "").trim() || c; } catch { return c; } };
const toDisplay = (cents: number) => (cents / 100).toFixed(2);
const toCents   = (val: string): number | null => { const n = parseFloat(val.trim()); return isNaN(n) || n < 0 ? null : Math.round(n * 100); };
function sortGroups(groups: CustomerGroup[]): CustomerGroup[] {
  return [...groups].sort((a, b) => { const ai = GROUP_ORDER.indexOf(a.key); const bi = GROUP_ORDER.indexOf(b.key); return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi); });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PricingAdmin() {
  const [markets,    setMarkets]    = useState<Market[]>([]);
  const [groups,     setGroups]     = useState<CustomerGroup[]>([]);
  const [products,   setProducts]   = useState<Product[]>([]);
  const [pricing,    setPricing]    = useState<PricingRow[]>([]);
  const [overrides,  setOverrides]  = useState<Override[]>([]);
  const [allTags,    setAllTags]    = useState<TagRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [fSearch,   setFSearch]   = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fType,     setFType]     = useState("");
  const [fTag,      setFTag]      = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [metaRes, pricingRes, productsRes, overridesRes, tagsRes] = await Promise.all([
        fetch("/api/admin/catalog/pricing/meta",     { cache: "no-store" }),
        fetch("/api/admin/catalog/pricing",           { cache: "no-store" }),
        fetch("/api/admin/catalog/products",          { cache: "no-store" }),
        fetch("/api/admin/catalog/pricing/overrides", { cache: "no-store" }),
        fetch("/api/admin/catalog/tags",              { cache: "no-store" }),
      ]);
      const mJ  = await metaRes.json().catch(() => null);
      const prJ = await pricingRes.json().catch(() => null);
      const pJ  = await productsRes.json().catch(() => null);
      const oJ  = await overridesRes.json().catch(() => null);
      const tJ  = await tagsRes.json().catch(() => null);
      if (mJ?.ok)  { setMarkets(mJ.data.markets ?? []); setGroups(mJ.data.groups ?? []); }
      if (pJ?.ok)  setProducts((pJ.data ?? []).filter((p: Product) => p.isActive));
      if (prJ?.ok) setPricing(prJ.data ?? []);
      if (oJ?.ok)  setOverrides(oJ.data ?? []);
      if (tJ?.ok)  setAllTags(tJ.data ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function savePricing(productId: string, marketId: string,
    saves: { groupId: string; period: BillingPeriod; cents: number }[],
    deletes: { groupId: string; period: BillingPeriod; existingId: string }[]
  ) {
    const byGroup: Record<string, { period: BillingPeriod; cents: number }[]> = {};
    saves.forEach(({ groupId, period, cents }) => { if (!byGroup[groupId]) byGroup[groupId] = []; byGroup[groupId].push({ period, cents }); });
    for (const [groupId, entries] of Object.entries(byGroup)) {
      const res = await fetch("/api/admin/catalog/pricing/upsert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, marketId, customerGroupId: groupId, entries }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.ok) { alert(j?.error ?? "Save failed"); return; }
    }
    for (const { existingId } of deletes) {
      await fetch("/api/admin/catalog/pricing/delete", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: existingId }),
      });
    }
    await load();
  }

  async function saveOverride(productId: string, marketId: string, userId: string, billingPeriod: BillingPeriod, priceCents: number) {
    const res = await fetch("/api/admin/catalog/pricing/overrides/upsert", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, marketId, userId, billingPeriod, priceCents }),
    });
    const j = await res.json().catch(() => null);
    if (!res.ok || !j?.ok) { alert(j?.error ?? "Save failed"); return; }
    await load();
  }

  async function deleteOverride(id: string) {
    await fetch("/api/admin/catalog/pricing/overrides/delete", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    await load();
  }

  const categories = Array.from(new Set(products.map(p => p.category?.name).filter(Boolean))) as string[];

  const filtered = products.filter(p => {
    if (fType     && p.type !== fType) return false;
    if (fCategory && p.category?.name !== fCategory) return false;
    if (fTag      && !p.tags?.some(t => t.id === fTag)) return false;
    if (fSearch) {
      const q = fSearch.toLowerCase();
      if (!p.key.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const pricesSetLabel = (productId: string) => {
    const groupCount     = pricing.filter(r => r.productId === productId && r.isActive).length;
    const overrideCount  = overrides.filter(o => o.productId === productId).length;
    const total          = groupCount + overrideCount;
    return total > 0 ? `${total} price${total !== 1 ? "s" : ""}` : "0 active";
  };

  const clearFilters = () => { setFSearch(""); setFCategory(""); setFType(""); setFTag(""); };
  const hasFilters   = fSearch || fCategory || fType || fTag;

  return (
    <PageShell breadcrumb="ADMIN / CATALOG / PRICING" title="Pricing">
      <Card>
        <FiltersBar>
          <input className="cy-input" value={fSearch} onChange={e => setFSearch(e.target.value)}
            placeholder="Search key or name…" style={{ width: 220 }} />
          <select className="cy-input" value={fType} onChange={e => setFType(e.target.value)} style={{ width: 130 }}>
            <option value="">All Types</option>
            {(["plan","addon","service","product"] as ProductType[]).map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
            ))}
          </select>
          <select className="cy-input" value={fCategory} onChange={e => setFCategory(e.target.value)} style={{ width: 160 }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="cy-input" value={fTag} onChange={e => setFTag(e.target.value)} style={{ width: 140 }}>
            <option value="">All Tags</option>
            {allTags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {hasFilters && <Btn variant="ghost" onClick={clearFilters}>Clear</Btn>}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>
            {filtered.length} product{filtered.length !== 1 ? "s" : ""}
          </span>
        </FiltersBar>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading…</div>
        ) : (
          <Table cols={["Key", "Product", "Type", "Tags", "Prices Set", ""]}>
            {filtered.map(p => {
              const isOpen = expandedId === p.id;
              const count  = pricing.filter(r => r.productId === p.id && r.isActive).length + overrides.filter(o => o.productId === p.id).length;
              return (
                <tbody key={p.id}>
                  <TR onClick={() => setExpandedId(isOpen ? null : p.id)} highlight={isOpen}>
                    <TD mono muted>{p.key}</TD>
                    <TD>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      {p.category && <div style={{ fontSize: 11, color: "#9ca3af" }}>{p.category.name}</div>}

                    </TD>
                    <TD><TypeBadge value={p.type} /></TD>
                    <TD>
                      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                        {(p.tags ?? []).map(t => <TagPill key={t.id} label={t.name} />)}
                      </div>
                    </TD>
                    <TD>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: "2px 8px",
                        background: count > 0 ? CLR.primaryBg : "#f3f4f6",
                        color: count > 0 ? CLR.primary : "#9ca3af",
                        border: `1px solid ${count > 0 ? "#a7d9d1" : CLR.border}`,
                      }}>{pricesSetLabel(p.id)}</span>
                    </TD>
                    <TD right>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{isOpen ? "▲" : "▼"}</span>
                    </TD>
                  </TR>
                  {isOpen && (
                    <tr>
                      <td colSpan={6} style={{ background: "#f9fafb", borderBottom: `1px solid ${CLR.border}`, padding: 20 }}>
                        <ProductPricingPanel
                          product={p} markets={markets} groups={groups}
                          allPricing={pricing} allOverrides={overrides} allTags={allTags}
                          onSave={savePricing} onSaveOverride={saveOverride} onDeleteOverride={deleteOverride}
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </Table>
        )}
      </Card>
    </PageShell>
  );
}


// ─── Addon Settings Panel ─────────────────────────────────────────────────────

// Pricing type: all use brand teal when active
const PRICING_TYPE_CONFIG = {
  fixed:      { label: "Fixed Price",  icon: "◈", activeBg: CLR.primaryBg, activeBorder: "#a7d9d1", activeColor: CLR.primary, activeIconColor: CLR.primary },
  percentage: { label: "% of Parent",  icon: "%",  activeBg: CLR.primaryBg, activeBorder: "#a7d9d1", activeColor: CLR.primary, activeIconColor: CLR.primary },
  per_unit:   { label: "Per Unit",     icon: "≡",  activeBg: CLR.primaryBg, activeBorder: "#a7d9d1", activeColor: CLR.primary, activeIconColor: CLR.primary },
} as const;

function AddonSettingsPanel({
  allTags, pricingType, setPricingType, behavior, setBehavior,
  applicableTags, setApplicableTags, unitLabel, setUnitLabel,
  minUnits, setMinUnits, maxUnits, setMaxUnits, percentage, setPercentage,
}: {
  allTags: TagRow[];
  pricingType: AddonPricingType; setPricingType: (v: AddonPricingType) => void;
  behavior: "optional" | "required"; setBehavior: (v: "optional" | "required") => void;
  applicableTags: string[]; setApplicableTags: (v: string[]) => void;
  unitLabel: string; setUnitLabel: (v: string) => void;
  minUnits: string; setMinUnits: (v: string) => void;
  maxUnits: string; setMaxUnits: (v: string) => void;
  percentage: string; setPercentage: (v: string) => void;
}) {
  const selectedTags  = allTags.filter(t => applicableTags.includes(t.key));
  const availableTags = allTags.filter(t => !applicableTags.includes(t.key));
  const addTag    = (key: string) => { if (!applicableTags.includes(key)) setApplicableTags([...applicableTags, key]); };
  const removeTag = (key: string) => setApplicableTags(applicableTags.filter(k => k !== key));

  return (
    <div style={{ border: `1px solid ${CLR.border}`, background: "#fff", padding: 18, marginBottom: 4 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${CLR.border}` }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: CLR.header }}>Addon Settings</span>
        <span style={{ fontSize: 11, color: CLR.faint }}>Configure how this addon behaves and is priced</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>

        {/* LEFT — Behavior + Applicable tags */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Behavior */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: CLR.faint, letterSpacing: "0.08em", marginBottom: 8 }}>Behavior</div>
            <div style={{ display: "flex", gap: 0, border: `1px solid ${CLR.border}` }}>
              {(["optional", "required"] as const).map((b, i) => {
                const isActive = behavior === b;
                const isOpt    = b === "optional";
                return (
                  <button key={b} type="button" onClick={() => setBehavior(b)}
                    style={{
                      flex: 1, padding: "11px 0", fontSize: 13, fontFamily: "inherit", fontWeight: 600, cursor: "pointer",
                      borderLeft: i > 0 ? `1px solid ${CLR.border}` : "none",
                      background: isActive ? CLR.header : "#fff",
                      color: isActive ? "#fff" : CLR.muted,
                      border: "none",
                      borderRight: i === 0 ? `1px solid ${CLR.border}` : "none",
                    }}>
                    {isOpt ? "✦ Optional" : "● Required"}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: CLR.faint, marginTop: 6, paddingLeft: 2 }}>
              {behavior === "required" ? "Auto-added with parent plan. Customer cannot remove." : "Customer can choose to add during subscription creation."}
            </div>
          </div>

          {/* Applicable tags */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: CLR.faint, letterSpacing: "0.08em", marginBottom: 8 }}>Appears for Plans Tagged</div>
            <div style={{ minHeight: 38, display: "flex", flexWrap: "wrap" as const, alignItems: "center", gap: 6, padding: "6px 10px", border: `1px solid ${CLR.border}`, background: "#f9fafb" }}>
              {selectedTags.length === 0
                ? <span style={{ fontSize: 11, color: "#d1d5db" }}>No tags — appears for all plans</span>
                : selectedTags.map(t => (
                    <span key={t.key} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, padding: "2px 8px", background: CLR.primaryBg, border: `1px solid #a7d9d1`, color: CLR.primary, fontWeight: 600 }}>
                      {t.name}
                      <button onClick={() => removeTag(t.key)} style={{ border: "none", background: "none", cursor: "pointer", color: CLR.primary, fontSize: 14, lineHeight: 1, padding: 0, opacity: 0.6 }}>×</button>
                    </span>
                  ))
              }
            </div>
            {availableTags.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginTop: 6 }}>
                {availableTags.map(t => (
                  <button key={t.key} onClick={() => addTag(t.key)} type="button"
                    style={{ fontSize: 11, padding: "2px 8px", border: `1px solid ${CLR.border}`, background: "#fff", cursor: "pointer", color: CLR.muted, fontFamily: "inherit" }}>
                    + {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Pricing Type */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const, color: CLR.faint, letterSpacing: "0.08em", marginBottom: 8 }}>Pricing Type</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, border: `1px solid ${CLR.border}`, marginBottom: 14 }}>
            {(["fixed", "percentage", "per_unit"] as AddonPricingType[]).map((pt, i) => {
              const cfg    = PRICING_TYPE_CONFIG[pt];
              const active = pricingType === pt;
              return (
                <button key={pt} type="button" onClick={() => setPricingType(pt)}
                  style={{
                    padding: "14px 8px", textAlign: "center" as const, cursor: "pointer", fontFamily: "inherit",
                    borderLeft: i > 0 ? `1px solid ${CLR.border}` : "none",
                    background: active ? cfg.activeBg : "#fff",
                    border: "none",
                    borderRight: i < 2 ? `1px solid ${CLR.border}` : "none",
                    outline: active ? `2px solid ${cfg.activeBorder}` : "none",
                    outlineOffset: -2,
                  }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: active ? cfg.activeColor : CLR.faint }}>{cfg.label}</div>
                </button>
              );
            })}
          </div>

          {/* Fixed note */}
          {pricingType === "fixed" && (
            <div style={{ border: `1px solid #a7d9d1`, background: CLR.primaryBg, padding: "10px 12px", fontSize: 11, color: CLR.primary }}>
              Fixed prices are set per market and customer group in the pricing grid below.
            </div>
          )}

          {/* Percentage config */}
          {pricingType === "percentage" && (
            <div style={{ border: `1px solid #a7d9d1`, background: CLR.primaryBg, padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: CLR.primary, marginBottom: 10 }}>Percentage of Parent Plan Price</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="number" value={percentage} onChange={e => setPercentage(e.target.value)} min="0" max="100"
                  style={{ width: 80, padding: "7px 10px", fontSize: 16, fontWeight: 700, border: `1px solid #a7d9d1`, background: "#fff", outline: "none", fontFamily: "monospace", color: CLR.primary, textAlign: "right" as const }} />
                <span style={{ fontSize: 18, fontWeight: 700, color: CLR.primary }}>%</span>
              </div>
              <div style={{ fontSize: 11, color: CLR.primary, marginTop: 8, opacity: 0.8 }}>
                Calculated at order time based on the parent plan&apos;s resolved price. Snapshotted on subscription.
              </div>
            </div>
          )}

          {/* Per unit config */}
          {pricingType === "per_unit" && (
            <div style={{ border: `1px solid #a7d9d1`, background: CLR.primaryBg, padding: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: CLR.primary, marginBottom: 6 }}>Unit Label</div>
                  <input value={unitLabel} onChange={e => setUnitLabel(e.target.value)} placeholder="IP, GB, seat…"
                    style={{ width: "100%", padding: "7px 10px", fontSize: 13, border: `1px solid #a7d9d1`, background: "#fff", outline: "none", fontFamily: "inherit", boxSizing: "border-box" as const }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: CLR.primary, marginBottom: 6 }}>Min / Max {unitLabel || "Units"}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input type="number" value={minUnits} onChange={e => setMinUnits(e.target.value)} placeholder="Min"
                      style={{ flex: 1, padding: "7px 8px", fontSize: 13, border: `1px solid #a7d9d1`, background: "#fff", outline: "none", fontFamily: "monospace" }} />
                    <span style={{ color: "#a7d9d1" }}>–</span>
                    <input type="number" value={maxUnits} onChange={e => setMaxUnits(e.target.value)} placeholder="Max"
                      style={{ flex: 1, padding: "7px 8px", fontSize: 13, border: `1px solid #a7d9d1`, background: "#fff", outline: "none", fontFamily: "monospace" }} />
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: CLR.primary, marginTop: 10, borderTop: `1px solid #a7d9d1`, paddingTop: 8, opacity: 0.8 }}>
                Price per {unitLabel || "unit"} is set per market and customer group in the pricing grid below.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Product Pricing Panel ────────────────────────────────────────────────────

function ProductPricingPanel({ product, markets, groups, allPricing, allOverrides, allTags, onSave, onSaveOverride, onDeleteOverride }: {
  product: Product; markets: Market[]; groups: CustomerGroup[];
  allPricing: PricingRow[]; allOverrides: Override[]; allTags: TagRow[];
  onSave: (pid: string, mid: string, saves: { groupId: string; period: BillingPeriod; cents: number }[], deletes: { groupId: string; period: BillingPeriod; existingId: string }[]) => Promise<void>;
  onSaveOverride: (pid: string, mid: string, uid: string, bp: BillingPeriod, cents: number) => Promise<void>;
  onDeleteOverride: (id: string) => Promise<void>;
}) {
  const [activeMarket, setActiveMarket] = useState(markets[0]?.id ?? "");
  const [saving,       setSaving]       = useState(false);
  const [entTarget,    setEntTarget]    = useState<Market | null>(null);
  const [drafts,       setDrafts]       = useState<Record<string, string>>({});
  const [adjustments,  setAdjustments]  = useState<Record<string, string>>({});

  // Addon state
  const isAddon = product.type === "addon";
  const [addonPricingType, setAddonPricingType] = useState<AddonPricingType>(product.addonPricingType ?? "fixed");
  const [addonBehavior,    setAddonBehavior]    = useState<"optional" | "required">(product.addonBehavior ?? "optional");
  const [applicableTags,   setApplicableTags]   = useState<string[]>(product.applicableTags ?? []);
  const [addonUnitLabel,   setAddonUnitLabel]   = useState(product.addonUnitLabel ?? "");
  const [addonMinUnits,    setAddonMinUnits]    = useState(product.addonMinUnits?.toString() ?? "");
  const [addonMaxUnits,    setAddonMaxUnits]    = useState(product.addonMaxUnits?.toString() ?? "");
  const [addonPercentage,  setAddonPercentage]  = useState(product.addonPercentage?.toString() ?? "20");

  // Show grid: always for plan/service/product; for addon only if fixed or per_unit
  const showPricingGrid = !isAddon || addonPricingType === "fixed" || addonPricingType === "per_unit";

  const market       = markets.find(m => m.id === activeMarket);
  const cs           = market ? currSym(market.defaultCurrency) : "$";
  const sortedGroups = sortGroups(groups);
  const stdGroup     = sortedGroups.find(g => g.key === "standard");

  // Init drafts from saved pricing when market changes
  useEffect(() => {
    if (!market) return;
    const init: Record<string, string> = {};
    sortedGroups.forEach(g => {
      ALL_PERIODS.forEach(p => {
        const saved = allPricing.find(r => r.productId === product.id && r.marketId === market.id && r.customerGroupId === g.id && r.billingPeriod === p);
        init[`${g.id}__${p}`] = saved ? toDisplay(saved.priceCents) : "";
      });
    });
    setDrafts(init);
    setAdjustments({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMarket, allPricing]);

  function handleAdjustmentChange(groupId: string, value: string) {
    setAdjustments(a => ({ ...a, [groupId]: value }));
    if (!stdGroup) return;
    const pct = parseFloat(value);
    if (isNaN(pct)) return;
    setDrafts(d => {
      const updated = { ...d };
      ALL_PERIODS.forEach(p => {
        const base = parseFloat(d[`${stdGroup.id}__${p}`] ?? "");
        if (!isNaN(base)) updated[`${groupId}__${p}`] = (base * (1 + pct / 100)).toFixed(2);
      });
      return updated;
    });
  }

  async function save() {
    if (!market) return;
    setSaving(true);
    try {
      // Save addon settings first
      if (isAddon) {
        const r = await fetch("/api/admin/catalog/products/addon-settings", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            productId: product.id, addonPricingType, addonBehavior,
            applicableTags,
            addonUnitLabel:  addonUnitLabel  || null,
            addonMinUnits:   addonMinUnits   ? Number(addonMinUnits)  : null,
            addonMaxUnits:   addonMaxUnits   ? Number(addonMaxUnits)  : null,
            addonPercentage: addonPercentage ? Number(addonPercentage): null,
          }),
        });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) { alert(j?.error ?? "Failed to save addon settings"); return; }
      }
      // Save pricing grid (skip for percentage addons — no grid)
      if (showPricingGrid) {
        const saves:   { groupId: string; period: BillingPeriod; cents: number }[]       = [];
        const deletes: { groupId: string; period: BillingPeriod; existingId: string }[]  = [];
        sortedGroups.filter(g => g.key !== "enterprise").forEach(g => {
          ALL_PERIODS.forEach(p => {
            const val      = (drafts[`${g.id}__${p}`] ?? "").trim();
            const existing = allPricing.find(r => r.productId === product.id && r.marketId === market.id && r.customerGroupId === g.id && r.billingPeriod === p);
            if (val === "") { if (existing) deletes.push({ groupId: g.id, period: p, existingId: existing.id }); }
            else { const cents = toCents(val); if (cents !== null) saves.push({ groupId: g.id, period: p, cents }); }
          });
        });
        await onSave(product.id, market.id, saves, deletes);
      }
    } finally { setSaving(false); }
  }

  function discard() {
    if (!market) return;
    const init: Record<string, string> = {};
    sortedGroups.forEach(g => {
      ALL_PERIODS.forEach(p => {
        const saved = allPricing.find(r => r.productId === product.id && r.marketId === market.id && r.customerGroupId === g.id && r.billingPeriod === p);
        init[`${g.id}__${p}`] = saved ? toDisplay(saved.priceCents) : "";
      });
    });
    setDrafts(init);
    setAdjustments({});
  }

  const addonSettingsChanged = isAddon && (
    addonPricingType !== (product.addonPricingType ?? "fixed") ||
    addonBehavior    !== (product.addonBehavior    ?? "optional") ||
    JSON.stringify([...applicableTags].sort()) !== JSON.stringify([...(product.applicableTags ?? [])].sort()) ||
    addonUnitLabel   !== (product.addonUnitLabel   ?? "") ||
    addonMinUnits    !== (product.addonMinUnits?.toString()  ?? "") ||
    addonMaxUnits    !== (product.addonMaxUnits?.toString()  ?? "") ||
    addonPercentage  !== (product.addonPercentage?.toString() ?? "20")
  );

  const gridChanges = sortedGroups.filter(g => g.key !== "enterprise").some(g =>
    ALL_PERIODS.some(p => {
      const val     = (drafts[`${g.id}__${p}`] ?? "").trim();
      const saved   = allPricing.find(r => r.productId === product.id && r.marketId === market?.id && r.customerGroupId === g.id && r.billingPeriod === p);
      const savedVal = saved ? toDisplay(saved.priceCents) : "";
      return val !== savedVal;
    })
  );

  const hasChanges = addonSettingsChanged || gridChanges;

  const modalOverrides = entTarget ? allOverrides.filter(o => o.productId === product.id && o.marketId === entTarget.id) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Addon settings panel */}
      {isAddon && (
        <AddonSettingsPanel
          allTags={allTags}
          pricingType={addonPricingType}   setPricingType={setAddonPricingType}
          behavior={addonBehavior}         setBehavior={setAddonBehavior}
          applicableTags={applicableTags}  setApplicableTags={setApplicableTags}
          unitLabel={addonUnitLabel}       setUnitLabel={setAddonUnitLabel}
          minUnits={addonMinUnits}         setMinUnits={setAddonMinUnits}
          maxUnits={addonMaxUnits}         setMaxUnits={setAddonMaxUnits}
          percentage={addonPercentage}     setPercentage={setAddonPercentage}
        />
      )}

      {/* Only show grid if not percentage addon */}
      {showPricingGrid && <>
      {/* Market tabs */}
      <div style={{ display: "flex", gap: 6 }}>
        {markets.map(m => (
          <button key={m.id} type="button" onClick={() => setActiveMarket(m.id)}
            style={{
              padding: "5px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
              background: m.id === activeMarket ? "#222" : "#fff",
              color: m.id === activeMarket ? "#fff" : "#374151",
              border: `1px solid ${m.id === activeMarket ? "#222" : "#d1d5db"}`,
            }}>
            {m.name} · {m.defaultCurrency}
          </button>
        ))}
      </div>

      {/* Metered banner */}
      {(product.tags ?? []).some(t => t.key === "metered") && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", background: "#f0fdf9", border: "1px solid #a7d9d1" }}>
          <span style={{ fontSize: 16, lineHeight: 1.4 }}>📊</span>
          <div>
            <div style={{ fontWeight: 600, fontSize: 12, color: CLR.primary }}>Metered Plan</div>
            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
              Prices below are per unit per billing period. Customers choose their quantity at subscription time — mid-cycle upgrades are pro-rated automatically.
            </div>
          </div>
        </div>
      )}

      {/* Group columns */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${sortedGroups.length}, 1fr)`, gap: 12 }}>
        {sortedGroups.map(group => {
          const isStd = group.key === "standard";
          const isEnt = group.key === "enterprise";
          const overrideCount = allOverrides.filter(o => o.productId === product.id && o.marketId === activeMarket).length;
          const headerBg     = isStd ? CLR.primaryBg  : isEnt ? "#faf5ff" : "#fffbeb";
          const headerBorder = isStd ? "#a7d9d1"      : isEnt ? "#e9d5ff" : "#fde68a";
          const labelColor   = isStd ? CLR.primary    : isEnt ? "#7c3aed" : "#b45309";

          return (
            <div key={group.id} style={{ border: `1px solid ${headerBorder}`, background: "#fff" }}>
              {/* Header */}
              <div style={{ background: headerBg, borderBottom: `1px solid ${headerBorder}`, padding: "9px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", minHeight: 42 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: labelColor }}>{group.name}</span>
                {isStd && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", background: CLR.primary, color: "#fff" }}>Base price</span>}
                {!isStd && !isEnt && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 11, color: "#b45309", fontWeight: 600 }}>%</span>
                    <input type="number" placeholder="0" value={adjustments[group.id] ?? ""}
                      onChange={e => handleAdjustmentChange(group.id, e.target.value)}
                      style={{ width: 56, height: 26, padding: "0 8px", fontSize: 12, fontFamily: "inherit", border: "1px solid #fde68a", background: "#fff", color: "#92400e", outline: "none", textAlign: "right" }} />
                  </div>
                )}
              </div>

              {/* Rows */}
              {isEnt ? (
                <div style={{ padding: 14 }}>
                  <button type="button" onClick={() => setEntTarget(market ?? null)}
                    style={{ width: "100%", padding: "10px 12px", border: "1.5px dashed #c4b5fd", background: "transparent", color: "#7c3aed", cursor: "pointer", fontSize: 12, fontFamily: "inherit", fontWeight: 500 }}>
                    🔑 Manage per-customer prices →
                  </button>
                  {(() => {
                    const mktOverrides  = allOverrides.filter(o => o.productId === product.id && o.marketId === activeMarket);
                    const uniqueCount   = new Set(mktOverrides.map(o => o.userId)).size;
                    const overrideCount = mktOverrides.length;
                    return (
                      <div style={{ marginTop: 8, textAlign: "center", fontSize: 11, color: "#9ca3af" }}>
                        {overrideCount === 0
                          ? "No Overrides"
                          : `${uniqueCount} Customer${uniqueCount !== 1 ? "s" : ""} · ${overrideCount} Override${overrideCount !== 1 ? "s" : ""}`}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                ALL_PERIODS.map(period => {
                  const key       = `${group.id}__${period}`;
                  const val       = drafts[key] ?? "";
                  const saved     = allPricing.find(r => r.productId === product.id && r.marketId === activeMarket && r.customerGroupId === group.id && r.billingPeriod === period);
                  const savedVal  = saved ? toDisplay(saved.priceCents) : "";
                  const isDirty   = val !== savedVal;
                  const isDerived = !isStd && val !== "" && adjustments[group.id] !== undefined && adjustments[group.id] !== "";

                  return (
                    <div key={period} style={{ display: "flex", alignItems: "center", gap: 0, padding: "0 10px", height: 46, borderBottom: `1px solid #f3f4f6`, background: isDirty ? "#fffef0" : "#fff" }}>
                      <span style={{ fontSize: 11, color: "#9ca3af", width: 66, flexShrink: 0 }}>{PERIOD_LABELS[period]}</span>
                      <div style={{ display: "flex", alignItems: "center", flex: 1, border: `1px solid ${isDirty ? "#fbbf24" : isDerived ? "#93c5fd" : val ? "#d1d5db" : "#e5e7eb"}`, background: "#fff", height: 32 }}>
                        <span style={{ padding: "0 7px", color: "#9ca3af", fontSize: 12, borderRight: `1px solid #e5e7eb`, height: "100%", display: "flex", alignItems: "center", background: "#f9fafb", userSelect: "none" as const }}>{cs}</span>
                        <input type="number" placeholder="—" value={val}
                          onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))}
                          style={{ flex: 1, height: "100%", border: "none", outline: "none", fontSize: 13, fontFamily: "monospace", padding: "0 8px", background: "transparent", color: val ? "#111827" : "#9ca3af", minWidth: 0 }} />
                      </div>
                      <button type="button" onClick={() => setDrafts(d => ({ ...d, [key]: "" }))} title="Clear"
                        style={{ border: "none", background: "none", cursor: val ? "pointer" : "default", color: val ? "#f87171" : "transparent", padding: "0 0 0 6px", fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
                    </div>
                  );
                })
              )}
            </div>
          );
        })}
      </div>

      </>}

      {/* Save / Discard bar — always visible */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "10px 14px", background: hasChanges ? "#fffbeb" : "#f9fafb", border: `1px solid ${hasChanges ? "#fde68a" : CLR.border}` }}>
        {hasChanges && <span style={{ fontSize: 12, color: "#92400e", marginRight: "auto" }}>You have unsaved changes</span>}
        <button type="button" onClick={discard} disabled={!hasChanges}
          style={{ padding: "6px 16px", fontSize: 13, fontFamily: "inherit", fontWeight: 500, background: "#fff", color: hasChanges ? "#374151" : "#9ca3af", border: `1px solid ${hasChanges ? "#d1d5db" : "#e5e7eb"}`, cursor: hasChanges ? "pointer" : "not-allowed", opacity: hasChanges ? 1 : 0.5 }}>
          Discard
        </button>
        <button type="button" onClick={save} disabled={saving}
          style={{ padding: "6px 18px", fontSize: 13, fontFamily: "inherit", fontWeight: 600, background: CLR.primary, color: "#fff", border: "none", cursor: "pointer" }}>
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {/* Enterprise modal */}
      {entTarget && market && (
        <EnterpriseModal
          product={product} market={entTarget} overrides={modalOverrides}
          onClose={() => setEntTarget(null)}
          onSave={(uid, bp, cents) => onSaveOverride(product.id, entTarget.id, uid, bp, cents)}
          onDelete={onDeleteOverride}
        />
      )}
    </div>
  );
}

// ─── Enterprise Modal ─────────────────────────────────────────────────────────

function EnterpriseModal({ product, market, overrides, onClose, onSave, onDelete }: {
  product: Product; market: Market; overrides: Override[];
  onClose: () => void;
  onSave: (uid: string, bp: BillingPeriod, cents: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [customers, setCustomers] = useState<EnterpriseCustomer[]>([]);
  const [loadingC,  setLoadingC]  = useState(true);
  const [userId,    setUserId]    = useState("");
  const [period,    setPeriod]    = useState<BillingPeriod>("YEARLY");
  const [price,     setPrice]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const cs = currSym(market.defaultCurrency);

  useEffect(() => {
    fetch("/api/admin/catalog/pricing/enterprise-customers", { cache: "no-store" })
      .then(r => r.json()).then(j => { if (j?.ok) setCustomers(j.data ?? []); })
      .catch(() => null).finally(() => setLoadingC(false));
  }, []);

  // Split customers into those with/without overrides for this product+market
  const withOverrideIds = new Set(overrides.map(o => o.userId));
  const withOverrides   = customers.filter(c => withOverrideIds.has(c.id));
  const withoutOverrides = customers.filter(c => !withOverrideIds.has(c.id));

  async function add() {
    const cents = toCents(price);
    if (!userId || cents === null) return;
    setSaving(true);
    try { await onSave(userId, period, cents); setUserId(""); setPrice(""); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 560, background: "#fff", border: `1px solid ${CLR.border}`, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${CLR.border}`, padding: "14px 20px" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{product.name}</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>Enterprise overrides · {market.name} ({market.defaultCurrency})</div>
          </div>
          <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "#9ca3af" }}>✕</button>
        </div>

        {/* Existing overrides */}
        <div style={{ maxHeight: 200, overflowY: "auto", borderBottom: `1px solid ${CLR.border}` }}>
          {overrides.length === 0 ? (
            <div style={{ padding: "16px 20px", fontSize: 12, color: "#9ca3af" }}>No overrides yet for this market.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: "#f9fafb" }}>
                  {["Customer", "Period", "Price", ""].map(h => (
                    <th key={h} style={{ padding: "6px 12px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overrides.map(o => (
                  <tr key={o.id} style={{ borderTop: `1px solid ${CLR.border}` }}>
                    <td style={{ padding: "7px 12px" }}>
                      <div style={{ fontWeight: 500 }}>{o.user?.fullName ?? "—"}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{o.user?.email}</div>
                    </td>
                    <td style={{ padding: "7px 12px", color: "#6b7280" }}>{PERIOD_LABELS[o.billingPeriod]}</td>
                    <td style={{ padding: "7px 12px", fontWeight: 600, fontFamily: "monospace" }}>{cs}{toDisplay(o.priceCents)}</td>
                    <td style={{ padding: "7px 12px" }}>
                      <button onClick={() => onDelete(o.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#f87171", fontSize: 14 }}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Add new override */}
        <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" }}>Add / Update Override</div>

          {/* Dropdown 1: customers with existing overrides */}
          {withOverrides.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Edit existing customer</div>
              <select className="cy-input" value={userId} onChange={e => setUserId(e.target.value)} style={{ width: "100%" }}>
                <option value="">— select customer —</option>
                {withOverrides.map(c => <option key={c.id} value={c.id}>#{c.customerNumber} — {c.fullName ?? "No name"} ({c.email})</option>)}
              </select>
            </div>
          )}

          {/* Dropdown 2: customers without overrides */}
          <div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Add new customer override</div>
            <select className="cy-input" value={withOverrides.length > 0 ? "" : userId} onChange={e => setUserId(e.target.value)} style={{ width: "100%" }}>
              <option value="">{loadingC ? "Loading…" : withoutOverrides.length === 0 ? "All customers have overrides" : "— select customer —"}</option>
              {withoutOverrides.map(c => <option key={c.id} value={c.id}>#{c.customerNumber} — {c.fullName ?? "No name"} ({c.email})</option>)}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
            <select className="cy-input" value={period} onChange={e => setPeriod(e.target.value as BillingPeriod)}>
              {ALL_PERIODS.map(p => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
            </select>
            <div style={{ display: "flex", alignItems: "center", border: `1px solid ${CLR.border}`, background: "#fff" }}>
              <span style={{ padding: "0 8px", color: "#9ca3af", fontSize: 12, borderRight: `1px solid ${CLR.border}`, height: "100%", display: "flex", alignItems: "center", background: "#f9fafb" }}>{cs}</span>
              <input type="number" placeholder="0.00" value={price} onChange={e => setPrice(e.target.value)}
                style={{ flex: 1, height: "100%", border: "none", outline: "none", padding: "0 8px", fontSize: 13, fontFamily: "monospace" }} />
            </div>
            <button onClick={add} disabled={saving || !userId || !price.trim()}
              style={{ padding: "0 18px", background: CLR.primary, color: "#fff", border: "none", cursor: !userId || !price ? "not-allowed" : "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13, opacity: !userId || !price ? 0.5 : 1 }}>
              {saving ? "…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}