"use client";
// app/admin/catalog/pricing/PricingAdmin.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  PageShell, Card, Table, TR, TD, TypeBadge, StatusBadge, TagPill,
  Btn, Input, Select, Field, Alert, Empty, FiltersBar, CLR,
} from "@/components/ui/admin-ui";

type BillingPeriod = "MONTHLY" | "SIX_MONTHS" | "YEARLY" | "ONE_TIME";
type Tag     = { id: string; key: string; name: string };
type Market  = { id: string; key: string; name: string; defaultCurrency: string };
type CGroup  = { id: string; key: string; name: string };
type PricingRow = {
  id: string; priceCents: number; billingPeriod: BillingPeriod;
  isActive: boolean; market: Market; customerGroup: CGroup | null;
  marketId: string; customerGroupId: string | null;
};
type ProductRow = {
  id: string; key: string; name: string; type: string;
  category: { id: string; name: string; key: string } | null;
  tags: Tag[]; unitLabel: string | null;
  pricing: PricingRow[];
  overrideCount?: number;
};
type OverrideRow = {
  id: string; priceCents: number; billingPeriod: BillingPeriod;
  market: Market; marketId: string; user: { id: string; email: string };
};
type EntUser = { id: string; email: string; name?: string };
type PricingApiResp = { ok: true; data: ProductRow[]; markets: Market[]; customerGroups: CGroup[] } | { ok: false; error: string };

const BP_LABELS: Record<BillingPeriod, string> = {
  MONTHLY: "Monthly", SIX_MONTHS: "6 Months", YEARLY: "Yearly", ONE_TIME: "One-Time",
};
const BPS = Object.keys(BP_LABELS) as BillingPeriod[];

function fmtPrice(cents: number | null | undefined, currency: string) {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}
function fmtDisplay(cents: number | null | undefined, currency: string) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(cents / 100);
}

