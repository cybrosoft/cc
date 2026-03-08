// app/admin/catalog/pricing/PricingAdmin.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingPeriod = "MONTHLY" | "SIX_MONTHS" | "YEARLY" | "ONE_TIME";
type ProductType   = "plan" | "addon" | "service" | "product";

const ALL_PERIODS: BillingPeriod[] = ["MONTHLY", "SIX_MONTHS", "YEARLY", "ONE_TIME"];

const PERIOD_LABELS: Record<BillingPeriod, string> = {
  MONTHLY:    "Monthly",
  SIX_MONTHS: "6 Months",
  YEARLY:     "Yearly",
  ONE_TIME:   "One-time",
};

// Fixed display order for groups
const GROUP_ORDER = ["standard", "business", "professional", "enterprise"];

const TYPE_COLORS: Record<ProductType, string> = {
  plan:    "bg-blue-50 text-blue-700 border-blue-200",
  addon:   "bg-purple-50 text-purple-700 border-purple-200",
  service: "bg-amber-50 text-amber-700 border-amber-200",
  product: "bg-green-50 text-green-700 border-green-200",
};

type Market        = { id: string; key: string; name: string; defaultCurrency: string };
type CustomerGroup = { id: string; key: string; name: string };

type PricingRow = {
  id:              string;
  productId:       string;
  marketId:        string;
  customerGroupId: string;
  billingPeriod:   BillingPeriod;
  priceCents:      number;
  isActive:        boolean;
};

type Override = {
  id:            string;
  productId:     string;
  marketId:      string;
  userId:        string;
  billingPeriod: BillingPeriod;
  priceCents:    number;
  user:          { id: string; fullName: string | null; email: string };
};

type AddonPricingType = "fixed" | "percentage" | "per_unit";

type Product = {
  id:             string;
  key:            string;
  name:           string;
  type:           ProductType;
  billingPeriods: BillingPeriod[];
  isActive:       boolean;
  category:       { id: string; name: string } | null;
  zohoPlanId?:    string | null;
  tags:           { id: string; key: string; name: string }[];
  // addon-specific fields (null/empty for non-addons)
  addonPricingType: AddonPricingType | null;
  addonBehavior:    "optional" | "required" | null;
  applicableTags:   string[];
  addonUnitLabel:   string | null;
  addonMinUnits:    number | null;
  addonMaxUnits:    number | null;
  addonPercentage:  number | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const currSym   = (c: string) => c === "SAR" ? "﷼" : "$";
const toDisplay = (cents: number) => (cents / 100).toFixed(2);
const toCents   = (val: string): number | null => {
  const n = parseFloat(val.trim());
  return isNaN(n) || n < 0 ? null : Math.round(n * 100);
};

function sortGroups(groups: CustomerGroup[]): CustomerGroup[] {
  return [...groups].sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.key);
    const bi = GROUP_ORDER.indexOf(b.key);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}

function TypeBadge({ type }: { type: ProductType }) {
  const labels: Record<ProductType, string> = { plan: "Plan", addon: "Addon", service: "Service", product: "Product" };
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${TYPE_COLORS[type]}`}>
      {labels[type]}
    </span>
  );
}


// ─── All Tags Context (passed down) ──────────────────────────────────────────

type TagRow = { id: string; key: string; name: string };

// ─── Addon Settings Panel ─────────────────────────────────────────────────────

const ADDON_PRICING_TYPES: Record<AddonPricingType, { label: string; icon: string; color: string }> = {
  fixed:      { label: "Fixed Price",  icon: "💰", color: "bg-blue-50 text-blue-700 border-blue-200"       },
  percentage: { label: "% of Parent",  icon: "%",  color: "bg-violet-50 text-violet-700 border-violet-200" },
  per_unit:   { label: "Per Unit",     icon: "📦", color: "bg-orange-50 text-orange-700 border-orange-200" },
};

function AddonSettingsPanel({
  product, allTags,
  pricingType,    setPricingType,
  behavior,       setBehavior,
  applicableTags, setApplicableTags,
  unitLabel,      setUnitLabel,
  minUnits,       setMinUnits,
  maxUnits,       setMaxUnits,
  percentage,     setPercentage,
}: {
  product:         Product;
  allTags:         TagRow[];
  pricingType:     AddonPricingType;
  setPricingType:  (v: AddonPricingType) => void;
  behavior:        "optional" | "required";
  setBehavior:     (v: "optional" | "required") => void;
  applicableTags:  string[];
  setApplicableTags: (v: string[]) => void;
  unitLabel:       string;
  setUnitLabel:    (v: string) => void;
  minUnits:        string;
  setMinUnits:     (v: string) => void;
  maxUnits:        string;
  setMaxUnits:     (v: string) => void;
  percentage:      string;
  setPercentage:   (v: string) => void;
}) {
  const selectedTags  = allTags.filter((t) => applicableTags.includes(t.key));
  const availableTags = allTags.filter((t) => !applicableTags.includes(t.key));
  const addTag        = (key: string) => { if (!applicableTags.includes(key)) setApplicableTags([...applicableTags, key]); };
  const removeTag     = (key: string) => setApplicableTags(applicableTags.filter((k) => k !== key));

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-700">⚙️ Addon Settings</span>
        <span className="text-[11px] text-gray-400">Configure how this addon behaves and is priced</span>
      </div>

      <div className="grid gap-5 md:grid-cols-2">

        {/* LEFT — Behavior + Applicable tags */}
        <div className="space-y-4">
          {/* Behavior */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Behavior</label>
            <div className="flex gap-2">
              {(["optional", "required"] as const).map((b) => (
                <button key={b} type="button" onClick={() => setBehavior(b)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-xs font-semibold transition-all ${
                    behavior === b
                      ? b === "required"
                        ? "border-red-200 bg-red-50 text-red-600 shadow-sm"
                        : "border-gray-300 bg-gray-900 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-400 hover:bg-gray-50"
                  }`}>
                  {b === "required" ? "🔒 Required" : "✋ Optional"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400">
              {behavior === "required"
                ? "Auto-added with parent plan. Customer cannot remove."
                : "Customer can choose to add during subscription creation."}
            </p>
          </div>

          {/* Applicable tags */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Appears for Plans Tagged
            </label>
            <div className="min-h-[36px] flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
              {selectedTags.length === 0
                ? <span className="text-[11px] text-gray-400">No tags — won't appear for any plan</span>
                : selectedTags.map((t) => (
                  <span key={t.key} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-700 shadow-sm">
                    {t.name}
                    <button type="button" onClick={() => removeTag(t.key)} className="opacity-50 hover:opacity-100 text-[10px]">✕</button>
                  </span>
                ))
              }
            </div>
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {availableTags.map((t) => (
                  <button key={t.key} type="button" onClick={() => addTag(t.key)}
                    className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-400 hover:border-gray-500 hover:text-gray-600 transition-colors">
                    + {t.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Pricing type + type-specific config */}
        <div className="space-y-4">
          {/* Pricing type */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Pricing Type</label>
            <div className="flex gap-2">
              {(Object.entries(ADDON_PRICING_TYPES) as [AddonPricingType, typeof ADDON_PRICING_TYPES[AddonPricingType]][]).map(([key, cfg]) => (
                <button key={key} type="button" onClick={() => setPricingType(key)}
                  className={`flex flex-1 flex-col items-center gap-1 rounded-xl border py-2.5 text-[11px] font-semibold transition-all ${
                    pricingType === key ? `${cfg.color} shadow-sm` : "border-gray-200 bg-white text-gray-400 hover:bg-gray-50"
                  }`}>
                  <span className="text-base">{cfg.icon}</span>
                  <span>{cfg.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Percentage config */}
          {pricingType === "percentage" && (
            <div className="space-y-2 rounded-xl border border-violet-100 bg-violet-50/50 p-4">
              <label className="text-[11px] font-semibold text-gray-500">Percentage of Parent Plan Price</label>
              <div className="flex items-center gap-2" style={{ maxWidth: 140 }}>
                <div className="flex flex-1 items-center gap-1 rounded-xl border border-violet-300 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-violet-200">
                  <input type="number" min={1} max={100} step={0.5}
                    value={percentage} onChange={(e) => setPercentage(e.target.value)}
                    className="w-full bg-transparent text-sm font-bold text-violet-800 focus:outline-none" />
                  <span className="text-sm font-bold text-violet-500">%</span>
                </div>
              </div>
              <p className="text-[11px] text-violet-700">
                Calculated at order time based on the parent plan's resolved price. Snapshotted on subscription.
              </p>
            </div>
          )}

          {/* Per unit config — label + limits only, prices in grid */}
          {pricingType === "per_unit" && (
            <div className="space-y-3 rounded-xl border border-orange-100 bg-orange-50/50 p-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500">Unit Label</label>
                  <input value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} placeholder="GB, IP, User…"
                    className="w-full rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-gray-500">Min / Max {unitLabel || "Units"}</label>
                  <div className="flex items-center gap-1">
                    <input type="number" value={minUnits} onChange={(e) => setMinUnits(e.target.value)} placeholder="Min"
                      className="w-full rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
                    <span className="text-gray-300">–</span>
                    <input type="number" value={maxUnits} onChange={(e) => setMaxUnits(e.target.value)} placeholder="Max"
                      className="w-full rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-orange-600">
                💡 Price per {unitLabel || "unit"} is set per market and customer group in the pricing grid below.
              </p>
            </div>
          )}

          {/* Fixed note */}
          {pricingType === "fixed" && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 text-[11px] text-blue-700">
              Fixed prices are set per market and customer group in the pricing grid below.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Enterprise Modal ─────────────────────────────────────────────────────────

type EnterpriseCustomer = { id: string; fullName: string | null; email: string; customerNumber: number };

function EnterpriseModal({
  product, market, overrides, onClose, onSave, onDelete,
}: {
  product:   Product;
  market:    Market;
  overrides: Override[];
  onClose:   () => void;
  onSave:    (userId: string, period: BillingPeriod, cents: number) => Promise<void>;
  onDelete:  (id: string) => Promise<void>;
}) {
  const [customers, setCustomers] = useState<EnterpriseCustomer[]>([]);
  const [userId,    setUserId]    = useState("");
  const [period,    setPeriod]    = useState<BillingPeriod>("YEARLY");
  const [price,     setPrice]     = useState("");
  const [saving,    setSaving]    = useState(false);
  const [loadingC,  setLoadingC]  = useState(true);
  const cs = currSym(market.defaultCurrency);

  useEffect(() => {
    fetch("/api/admin/catalog/pricing/enterprise-customers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (j?.ok) setCustomers(j.data ?? []); })
      .catch(() => null)
      .finally(() => setLoadingC(false));
  }, []);

  async function add() {
    const cents = toCents(price);
    if (!userId || cents === null) return;
    setSaving(true);
    try { await onSave(userId, period, cents); setUserId(""); setPrice(""); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <div className="font-semibold text-gray-900">{product.name}</div>
            <div className="text-xs text-gray-500">Enterprise overrides · {market.name} ({market.defaultCurrency})</div>
          </div>
          <button onClick={onClose} className="text-lg text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="max-h-56 overflow-y-auto px-5 py-3">
          {overrides.length === 0
            ? <p className="py-6 text-center text-sm text-gray-400">No overrides yet.</p>
            : (
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-400"><th className="pb-2">Customer</th><th className="pb-2">Period</th><th className="pb-2">Price</th><th /></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {overrides.map((o) => (
                    <tr key={o.id}>
                      <td className="py-2 text-xs"><div className="font-medium text-gray-800">{o.user.fullName ?? "—"}</div><div className="text-gray-400">{o.user.email}</div></td>
                      <td className="py-2 text-xs text-gray-600">{PERIOD_LABELS[o.billingPeriod]}</td>
                      <td className="py-2 text-xs font-semibold">{cs}{toDisplay(o.priceCents)}</td>
                      <td className="py-2 text-right"><button onClick={() => void onDelete(o.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
        </div>
        <div className="border-t bg-gray-50 px-5 py-4 space-y-3">
          <div className="text-xs font-semibold text-gray-600">Add price override</div>
          <select
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
          >
            <option value="">
              {loadingC ? "Loading customers…" : customers.length === 0 ? "No enterprise customers found" : "Select customer…"}
            </option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                #{c.customerNumber} — {c.fullName ?? "No name"} ({c.email})
              </option>
            ))}
          </select>
          <div className="grid grid-cols-3 gap-2">
            <select
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              value={period} onChange={(e) => setPeriod(e.target.value as BillingPeriod)}
            >
              {ALL_PERIODS.map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
            </select>
            <div className="flex items-center rounded-lg border border-gray-200 bg-white px-3 focus-within:ring-2 focus-within:ring-gray-300">
              <span className="mr-1 text-sm text-gray-400">{cs}</span>
              <input className="w-full py-2 text-sm focus:outline-none" placeholder="0.00" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <button onClick={() => void add()} disabled={saving || !userId || !price.trim()} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40">
              {saving ? "…" : "Add"}
            </button>
          </div>
          {customers.length === 0 && !loadingC && (
            <p className="text-xs text-amber-600">No customers are assigned to the Enterprise group yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Product Pricing Panel ────────────────────────────────────────────────────

function ProductPricingPanel({
  product, markets, groups, allPricing, allOverrides, allTags,
  onSave, onSaveOverride, onDeleteOverride,
}: {
  product:          Product;
  markets:          Market[];
  groups:           CustomerGroup[];
  allPricing:       PricingRow[];
  allOverrides:     Override[];
  allTags:          TagRow[];
  onSave:           (productId: string, marketId: string, saves: { groupId: string; period: BillingPeriod; cents: number }[], deletes: { groupId: string; period: BillingPeriod; existingId: string }[]) => Promise<void>;
  onSaveOverride:   (productId: string, marketId: string, userId: string, period: BillingPeriod, cents: number) => Promise<void>;
  onDeleteOverride: (id: string) => Promise<void>;
}) {
  const isAddon    = product.type === "addon";
  const isMetered  = !isAddon && (product.tags ?? []).some((t: { key: string }) => t.key === "metered");
  const meteredUnitLabel = product.unitLabel ?? "";

  const [activeMarket, setActiveMarket] = useState(markets[0]?.id ?? "");
  const [saving,       setSaving]       = useState(false);
  const [entTarget,    setEntTarget]    = useState<Market | null>(null);

  // drafts: `${groupId}__${period}` → display string
  const [drafts,      setDrafts]      = useState<Record<string, string>>({});
  // % adjustments per group: groupId → string
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});

  // ── Addon settings state (initialised from product) ──
  const [addonPricingType, setAddonPricingType] = useState<AddonPricingType>(product.addonPricingType ?? "fixed");
  const [addonBehavior,    setAddonBehavior]    = useState<"optional" | "required">(product.addonBehavior ?? "optional");
  const [applicableTags,   setApplicableTags]   = useState<string[]>(product.applicableTags ?? []);
  const [addonUnitLabel,   setAddonUnitLabel]   = useState(product.addonUnitLabel ?? "");
  const [addonMinUnits,    setAddonMinUnits]    = useState(product.addonMinUnits?.toString() ?? "");
  const [addonMaxUnits,    setAddonMaxUnits]    = useState(product.addonMaxUnits?.toString() ?? "");
  const [addonPercentage,  setAddonPercentage]  = useState(product.addonPercentage?.toString() ?? "20");

  // Show pricing grid: always for plan/service/product; for addon only if fixed or per_unit
  const showPricingGrid = !isAddon || addonPricingType === "fixed" || addonPricingType === "per_unit";


  const market       = markets.find((m) => m.id === activeMarket);
  const cs           = market ? currSym(market.defaultCurrency) : "$";
  const sortedGroups = sortGroups(groups);
  const stdGroup     = sortedGroups.find((g) => g.key === "standard");

  // Always show all 4 periods regardless of what's set on the product
  const periods = ALL_PERIODS;

  // Init drafts from saved pricing whenever market changes
  useEffect(() => {
    if (!market) return;
    const init: Record<string, string> = {};
    sortedGroups.forEach((g) => {
      periods.forEach((p) => {
        const saved = allPricing.find(
          (r) => r.productId === product.id && r.marketId === market.id
              && r.customerGroupId === g.id && r.billingPeriod === p
        );
        init[`${g.id}__${p}`] = saved ? toDisplay(saved.priceCents) : "";
      });
    });
    setDrafts(init);
    setAdjustments({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMarket, allPricing]);

  // Auto-calculate derived prices as % is typed — no Apply button needed
  function handleAdjustmentChange(groupId: string, value: string) {
    setAdjustments((a) => ({ ...a, [groupId]: value }));
    if (!stdGroup) return;
    const pct = parseFloat(value);
    if (isNaN(pct)) return;
    setDrafts((d) => {
      const updated = { ...d };
      periods.forEach((p) => {
        const base = parseFloat(d[`${stdGroup.id}__${p}`] ?? "");
        if (!isNaN(base)) {
          updated[`${groupId}__${p}`] = (base * (1 + pct / 100)).toFixed(2);
        }
      });
      return updated;
    });
  }

  // On Save: upsert filled fields, delete blanked fields that previously existed
  async function save() {
    setSaving(true);
    try {
      // 1. Save addon settings first (if addon product)
      if (isAddon) {
        const addonRes = await fetch("/api/admin/catalog/products/addon-settings", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            productId:        product.id,
            addonPricingType: addonPricingType,
            addonBehavior:    addonBehavior,
            applicableTags:   applicableTags,
            addonUnitLabel:   addonUnitLabel   || null,
            addonMinUnits:    addonMinUnits    ? Number(addonMinUnits)    : null,
            addonMaxUnits:    addonMaxUnits    ? Number(addonMaxUnits)    : null,
            addonPercentage:  addonPercentage  ? Number(addonPercentage) : null,
          }),
        });
        const addonJson = await addonRes.json().catch(() => null) as { ok: boolean; error?: string } | null;
        if (!addonRes.ok || !addonJson?.ok) {
          alert(addonJson?.error ?? "Failed to save addon settings");
          return;
        }
      }

      // 2. Save pricing grid (fixed and per_unit only — percentage has no grid)
      if (showPricingGrid && market) {
        const saves:   { groupId: string; period: BillingPeriod; cents: number }[]        = [];
        const deletes: { groupId: string; period: BillingPeriod; existingId: string }[]   = [];

        sortedGroups.filter((g) => g.key !== "enterprise").forEach((g) => {
          periods.forEach((p) => {
            const val      = (drafts[`${g.id}__${p}`] ?? "").trim();
            const existing = allPricing.find(
              (r) => r.productId === product.id && r.marketId === market.id
                  && r.customerGroupId === g.id && r.billingPeriod === p
            );
            if (val === "") {
              if (existing) deletes.push({ groupId: g.id, period: p, existingId: existing.id });
            } else {
              const cents = toCents(val);
              if (cents !== null) saves.push({ groupId: g.id, period: p, cents });
            }
          });
        });

        await onSave(product.id, market.id, saves, deletes);
      }
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!market) return;
    const init: Record<string, string> = {};
    sortedGroups.forEach((g) => {
      periods.forEach((p) => {
        const saved = allPricing.find(
          (r) => r.productId === product.id && r.marketId === market.id
              && r.customerGroupId === g.id && r.billingPeriod === p
        );
        init[`${g.id}__${p}`] = saved ? toDisplay(saved.priceCents) : "";
      });
    });
    setDrafts(init);
    setAdjustments({});
  }

  const modalOverrides = entTarget
    ? allOverrides.filter((o) => o.productId === product.id && o.marketId === entTarget.id)
    : [];

  return (
    <div className="border-t bg-gray-50/60 px-6 py-5 space-y-4">

      {/* ── Addon Settings (addon products only) ── */}
      {isAddon && (
        <AddonSettingsPanel
          product={product}
          allTags={allTags}
          pricingType={addonPricingType}     setPricingType={setAddonPricingType}
          behavior={addonBehavior}           setBehavior={setAddonBehavior}
          applicableTags={applicableTags}    setApplicableTags={setApplicableTags}
          unitLabel={addonUnitLabel}         setUnitLabel={setAddonUnitLabel}
          minUnits={addonMinUnits}           setMinUnits={setAddonMinUnits}
          maxUnits={addonMaxUnits}           setMaxUnits={setAddonMaxUnits}
          percentage={addonPercentage}       setPercentage={setAddonPercentage}
        />
      )}

      {/* ── Percentage addon: no grid ── */}
      {isAddon && addonPricingType === "percentage" && (
        <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-3 text-[11px] text-violet-700">
          💡 Price is computed at order time as <strong>{addonPercentage}% of the parent plan price</strong>. No per-market grid needed.
        </div>
      )}

      {/* ── Metered plan banner ── */}
      {isMetered && (
        <div className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
          <span className="text-base">📊</span>
          <div>
            <div className="text-xs font-semibold text-teal-800">Metered Plan — Price per {meteredUnitLabel || "unit"}</div>
            <p className="text-[11px] text-teal-600 mt-0.5">
              Prices below are per <strong>{meteredUnitLabel || "unit"}</strong> per period.
              Customers choose quantity at subscription time. Mid-cycle upgrades are pro-rated automatically.
            </p>
          </div>
        </div>
      )}

      {/* ── Pricing grid (plans always; addons only if fixed or per_unit) ── */}
      {showPricingGrid && (
      <>
      {/* Market tabs */}
      <div className="flex gap-2">
        {markets.map((m) => (
          <button
            key={m.id}
            onClick={() => setActiveMarket(m.id)}
            className={`rounded-lg border px-4 py-1.5 text-xs font-semibold transition-colors ${
              activeMarket === m.id
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
            }`}
          >
            {m.name} · {m.defaultCurrency}
          </button>
        ))}
      </div>

      {/* Groups grid — Standard, Business, Professional, Enterprise */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${sortedGroups.length}, 1fr)` }}>
        {sortedGroups.map((group) => {
          const isStd = group.key === "standard";
          const isEnt = group.key === "enterprise";
          const overrideCount = allOverrides.filter(
            (o) => o.productId === product.id && o.marketId === activeMarket
          ).length;

          return (
            <div
              key={group.id}
              className={`rounded-2xl border bg-white overflow-hidden shadow-sm ${
                isStd ? "border-blue-200" : isEnt ? "border-purple-200" : "border-gray-200"
              }`}
            >
              {/* Header */}
              <div className={`flex items-center justify-between px-4 py-3 border-b ${
                isStd ? "bg-blue-50 border-blue-100"
                      : isEnt ? "bg-purple-50 border-purple-100"
                      : "bg-white border-gray-100"
              }`}>
                <span className={`text-sm font-semibold ${
                  isStd ? "text-blue-700" : isEnt ? "text-purple-700" : "text-gray-700"
                }`}>
                  {group.name}
                </span>

                {isStd && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                    Base price
                  </span>
                )}

                {/* % input — no Apply button, auto-calculates on change */}
                {!isStd && !isEnt && (
                  <div className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1">
                    <span className="text-[11px] font-bold text-amber-500">%</span>
                    <input
                      className="w-12 bg-transparent text-right text-xs font-semibold text-amber-800 focus:outline-none"
                      placeholder="0"
                      value={adjustments[group.id] ?? ""}
                      onChange={(e) => handleAdjustmentChange(group.id, e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Price rows */}
              <div className="flex flex-col gap-3 px-4 py-4">
                {isEnt ? (
                  <>
                    <button
                      onClick={() => setEntTarget(market ?? null)}
                      className="w-full rounded-xl border border-dashed border-purple-300 bg-purple-50 px-3 py-3 text-center text-xs font-medium text-purple-600 hover:bg-purple-100"
                    >
                      🔑 Manage per-customer prices →
                    </button>
                    {overrideCount > 0 && (
                      <p className="text-center text-[10px] text-gray-400">
                        {overrideCount} customer{overrideCount > 1 ? "s" : ""} have overrides
                      </p>
                    )}
                  </>
                ) : (
                  periods.map((period) => {
                    const key        = `${group.id}__${period}`;
                    const val        = drafts[key] ?? "";
                    const isDerived  = !isStd && val !== "" && adjustments[group.id] !== undefined && adjustments[group.id] !== "";
                    const isPerUnit  = (isAddon && addonPricingType === "per_unit") || isMetered;
                    const unitSuffix = isAddon ? addonUnitLabel : meteredUnitLabel;

                    return (
                      <div key={period} className="flex items-center gap-2">
                        <span className="w-16 shrink-0 text-[11px] text-gray-400">{PERIOD_LABELS[period]}</span>
                        <div className={`flex flex-1 items-center gap-1 rounded-xl border px-3 py-2 focus-within:ring-2 transition-colors ${
                          isPerUnit
                            ? isDerived
                              ? "border-orange-200 bg-orange-50/50 focus-within:ring-orange-200"
                              : "border-orange-100 bg-orange-50/20 focus-within:ring-orange-200"
                            : isDerived
                              ? "border-blue-200 bg-blue-50/50 focus-within:ring-gray-200"
                              : "border-gray-200 bg-gray-50 focus-within:ring-gray-200"
                        }`}>
                          <span className="text-xs text-gray-400">{cs}</span>
                          <input
                            className={`w-full bg-transparent text-sm font-medium focus:outline-none ${
                              isPerUnit
                                ? isDerived ? "text-orange-700" : "text-gray-900"
                                : isDerived ? "text-blue-700"   : "text-gray-900"
                            }`}
                            placeholder="—"
                            value={val}
                            onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                          />
                          {isPerUnit && unitSuffix && (
                            <span className="shrink-0 text-[10px] font-medium text-orange-400">/{unitSuffix}</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
      </>
      )}{/* end showPricingGrid */}

      {/* Save bar — always visible */}
      <div className="flex items-center justify-end gap-3 pt-1">
        <button onClick={discard} className="text-sm text-gray-400 hover:text-gray-600">
          Discard changes
        </button>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="rounded-xl bg-gray-900 px-6 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save Pricing"}
        </button>
      </div>

      {/* Enterprise modal */}
      {entTarget && market && (
        <EnterpriseModal
          product={product}
          market={entTarget}
          overrides={modalOverrides}
          onClose={() => setEntTarget(null)}
          onSave={(userId, period, cents) => onSaveOverride(product.id, entTarget.id, userId, period, cents)}
          onDelete={onDeleteOverride}
        />
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PricingAdmin() {
  const [markets,    setMarkets]    = useState<Market[]>([]);
  const [groups,     setGroups]     = useState<CustomerGroup[]>([]);
  const [products,   setProducts]   = useState<Product[]>([]);
  const [pricing,    setPricing]    = useState<PricingRow[]>([]);
  const [overrides,  setOverrides]  = useState<Override[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [fKey,      setFKey]      = useState("");
  const [fName,     setFName]     = useState("");
  const [fCategory, setFCategory] = useState("");
  const [fType,     setFType]     = useState("");
  const [fEntPrice, setFEntPrice] = useState(""); // "yes" | "no" | ""
  const [fTag,      setFTag]      = useState("");
  const [allTags,   setAllTags]   = useState<{ id: string; key: string; name: string }[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [metaRes, pricingRes, productsRes, overridesRes, tagsRes] = await Promise.all([
        fetch("/api/admin/catalog/pricing/meta",     { cache: "no-store" }),
        fetch("/api/admin/catalog/pricing",           { cache: "no-store" }),
        fetch("/api/admin/catalog/products",          { cache: "no-store" }),
        fetch("/api/admin/catalog/pricing/overrides", { cache: "no-store" }),
        fetch("/api/admin/catalog/tags",             { cache: "no-store" }),
      ]);
      const mJ  = await metaRes.json().catch(() => null);
      const prJ = await pricingRes.json().catch(() => null);
      const pJ  = await productsRes.json().catch(() => null);
      const oJ  = await overridesRes.json().catch(() => null);
      const tJ  = await tagsRes.json().catch(() => null);
      if (tJ?.ok) setAllTags(tJ.data ?? []);

      if (mJ?.ok)  { setMarkets(mJ.data.markets ?? []); setGroups(mJ.data.groups ?? []); }
      if (pJ?.ok)  setProducts((pJ.data ?? []).filter((p: Product) => p.isActive));
      if (prJ?.ok) setPricing(prJ.data ?? []);
      if (oJ?.ok)  setOverrides(oJ.data ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function savePricing(
    productId: string,
    marketId:  string,
    saves:   { groupId: string; period: BillingPeriod; cents: number }[],
    deletes: { groupId: string; period: BillingPeriod; existingId: string }[],
  ) {
    // Group saves by groupId for bulk upsert
    const byGroup: Record<string, { period: BillingPeriod; cents: number }[]> = {};
    saves.forEach(({ groupId, period, cents }) => {
      if (!byGroup[groupId]) byGroup[groupId] = [];
      byGroup[groupId].push({ period, cents });
    });

    for (const [groupId, entries] of Object.entries(byGroup)) {
      const res  = await fetch("/api/admin/catalog/pricing/upsert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, marketId, customerGroupId: groupId, entries }),
      });
      const json = await res.json().catch(() => null) as { ok: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) { alert(json?.error ?? "Save failed"); return; }
    }

    // Delete blanked rows
    for (const { existingId } of deletes) {
      await fetch("/api/admin/catalog/pricing/delete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: existingId }),
      });
    }

    await load();
  }

  async function saveOverride(productId: string, marketId: string, userId: string, billingPeriod: BillingPeriod, priceCents: number) {
    const res  = await fetch("/api/admin/catalog/pricing/overrides/upsert", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, marketId, userId, billingPeriod, priceCents }),
    });
    const json = await res.json().catch(() => null) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) { alert(json?.error ?? "Save failed"); return; }
    await load();
  }

  async function deleteOverride(id: string) {
    const res  = await fetch("/api/admin/catalog/pricing/overrides/delete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => null) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) { alert(json?.error ?? "Delete failed"); return; }
    await load();
  }

  const categories = Array.from(new Set(products.map((p) => p.category?.name).filter(Boolean))) as string[];
  const types: ProductType[] = ["plan", "addon", "service", "product"];

  const filtered = products.filter((p) => {
    if (fKey      && !p.key.toLowerCase().includes(fKey.toLowerCase()))   return false;
    if (fName     && !p.name.toLowerCase().includes(fName.toLowerCase())) return false;
    if (fCategory && p.category?.name !== fCategory)                      return false;
    if (fType     && p.type !== fType)                                    return false;
    if (fEntPrice) {
      const hasEnt = overrides.some((o) => o.productId === p.id);
      if (fEntPrice === "yes" && !hasEnt) return false;
      if (fEntPrice === "no"  &&  hasEnt) return false;
    }
    if (fTag && !p.tags?.some((t) => t.id === fTag)) return false;
    return true;
  });

  const pricesSetCount = (productId: string, marketId?: string) => {
    const groupCount    = pricing.filter((r) => r.productId === productId && r.isActive && (!marketId || r.marketId === marketId)).length;
    const overrideCount = overrides.filter((o) => o.productId === productId && (!marketId || o.marketId === marketId)).length;
    return groupCount + overrideCount;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-sm text-gray-400">Loading pricing data…</div>;
  }

  return (
    <div className="space-y-4">

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
        <input
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300"
          placeholder="Search Product ID…" style={{ width: 160 }}
          value={fKey} onChange={(e) => setFKey(e.target.value)}
        />
        <input
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300"
          placeholder="Search Product Name…" style={{ width: 200 }}
          value={fName} onChange={(e) => setFName(e.target.value)}
        />
        <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" value={fCategory} onChange={(e) => setFCategory(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="">All Types</option>
          {types.map((t) => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" value={fEntPrice} onChange={(e) => setFEntPrice(e.target.value)}>
          <option value="">Enterprise Price: All</option>
          <option value="yes">Enterprise Price: Yes</option>
          <option value="no">Enterprise Price: No</option>
        </select>
        <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" value={fTag} onChange={(e) => setFTag(e.target.value)}>
          <option value="">All Tags</option>
          {allTags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {(fKey || fName || fCategory || fType || fEntPrice || fTag) && (
          <button onClick={() => { setFKey(""); setFName(""); setFCategory(""); setFType(""); setFEntPrice(""); setFTag(""); }} className="text-xs text-gray-400 underline hover:text-gray-600">Clear</button>
        )}
        <span className="ml-auto text-xs text-gray-400">{filtered.length} product{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div
          className="grid border-b bg-gray-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400"
          style={{ gridTemplateColumns: "120px 1fr 150px 100px 120px 130px 32px" }}
        >
          <div>Product ID</div>
          <div>Product Name</div>
          <div>Category</div>
          <div>Type</div>
          <div>Tags</div>
          <div>Prices Set</div>
          <div />
        </div>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">No products match the filters.</div>
        ) : (
          filtered.map((product) => {
            const isOpen = expandedId === product.id;
            const count  = pricesSetCount(product.id);

            return (
              <div key={product.id} className="border-b last:border-b-0">
                <div
                  className={`grid cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50/80 ${isOpen ? "bg-gray-50/80" : ""}`}
                  style={{ gridTemplateColumns: "120px 1fr 150px 100px 120px 130px 32px" }}
                  onClick={() => setExpandedId(isOpen ? null : product.id)}
                >
                  <div className="font-mono text-xs text-gray-400">{product.key}</div>
                  <div className="space-y-0.5">
                    <div className="truncate text-sm font-semibold text-gray-900">{product.name}</div>
                    {/* Addon pricing type + applicable tags shown under product name */}
                    {product.type === "addon" && (
                      <div className="flex flex-wrap items-center gap-1">
                        {product.addonPricingType && (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            product.addonPricingType === "per_unit"   ? "border-orange-200 bg-orange-50 text-orange-600" :
                            product.addonPricingType === "percentage" ? "border-violet-200 bg-violet-50 text-violet-600" :
                                                                        "border-blue-200 bg-blue-50 text-blue-600"
                          }`}>
                            {product.addonPricingType === "per_unit"   ? `📦 Per ${product.addonUnitLabel || "unit"}` :
                             product.addonPricingType === "percentage" ? `% ${product.addonPercentage ?? ""}% of parent` :
                                                                         "💰 Fixed"}
                          </span>
                        )}
                        {(product.applicableTags ?? []).length > 0 && (
                          <>
                            <span className="text-[10px] text-gray-300">for</span>
                            {(product.applicableTags ?? []).map((tagKey) => (
                              <span key={tagKey} className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                                {tagKey}
                              </span>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                    {/* Metered plan badge */}
                    {product.type !== "addon" && (product.tags ?? []).some((t: { key: string }) => t.key === "metered") && (
                      <span className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                        📊 metered · per {product.unitLabel || "unit"}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm text-gray-500">{product.category?.name ?? <span className="text-gray-300">—</span>}</div>
                  <div><TypeBadge type={product.type} /></div>
                  <div className="flex flex-wrap gap-1">
                    {product.type === "addon"
                      ? (product.applicableTags ?? []).length === 0
                        ? <span className="text-amber-400 text-[10px]">⚠ none</span>
                        : (product.applicableTags ?? []).map((key) => {
                            const tag = allTags.find((t) => t.key === key);
                            return (
                              <span key={key} className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                                {tag?.name ?? key}
                              </span>
                            );
                          })
                      : (product.tags ?? []).length === 0
                        ? <span className="text-gray-300 text-xs">—</span>
                        : (product.tags ?? []).map((t) => (
                            <span key={t.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{t.name}</span>
                          ))
                    }
                  </div>
                  <div>
                    {count > 0
                      ? <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">★ {count} set</span>
                      : <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] text-gray-400">No prices</span>
                    }
                  </div>
                  <div className={`text-center text-[10px] text-gray-300 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>▲</div>
                </div>

                {isOpen && (
                  <ProductPricingPanel
                    product={product}
                    markets={markets}
                    groups={groups}
                    allPricing={pricing}
                    allOverrides={overrides}
                    allTags={allTags}
                    onSave={savePricing}
                    onSaveOverride={saveOverride}
                    onDeleteOverride={deleteOverride}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}