export default function PricingAdmin() {
  const [resp, setResp]       = useState<PricingApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [fSearch, setFSearch] = useState("");
  const [fCat, setFCat]       = useState("");
  const [fType, setFType]     = useState("");
  const [fTag, setFTag]       = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [pricingR, productsR, marketsR, cgroupsR, overridesR] = await Promise.all([
        fetch("/api/admin/catalog/pricing").then(r => r.json()).catch(() => null),
        fetch("/api/admin/catalog/products").then(r => r.json()).catch(() => null),
        fetch("/api/admin/catalog/markets").then(r => r.json()).catch(() => null),
        fetch("/api/admin/catalog/customer-groups").then(r => r.json()).catch(() => null),
        fetch("/api/admin/catalog/pricing/overrides").then(r => r.json()).catch(() => null),
      ]);
      if (!productsR?.ok) { setError("Failed to load products"); return; }

      const marketsData = marketsR?.data ?? pricingR?.markets ?? [];
      const cgroupsData = cgroupsR?.data ?? pricingR?.customerGroups ?? [];
      const marketById  = new Map(marketsData.map((m: any) => [m.id, m]));
      const cgroupById  = new Map(cgroupsData.map((g: any) => [g.id, g]));

      const pricingByProduct = new Map<string, any[]>();
      for (const row of (pricingR?.data ?? [])) {
        const pid = row.productId ?? row.product?.id;
        if (!pid) continue;
        if (!pricingByProduct.has(pid)) pricingByProduct.set(pid, []);
        pricingByProduct.get(pid)!.push({
          ...row,
          market: row.market ?? marketById.get(row.marketId) ?? null,
          customerGroup: row.customerGroup ?? cgroupById.get(row.customerGroupId) ?? null,
        });
      }
      // Count active enterprise overrides per product
      const overrideCountByProduct = new Map<string, number>();
      for (const row of (overridesR?.data ?? [])) {
        const pid = row.productId;
        if (!pid) continue;
        overrideCountByProduct.set(pid, (overrideCountByProduct.get(pid) ?? 0) + 1);
      }
      const productsWithPricing = (productsR.data ?? []).map((p: any) => ({
        ...p,
        pricing: pricingByProduct.get(p.id) ?? [],
        overrideCount: overrideCountByProduct.get(p.id) ?? 0,
      }));
      setResp({ ok: true, data: productsWithPricing, markets: marketsData, customerGroups: cgroupsData });
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const products   = (resp as any)?.data ?? [];
  const markets    = (resp as any)?.markets ?? [];
  const cgroups    = (resp as any)?.customerGroups ?? [];

  const allTags = useMemo<Tag[]>(() => {
    const m = new Map<string, Tag>();
    for (const p of products) for (const t of (p.tags ?? [])) m.set(t.id, t);
    return [...m.values()];
  }, [products]);
  const categories = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of products) if (p.category) m.set(p.category.id, p.category.name);
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [products]);

  const filtered = products.filter((p: ProductRow) => {
    if (p.type === "addon") return false; // addons excluded per spec
    if (fType   && p.type !== fType) return false;
    if (fCat    && p.category?.id !== fCat) return false;
    if (fTag    && !(p.tags ?? []).find((t: Tag) => t.id === fTag)) return false;
    if (fSearch) {
      const q = fSearch.toLowerCase();
      if (!p.key.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function priceCount(p: ProductRow) {
    const pricingActive = (p.pricing ?? []).filter(r => r.isActive).length;
    return pricingActive + (p.overrideCount ?? 0);
  }

  async function upsertPrice(productId: string, marketId: string, cgroupId: string | null, bp: BillingPeriod, cents: number) {
    await fetch("/api/admin/catalog/pricing/upsert", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, marketId, customerGroupId: cgroupId, billingPeriod: bp, priceCents: cents }),
    });
    // NOTE: caller (saveAll) is responsible for triggering load() after all saves
  }

  async function deletePrice(id: string) {
    await fetch("/api/admin/catalog/pricing/delete", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    await load();
  }

  const clearFilters = () => { setFSearch(""); setFCat(""); setFType(""); setFTag(""); };
  const hasFilters   = fSearch || fCat || fType || fTag;

  return (
    <PageShell breadcrumb="ADMIN / CATALOG / PRICING" title="Pricing">
      {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

      <Card>
        <FiltersBar>
          <input className="cy-input" value={fSearch} onChange={e => setFSearch(e.target.value)}
            placeholder="Search key or name…" style={{ width: 220 }} />
          <select className="cy-input" value={fType} onChange={e => setFType(e.target.value)} style={{ width: 130 }}>
            <option value="">All Types</option>
            {["plan","service","product"].map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
            ))}
          </select>
          <select className="cy-input" value={fCat} onChange={e => setFCat(e.target.value)} style={{ width: 160 }}>
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
        ) : filtered.length === 0 ? (
          <Empty />
        ) : (
          <Table cols={["Key", "Product", "Type", "Tags", "Prices Set", ""]}>
            {filtered.map((p: ProductRow) => {
              const isOpen = expandedId === p.id;
              const count  = priceCount(p);
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
                      }}>{count} active</span>
                    </TD>
                    <TD right>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{isOpen ? "▲" : "▼"}</span>
                    </TD>
                  </TR>

                  {isOpen && (
                    <tr>
                      <td colSpan={6} style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", padding: "20px" }}>
                        <PricingGrid
                          product={p}
                          markets={markets}
                          cgroups={cgroups}
                          onUpsert={upsertPrice}
                          onDelete={deletePrice}
                          onReload={load}
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

// ── Pricing Grid ──────────────────────────────────────────────────────────────
// Shows market tabs, group columns (Standard / Business / Professional / Enterprise)
// and billing period rows with editable price cells.

type CellState = { value: string; saving: boolean; saved: boolean };

// ── Currency symbol helper ────────────────────────────────────────────────────
function currencySymbol(currency: string): string {
  try {
    return (0).toLocaleString("en", { style: "currency", currency, minimumFractionDigits: 0 })
      .replace(/[\d,. ]/g, "").trim() || currency;
  } catch { return currency; }
}

// ── Pricing Grid ──────────────────────────────────────────────────────────────
function PricingGrid({ product, markets, cgroups, onUpsert, onDelete, onReload }: {
  product: ProductRow;
  markets: Market[];
  cgroups: CGroup[];
  onUpsert: (pid: string, mid: string, cgid: string | null, bp: BillingPeriod, cents: number) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onReload: () => Promise<void>;
}) {
  const [activeMarketId, setActiveMarketId] = useState<string>(markets[0]?.id ?? "");
  // edits: key = `${marketId}__${cgroupId ?? "all"}__${bp}` → value string
  const [edits, setEdits]   = useState<Record<string, string>>({});
  const [offsets, setOffsets] = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [saveOk, setSaveOk]   = useState(false);

  // Enterprise
  const [entOverrides, setEntOverrides]     = useState<OverrideRow[]>([]);
  const [entAllUsers, setEntAllUsers]       = useState<EntUser[]>([]);  // all enterprise customers
  const [entLoading, setEntLoading]         = useState(false);
  const [entLoaded, setEntLoaded]           = useState(false);
  const [entSelectedUserId, setEntSelectedUserId] = useState<string>("");  // viewing/editing existing
  const [entNewUserId, setEntNewUserId]     = useState<string>("");         // adding new
  const [entEdits, setEntEdits]             = useState<Record<string, string>>({});  // bp → value for selected user
  const [entSaving, setEntSaving]           = useState(false);

  const market   = markets.find(m => m.id === activeMarketId);
  const currency = market?.defaultCurrency ?? "";
  const symbol   = currency ? currencySymbol(currency) : "$";

  const stdGroup  = cgroups.find(g => g.key === "standard") ?? cgroups[0] ?? null;
  const bizGroups = cgroups.filter(g => g.key !== "standard" && g.key !== "enterprise" && g.key !== "default");
  const entGroup  = cgroups.find(g => g.key === "enterprise");

  function ck(cgroupId: string | null, bp: BillingPeriod) {
    return `${activeMarketId}__${cgroupId ?? "all"}__${bp}`;
  }

  function getRow(cgroupId: string | null, bp: BillingPeriod): PricingRow | undefined {
    return (product.pricing ?? []).find(r =>
      r.marketId === activeMarketId &&
      (cgroupId === null
        ? (r.customerGroupId === null || r.customerGroupId === "")
        : r.customerGroupId === cgroupId) &&
      r.billingPeriod === bp
    );
  }

  // Get display value for a cell: edit draft → saved DB value → ""
  function cellVal(cgroupId: string | null, bp: BillingPeriod): string {
    const key = ck(cgroupId, bp);
    if (edits[key] !== undefined) return edits[key];
    const row = getRow(cgroupId, bp);
    return row ? (row.priceCents / 100).toFixed(2) : "";
  }

  function setCell(cgroupId: string | null, bp: BillingPeriod, v: string) {
    setEdits(prev => ({ ...prev, [ck(cgroupId, bp)]: v }));
  }

  function applyOffset(cgroupId: string, offsetStr: string) {
    setOffsets(prev => ({ ...prev, [cgroupId]: offsetStr }));
    const off = parseFloat(offsetStr) || 0;
    const newEdits: Record<string, string> = { ...edits };
    BPS.forEach(bp => {
      const stdVal = parseFloat(cellVal(stdGroup?.id ?? null, bp)) || 0;
      if (!stdVal) return;
      newEdits[ck(cgroupId, bp)] = (stdVal * (1 + off / 100)).toFixed(2);
    });
    setEdits(newEdits);
  }

  // Check if there are unsaved changes vs DB
  const hasChanges = Object.entries(edits).some(([key, val]) => {
    const [mid, cgidRaw, bp] = key.split("__");
    if (mid !== activeMarketId) return false;
    const cgid = cgidRaw === "all" ? null : cgidRaw;
    const row = getRow(cgid, bp as BillingPeriod);
    const dbVal = row ? (row.priceCents / 100).toFixed(2) : "";
    return val !== dbVal && val !== "";
  });

  function discard() {
    // Remove edits for current market
    setEdits(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.startsWith(activeMarketId + "__")) delete next[k]; });
      return next;
    });
    setOffsets({});
  }

  async function saveAll() {
    setSaving(true); setSaveOk(false);
    const tasks: Promise<void>[] = [];
    Object.entries(edits).forEach(([key, val]) => {
      if (!val) return;
      const [mid, cgidRaw, bp] = key.split("__");
      if (mid !== activeMarketId) return;
      const cgid  = cgidRaw === "all" ? null : cgidRaw;
      const cents = Math.round(parseFloat(val) * 100);
      if (isNaN(cents) || cents < 0) return;
      const row = getRow(cgid, bp as BillingPeriod);
      if (row && row.priceCents === cents) return; // unchanged
      tasks.push(onUpsert(product.id, mid, cgid, bp as BillingPeriod, cents));
    });
    if (tasks.length === 0) { setSaving(false); return; }
    await Promise.all(tasks);
    await onReload(); // single reload after all saves
    setSaving(false); setSaveOk(true);
    setEdits({}); setOffsets({});
    setTimeout(() => setSaveOk(false), 2000);
  }

  async function loadEntOverrides() {
    setEntLoading(true);
    try {
      const [overR, usersR] = await Promise.all([
        fetch(`/api/admin/catalog/pricing/overrides?productId=${product.id}`).then(r => r.json()).catch(() => null),
        fetch(`/api/admin/customer?group=enterprise`).then(r => r.json()).catch(() => null),
      ]);

      // DEBUG — remove once confirmed working
      console.log("[EntLoad] overrides response:", JSON.stringify(overR));
      console.log("[EntLoad] users response:", JSON.stringify(usersR));

      if (overR?.ok) setEntOverrides(overR.data ?? []);
      if (usersR?.ok) {
        const users: any[] = usersR.data ?? [];
        setEntAllUsers(users.map((u: any) => ({
          id: u.id,
          email: u.email,
          name: u.fullName ?? u.email,
        })));
      }
      setEntLoaded(true);
    } finally { setEntLoading(false); }
  }

  // enterprise ck helper — keyed by userId + marketId + bp to avoid cross-user/product pollution
  function entCk(userId: string, bp: BillingPeriod) { return `${userId}__${activeMarketId}__${bp}`; }

  function entCellVal(userId: string, bp: BillingPeriod): string {
    const key = entCk(userId, bp);
    if (entEdits[key] !== undefined) return entEdits[key];
    const row = entOverrides.find(o => o.user?.id === userId && o.marketId === activeMarketId && o.billingPeriod === bp);
    return row ? (row.priceCents / 100).toFixed(2) : "";
  }

  function entSetCell(userId: string, bp: BillingPeriod, v: string) {
    setEntEdits(prev => ({ ...prev, [entCk(userId, bp)]: v }));
  }

  function entGetRow(userId: string, bp: BillingPeriod): OverrideRow | undefined {
    return entOverrides.find(o => o.user?.id === userId && o.marketId === activeMarketId && o.billingPeriod === bp);
  }

  async function saveEntPrices(userId: string) {
    setEntSaving(true);
    const tasks: Promise<void>[] = [];
    BPS.forEach(bp => {
      const key = entCk(userId, bp);
      if (!(key in entEdits)) return; // not touched
      const val = entEdits[key];
      const existing = entGetRow(userId, bp);

      if (!val || val === "") {
        // Cleared — delete existing row if any
        if (existing) {
          tasks.push(
            fetch("/api/admin/catalog/pricing/overrides/delete", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: existing.id }),
            }).then(() => {})
          );
        }
        return;
      }
      const cents = Math.round(parseFloat(val) * 100);
      if (isNaN(cents) || cents < 0) return;
      if (existing && existing.priceCents === cents) return;
      tasks.push(
        fetch("/api/admin/catalog/pricing/overrides/upsert", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: product.id, marketId: activeMarketId, userId, billingPeriod: bp, priceCents: cents }),
        }).then(() => {})
      );
    });
    await Promise.all(tasks);
    await Promise.all([loadEntOverrides(), onReload()]);
    // Clear only this user's edits
    setEntEdits(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (k.startsWith(userId + "__")) delete next[k]; });
      return next;
    });
    setEntNewUserId("");
    setEntSelectedUserId("");
    setEntSaving(false);
  }

  async function deleteEntRow(id: string) {
    await fetch("/api/admin/catalog/pricing/overrides/delete", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    await Promise.all([loadEntOverrides(), onReload()]);
  }

  if (!market) return <div style={{ color: "#9ca3af", fontSize: 13 }}>No markets configured.</div>;

  const numCols = 1 + bizGroups.length + (entGroup ? 1 : 0);

  return (
    <div>
      {/* Market tabs */}
      {markets.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          {markets.map(m => (
            <button key={m.id} type="button"
              onClick={() => { setActiveMarketId(m.id); setEdits({}); setOffsets({}); }}
              style={{
                padding: "5px 14px", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: 500,
                background: m.id === activeMarketId ? "#222" : "#fff",
                color: m.id === activeMarketId ? "#fff" : "#374151",
                border: `1px solid ${m.id === activeMarketId ? "#222" : "#d1d5db"}`,
              }}>
              {m.name} · {m.defaultCurrency}
            </button>
          ))}
        </div>
      )}

      {/* Columns — equal quarters with gap */}
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${1 + bizGroups.length + (entGroup ? 1 : 0)}, 1fr)`,
        gap: 12,
      }}>
        {/* Standard */}
        <GroupColumn
          label="Standard" badge="Base price" badgeVariant="green"
          symbol={symbol}
          getCellValue={(bp) => cellVal(stdGroup?.id ?? null, bp)}
          setCell={(bp, v) => setCell(stdGroup?.id ?? null, bp, v)}
          getRow={(bp) => getRow(stdGroup?.id ?? null, bp)}
          onDelete={onDelete}
          isLast={numCols === 1}
        />

        {/* Biz groups */}
        {bizGroups.map((g, i) => (
          <GroupColumn
            key={g.id}
            label={g.name} badgeVariant="amber"
            offsetValue={offsets[g.id] ?? ""}
            onOffsetChange={v => applyOffset(g.id, v)}
            symbol={symbol}
            getCellValue={(bp) => cellVal(g.id, bp)}
            setCell={(bp, v) => setCell(g.id, bp, v)}
            getRow={(bp) => getRow(g.id, bp)}
            onDelete={onDelete}
            isLast={i === bizGroups.length - 1 && !entGroup}
          />
        ))}

        {/* Enterprise */}
        {entGroup && (() => {
          // Users who already have overrides for this market
          const usersWithOverrides = Array.from(
            new Map(
              entOverrides
                .filter(o => o.marketId === activeMarketId)
                .map(o => [o.user?.id, o.user])
            ).values()
          ).filter(Boolean) as EntUser[];

          // Users with NO overrides for this specific product + market
          const withIds = new Set(
            entOverrides
              .filter(o => o.marketId === activeMarketId)
              .map(o => o.user?.id)
              .filter(Boolean)
          );
          const usersWithout = entAllUsers.filter(u => !withIds.has(u.id));

          const activeUserId = entSelectedUserId || entNewUserId;
          const hasEntChanges = activeUserId && BPS.some(bp => {
            const key = entCk(activeUserId, bp);
            if (!entEdits[key]) return false;
            const row = entGetRow(activeUserId, bp);
            const dbVal = row ? (row.priceCents / 100).toFixed(2) : "";
            return entEdits[key] !== dbVal;
          });

          return (
            <div style={{ border: "1px solid #e9d5ff", background: "#fff" }}>
              {/* Header */}
              <div style={{ padding: "9px 14px", background: "#faf5ff", borderBottom: "1px solid #e9d5ff", minHeight: 42, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: "#7c3aed" }}>Enterprise</span>
                {!entLoaded && (
                  <button type="button" onClick={loadEntOverrides}
                    style={{ fontSize: 11, color: "#7c3aed", background: "none", border: "1px solid #c4b5fd", cursor: "pointer", padding: "2px 8px", fontFamily: "inherit" }}>
                    {entLoading ? "Loading…" : "Load"}
                  </button>
                )}
              </div>

              {!entLoaded ? (
                <div style={{ padding: "20px 14px", textAlign: "center", color: "#c4b5fd", fontSize: 12 }}>
                  Click Load to manage per-customer prices
                </div>
              ) : (
                <>
                  {/* Dropdown 1: existing overrides */}
                  <div style={{ padding: "10px 12px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>
                      View / Edit existing
                    </div>
                    <select
                      className="cy-input"
                      value={entSelectedUserId}
                      onChange={e => { setEntSelectedUserId(e.target.value); setEntNewUserId(""); setEntEdits({}); }}
                      style={{ width: "100%", marginBottom: 10, fontSize: 12 }}
                    >
                      <option value="">— select customer —</option>
                      {usersWithOverrides.map(u => (
                        <option key={u.id} value={u.id}>{u.email}</option>
                      ))}
                    </select>
                  </div>

                  {/* Dropdown 2: add new */}
                  <div style={{ padding: "10px 12px 0", borderBottom: "1px solid #e9d5ff" }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", marginBottom: 4 }}>
                      Add new override
                    </div>
                    <select
                      className="cy-input"
                      value={entNewUserId}
                      onChange={e => { setEntNewUserId(e.target.value); setEntSelectedUserId(""); setEntEdits({}); }}
                      style={{ width: "100%", marginBottom: 10, fontSize: 12 }}
                    >
                      <option value="">— select customer —</option>
                      {usersWithout.map(u => (
                        <option key={u.id} value={u.id}>{u.email}</option>
                      ))}
                    </select>
                  </div>

                  {/* Price rows — same layout as other columns */}
                  {BPS.map(bp => {
                    const row = activeUserId ? entGetRow(activeUserId, bp) : undefined;
                    const val = activeUserId ? entCellVal(activeUserId, bp) : "";
                    const dbVal = row ? (row.priceCents / 100).toFixed(2) : "";
                    const isDirty = activeUserId && entEdits[entCk(activeUserId, bp)] !== undefined && val !== dbVal && val !== "";

                    return (
                      <div key={bp} style={{
                        display: "flex", alignItems: "center", gap: 0,
                        padding: "0 10px", height: 46,
                        borderBottom: "1px solid #f3f4f6",
                        background: isDirty ? "#fffef0" : "#fff",
                        opacity: activeUserId ? 1 : 0.4,
                      }}>
                        <span style={{ fontSize: 11, color: "#9ca3af", width: 66, flexShrink: 0 }}>{BP_LABELS[bp]}</span>
                        <div style={{
                          display: "flex", alignItems: "center", flex: 1,
                          border: `1px solid ${isDirty ? "#fbbf24" : val ? "#c4b5fd" : "#e5e7eb"}`,
                          background: "#fff", height: 32,
                        }}>
                          <span style={{
                            padding: "0 7px", color: "#9ca3af", fontSize: 12,
                            borderRight: "1px solid #e5e7eb", height: "100%",
                            display: "flex", alignItems: "center", background: "#faf5ff",
                            userSelect: "none",
                          }}>{symbol}</span>
                          <input
                            type="number"
                            value={val}
                            disabled={!activeUserId}
                            onChange={e => activeUserId && entSetCell(activeUserId, bp, e.target.value)}
                            placeholder="—"
                            style={{
                              flex: 1, height: "100%", border: "none", outline: "none",
                              fontSize: 13, fontFamily: "monospace", padding: "0 8px",
                              background: "transparent", color: val ? "#111827" : "#9ca3af",
                              minWidth: 0,
                            }}
                          />
                        </div>
                        <button type="button"
                          onClick={() => {
                            if (!activeUserId) return;
                            // Just clear the edit — actual delete happens on Save
                            entSetCell(activeUserId, bp, "");
                          }}
                          title="Clear price"
                          style={{
                            border: "none", background: "none",
                            cursor: (row || val) ? "pointer" : "default",
                            color: (row || val) ? "#f87171" : "transparent",
                            padding: "0 0 0 6px", fontSize: 16, lineHeight: 1, flexShrink: 0,
                          }}>×</button>
                      </div>
                    );
                  })}

                  {/* Save bar for enterprise */}
                  {activeUserId && (
                    <div style={{ padding: "8px 12px", display: "flex", gap: 6, borderTop: "1px solid #e9d5ff", background: "#faf5ff" }}>
                      <button type="button"
                        onClick={() => {
                          setEntEdits(prev => {
                            const next = { ...prev };
                            Object.keys(next).forEach(k => { if (k.startsWith(activeUserId + "__")) delete next[k]; });
                            return next;
                          });
                          setEntSelectedUserId(""); setEntNewUserId("");
                        }}
                        style={{ flex: 1, padding: "5px 0", fontSize: 12, fontFamily: "inherit", background: "#fff", border: "1px solid #d1d5db", cursor: "pointer", color: "#374151" }}>
                        Cancel
                      </button>
                      <button type="button"
                        onClick={() => saveEntPrices(activeUserId)}
                        disabled={entSaving || !hasEntChanges}
                        style={{
                          flex: 1, padding: "5px 0", fontSize: 12, fontFamily: "inherit", fontWeight: 600,
                          background: hasEntChanges ? "#7c3aed" : "#d1d5db",
                          color: "#fff", border: "none", cursor: hasEntChanges ? "pointer" : "not-allowed",
                        }}>
                        {entSaving ? "Saving…" : "Save"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* Save / Discard bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8,
        marginTop: 12, padding: "10px 14px",
        background: hasChanges ? "#fffbeb" : "#f9fafb",
        border: `1px solid ${hasChanges ? "#fde68a" : "#e5e7eb"}`,
        transition: "all .2s",
      }}>
        {saveOk && <span style={{ fontSize: 12, color: "#15803d", marginRight: "auto" }}>✓ Prices saved successfully</span>}
        {hasChanges && !saveOk && <span style={{ fontSize: 12, color: "#92400e", marginRight: "auto" }}>You have unsaved changes</span>}
        <button type="button" onClick={discard} disabled={!hasChanges || saving}
          style={{
            padding: "6px 16px", fontSize: 13, cursor: hasChanges ? "pointer" : "not-allowed",
            fontFamily: "inherit", fontWeight: 500, background: "#fff",
            color: hasChanges ? "#374151" : "#9ca3af",
            border: `1px solid ${hasChanges ? "#d1d5db" : "#e5e7eb"}`,
            opacity: hasChanges ? 1 : 0.5,
          }}>
          Discard
        </button>
        <button type="button" onClick={saveAll} disabled={!hasChanges || saving}
          style={{
            padding: "6px 18px", fontSize: 13, cursor: hasChanges ? "pointer" : "not-allowed",
            fontFamily: "inherit", fontWeight: 600,
            background: hasChanges ? CLR.primary : "#d1d5db",
            color: "#fff", border: "none",
            opacity: hasChanges ? 1 : 0.6,
          }}>
          {saving ? "Saving…" : "Save Prices"}
        </button>
      </div>
    </div>
  );
}

// ── Group Column ──────────────────────────────────────────────────────────────
function GroupColumn({ label, badge, badgeVariant, offsetValue, onOffsetChange, symbol, getCellValue, setCell, getRow, onDelete, isLast }: {
  label: string;
  badge?: string;
  badgeVariant?: "green" | "amber";
  offsetValue?: string;
  onOffsetChange?: (v: string) => void;
  symbol: string;
  getCellValue: (bp: BillingPeriod) => string;
  setCell: (bp: BillingPeriod, v: string) => void;
  getRow: (bp: BillingPeriod) => PricingRow | undefined;
  onDelete: (id: string) => Promise<void>;
  isLast?: boolean;
}) {
  const isOffset = onOffsetChange !== undefined;
  const headerBg     = badgeVariant === "green" ? CLR.primaryBg : badgeVariant === "amber" ? "#fffbeb" : "#f9fafb";
  const headerBorder = badgeVariant === "green" ? "#a7d9d1"     : badgeVariant === "amber" ? "#fde68a" : "#e5e7eb";
  const labelColor   = badgeVariant === "green" ? CLR.primary   : badgeVariant === "amber" ? "#b45309" : "#374151";

  return (
    <div style={{ border: `1px solid ${headerBorder}`, background: "#fff" }}>
      {/* Column header */}
      <div style={{
        background: headerBg, borderBottom: `1px solid ${headerBorder}`,
        padding: "9px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
        minHeight: 42,
      }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: labelColor }}>{label}</span>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: "2px 7px", letterSpacing: "0.04em",
            background: CLR.primary, color: "#fff",
          }}>{badge}</span>
        )}
        {isOffset && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 11, color: "#b45309", fontWeight: 600 }}>%</span>
            <input
              type="number"
              value={offsetValue}
              onChange={e => onOffsetChange!(e.target.value)}
              placeholder="0"
              style={{
                width: 56, height: 26, padding: "0 8px", fontSize: 12, fontFamily: "inherit",
                border: "1px solid #fde68a", background: "#fff", color: "#92400e",
                outline: "none", textAlign: "right",
              }}
            />
          </div>
        )}
      </div>

      {/* Billing period rows */}
      {BPS.map(bp => {
        const row = getRow(bp);
        const val = getCellValue(bp);
        const isDirty = (() => {
          const dbVal = row ? (row.priceCents / 100).toFixed(2) : "";
          return val !== dbVal && val !== "";
        })();

        return (
          <div key={bp} style={{
            display: "flex", alignItems: "center", gap: 0,
            padding: "0 10px", height: 46,
            borderBottom: "1px solid #f3f4f6",
            background: isDirty ? "#fffef0" : "#fff",
          }}>
            <span style={{ fontSize: 11, color: "#9ca3af", width: 66, flexShrink: 0 }}>
              {BP_LABELS[bp]}
            </span>
            <div style={{
              display: "flex", alignItems: "center", flex: 1,
              border: `1px solid ${isDirty ? "#fbbf24" : val ? "#d1d5db" : "#e5e7eb"}`,
              background: "#fff", height: 32,
            }}>
              <span style={{
                padding: "0 7px", color: "#9ca3af", fontSize: 12, borderRight: "1px solid #e5e7eb",
                height: "100%", display: "flex", alignItems: "center", background: "#f9fafb",
                userSelect: "none",
              }}>{symbol}</span>
              <input
                type="number"
                value={val}
                onChange={e => setCell(bp, e.target.value)}
                placeholder="—"
                style={{
                  flex: 1, height: "100%", border: "none", outline: "none",
                  fontSize: 13, fontFamily: "monospace", padding: "0 8px",
                  background: "transparent", color: val ? "#111827" : "#9ca3af",
                  minWidth: 0,
                }}
              />
            </div>
            <button type="button"
              onClick={() => row && onDelete(row.id)}
              title="Clear price"
              style={{
                border: "none", background: "none", cursor: row ? "pointer" : "default",
                color: row ? "#f87171" : "transparent",
                padding: "0 0 0 6px", fontSize: 16, lineHeight: 1, flexShrink: 0,
              }}>
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}