// app/admin/catalog/products/ProductsAdmin.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductType = "plan" | "addon" | "service" | "product";

const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: "plan",    label: "Plan" },
  { value: "addon",   label: "Addon" },
  { value: "service", label: "Service" },
  { value: "product", label: "Product" },
];

const TYPE_COLORS: Record<ProductType, string> = {
  plan:    "bg-blue-50 text-blue-700 border-blue-200",
  addon:   "bg-purple-50 text-purple-700 border-purple-200",
  service: "bg-amber-50 text-amber-700 border-amber-200",
  product: "bg-green-50 text-green-700 border-green-200",
};

type Category = { id: string; name: string; key: string };
type Tag      = { id: string; key: string; name: string };

type ProductRow = {
  id:         string;
  key:        string;
  name:       string;
  type:       ProductType;
  zohoPlanId: string | null;
  unitLabel:  string | null;
  isActive:   boolean;
  category:   { id: string; name: string } | null;
  tags:       Tag[];
};

type EditDraft = {
  key:        string;
  name:       string;
  type:       ProductType;
  categoryId: string;
  zohoPlanId: string;
  tagIds:     string[];
  unitLabel:  string;
};

type ProductsApiResponse   = { ok: true; data: ProductRow[] }   | { ok: false; error: string };
type CategoriesApiResponse = { ok: true; data: Array<{ id: string; key: string; name: string; isActive: boolean }> } | { ok: false; error: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: ProductType }) {
  const label = PRODUCT_TYPES.find((t) => t.value === type)?.label ?? type;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${TYPE_COLORS[type]}`}>
      {label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProductsAdmin() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rows, setRows]             = useState<ProductRow[]>([]);
  const [loading, setLoading]       = useState(false);

  // Filters
  const [filterType,     setFilterType]     = useState<ProductType | "all">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterTag,      setFilterTag]      = useState<string>("all");
  const [tags,           setTags]           = useState<Tag[]>([]);

  // Create form state
  const [key,        setKey]        = useState("");
  const [name,       setName]       = useState("");
  const [type,       setType]       = useState<ProductType>("plan");
  const [categoryId, setCategoryId] = useState("");
  const [zohoPlanId,    setZohoPlanId]    = useState("");
  const [selectedTags,  setSelectedTags]  = useState<string[]>([]);
  const [unitLabel,     setUnitLabel]     = useState("");

  // Inline edit state
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editDraft,   setEditDraft]   = useState<EditDraft | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // ── Load ────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    const [cRes, pRes, tRes] = await Promise.all([
      fetch("/api/admin/catalog/categories", { cache: "no-store" }),
      fetch("/api/admin/catalog/products",   { cache: "no-store" }),
      fetch("/api/admin/catalog/tags",       { cache: "no-store" }),
    ]);
    const cJson = await cRes.json().catch(() => null) as CategoriesApiResponse | null;
    const pJson = await pRes.json().catch(() => null) as ProductsApiResponse | null;
    const tJson = await tRes.json().catch(() => null) as { ok: boolean; data: Tag[] } | null;

    if (cRes.ok && cJson?.ok) {
      setCategories(cJson.data.filter((c) => c.isActive).map((c) => ({ id: c.id, key: c.key, name: c.name })));
    }
    if (pRes.ok && pJson?.ok) setRows(pJson.data);
    if (tRes.ok && tJson?.ok) setTags(tJson.data);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Create ───────────────────────────────────────────────────────────────────

  function resetForm() {
    setKey(""); setName(""); setType("plan"); setCategoryId(""); setZohoPlanId(""); setSelectedTags([]); setUnitLabel("");
  }

  // helper: is metered tag selected?
  function isMeteredSelected(tagIds: string[]) {
    return tags.some((t) => t.key === "metered" && tagIds.includes(t.id));
  }

  async function create() {
    if (!key.trim() || !name.trim()) return;
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/catalog/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: key.trim(), name: name.trim(), type,
          categoryId: categoryId || null,
          zohoPlanId: zohoPlanId.trim() || null,
          unitLabel: isMeteredSelected(selectedTags) ? unitLabel.trim() || null : null,
        }),
      });
      const json = await res.json().catch(() => null) as { ok: boolean; error?: string; data?: { id: string } } | null;
      if (!res.ok || !json?.ok) { alert(json?.error ?? "Create failed"); return; }
      // Save tags for newly created product
      if (json.data?.id) {
        await fetch("/api/admin/catalog/products/tags", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId: json.data.id, tagIds: selectedTags }),
        });
      }
      resetForm();
      await load();
    } finally {
      setLoading(false);
    }
  }

  // ── Inline edit ───────────────────────────────────────────────────────────────

  function startEdit(p: ProductRow) {
    setEditingId(p.id);
    setEditDraft({
      key:        p.key,
      name:       p.name,
      type:       p.type,
      categoryId: p.category?.id ?? "",
      zohoPlanId: p.zohoPlanId ?? "",
      tagIds:     p.tags?.map((t) => t.id) ?? [],
      unitLabel:  p.unitLabel ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(id: string) {
    if (!editDraft) return;
    if (!editDraft.key.trim() || !editDraft.name.trim()) return;
    setEditLoading(true);
    try {
      const res  = await fetch("/api/admin/catalog/products/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          key:        editDraft.key.trim(),
          name:       editDraft.name.trim(),
          type:       editDraft.type,
          categoryId: editDraft.categoryId || null,
          zohoPlanId: editDraft.zohoPlanId.trim() || null,
          unitLabel:  isMeteredSelected(editDraft.tagIds) ? editDraft.unitLabel.trim() || null : null,
        }),
      });
      const json = await res.json().catch(() => null) as { ok: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) { alert(json?.error ?? "Update failed"); return; }
      // Save tags
      await fetch("/api/admin/catalog/products/tags", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: id, tagIds: editDraft.tagIds }),
      });
      cancelEdit();
      await load();
    } finally {
      setEditLoading(false);
    }
  }

  // ── Toggle ───────────────────────────────────────────────────────────────────

  async function toggle(id: string, isActive: boolean) {
    const res  = await fetch("/api/admin/catalog/products/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive }),
    });
    const json = await res.json().catch(() => null) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) { alert(json?.error ?? "Update failed"); return; }
    await load();
  }

  // ── Filtered rows ─────────────────────────────────────────────────────────────

  const filtered = rows.filter((r) => {
    if (filterType !== "all" && r.type !== filterType) return false;
    if (filterCategory === "none" && r.category !== null) return false;
    if (filterCategory !== "all" && filterCategory !== "none" && r.category?.id !== filterCategory) return false;
    if (filterTag !== "all" && !r.tags?.some((t) => t.id === filterTag)) return false;
    return true;
  });

  const hasActiveFilters = filterType !== "all" || filterCategory !== "all" || filterTag !== "all";

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Create form ── */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Add New Product</h2>
        <div className="grid gap-3 md:grid-cols-2">

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Key <span className="text-gray-400">(unique slug)</span></label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" placeholder="e.g. vps-2cpu-4gb" value={key} onChange={(e) => setKey(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Name</label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" placeholder="e.g. VPS 2 CPU / 4 GB" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Type</label>
            <div className="flex gap-2">
              {PRODUCT_TYPES.map((t) => (
                <button key={t.value} type="button" onClick={() => setType(t.value)}
                  className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${type === t.value ? `${TYPE_COLORS[t.value]} border-current` : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Category</label>
            <select className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-gray-500">Zoho Plan ID <span className="text-gray-400">(optional — Phase 2)</span></label>
            <input className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" placeholder="zoho-plan-xxxx" value={zohoPlanId} onChange={(e) => setZohoPlanId(e.target.value)} />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-gray-500">Tags</label>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
                value=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (id && !selectedTags.includes(id)) setSelectedTags([...selectedTags, id]);
                }}
              >
                <option value="">{tags.length === 0 ? "No tags available" : "Add tag…"}</option>
                {tags.filter((t) => !selectedTags.includes(t.id)).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {selectedTags.map((id) => {
                const tag = tags.find((t) => t.id === id);
                if (!tag) return null;
                return (
                  <span key={id} className="inline-flex items-center gap-1 rounded-full bg-gray-800 px-2.5 py-1 text-xs font-medium text-white">
                    {tag.name}
                    <button type="button" onClick={() => setSelectedTags(selectedTags.filter((x) => x !== id))} className="ml-0.5 text-gray-300 hover:text-white">✕</button>
                  </span>
                );
              })}
            </div>
          </div>

          {/* ── Metered: unit label field ── */}
          {isMeteredSelected(selectedTags) && (
            <div className="space-y-1 md:col-span-2">
              <div className="flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
                <span>📊</span>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-teal-800">Metered Product — Unit Label Required</div>
                  <p className="text-[11px] text-teal-600 mt-0.5">Customers can purchase multiple units. Pricing grid will show price per unit. Mid-cycle upgrades are pro-rated automatically.</p>
                </div>
              </div>
              <label className="text-xs font-medium text-gray-500">
                Unit Label <span className="text-gray-400">(what one unit is called)</span>
              </label>
              <input
                className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="e.g. mailbox, GB, seat, account"
                value={unitLabel}
                onChange={(e) => setUnitLabel(e.target.value)}
              />
              {unitLabel && (
                <p className="text-[11px] text-gray-400">Pricing grid will show: <strong>$ — / {unitLabel}</strong></p>
              )}
            </div>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button onClick={() => void create()} disabled={loading || !key.trim() || !name.trim()}
            className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-40">
            {loading ? "Creating…" : "Create Product"}
          </button>
          <button type="button" onClick={resetForm} className="text-sm text-gray-400 hover:text-gray-600">Clear</button>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {([{ value: "all", label: "All Types" }, ...PRODUCT_TYPES] as { value: string; label: string }[]).map((t) => (
            <button key={t.value} onClick={() => setFilterType(t.value as ProductType | "all")}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${filterType === t.value ? "border-gray-800 bg-gray-800 text-white" : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"}`}>
              {t.label}
              <span className="ml-1.5 text-[10px] opacity-60">
                {t.value === "all" ? rows.length : rows.filter((r) => r.type === t.value).length}
              </span>
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-gray-200" />

        <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
          value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
          <option value="all">All Categories</option>
          <option value="none">— No category —</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-300"
          value={filterTag} onChange={(e) => setFilterTag(e.target.value)}>
          <option value="all">All Tags</option>
          {tags.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>

        {hasActiveFilters && (
          <>
            <span className="text-xs text-gray-400">{filtered.length} of {rows.length} shown</span>
            <button onClick={() => { setFilterType("all"); setFilterCategory("all"); setFilterTag("all"); }} className="text-xs text-gray-400 underline hover:text-gray-600">
              Clear filters
            </button>
          </>
        )}
      </div>

      {/* ── Products table ── */}
      <div className="overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Zoho ID</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((p) => {
              const isEditing = editingId === p.id;

              return isEditing && editDraft ? (
                // ── Edit row ──────────────────────────────────────────────────
                <tr key={p.id} className="bg-blue-50/40">
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={editDraft.key}
                      onChange={(e) => setEditDraft({ ...editDraft, key: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={editDraft.name}
                      onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={editDraft.type}
                      onChange={(e) => setEditDraft({ ...editDraft, type: e.target.value as ProductType })}
                    >
                      {PRODUCT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={editDraft.categoryId}
                      onChange={(e) => setEditDraft({ ...editDraft, categoryId: e.target.value })}
                    >
                      <option value="">No category</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                      placeholder="zoho-plan-xxxx"
                      value={editDraft.zohoPlanId}
                      onChange={(e) => setEditDraft({ ...editDraft, zohoPlanId: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <select
                        className="rounded-md border border-blue-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                        value=""
                        onChange={(e) => {
                          const id = e.target.value;
                          if (id && !editDraft.tagIds.includes(id))
                            setEditDraft({ ...editDraft, tagIds: [...editDraft.tagIds, id] });
                        }}
                      >
                        <option value="">Add tag…</option>
                        {tags.filter((t) => !editDraft.tagIds.includes(t.id)).map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                      {editDraft.tagIds.map((id) => {
                        const tag = tags.find((t) => t.id === id);
                        if (!tag) return null;
                        return (
                          <span key={id} className="inline-flex items-center gap-1 rounded-full bg-gray-700 px-2 py-0.5 text-[10px] font-medium text-white">
                            {tag.name}
                            <button type="button" onClick={() => setEditDraft({ ...editDraft, tagIds: editDraft.tagIds.filter((x) => x !== id) })} className="text-gray-300 hover:text-white">✕</button>
                          </span>
                        );
                      })}
                      {/* Unit label inline — shown when metered tag is selected */}
                      {isMeteredSelected(editDraft.tagIds) && (
                        <input
                          className="rounded-md border border-teal-200 bg-teal-50 px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-teal-300 w-28"
                          placeholder="unit label…"
                          value={editDraft.unitLabel}
                          onChange={(e) => setEditDraft({ ...editDraft, unitLabel: e.target.value })}
                          title="Unit label (e.g. mailbox, GB, seat)"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void saveEdit(p.id)}
                        disabled={editLoading || !editDraft.key.trim() || !editDraft.name.trim()}
                        className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-700 disabled:opacity-40"
                      >
                        {editLoading ? "Saving…" : "Save"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                // ── Display row ───────────────────────────────────────────────
                <tr key={p.id} className={`transition-colors hover:bg-gray-50 ${!p.isActive ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{p.key}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3"><TypeBadge type={p.type} /></td>
                  <td className="px-4 py-3 text-gray-600">{p.category?.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{p.zohoPlanId ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(p.tags ?? []).map((t) => (
                        t.key === "metered"
                          ? <span key={t.id} className="inline-flex items-center gap-1 rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                              📊 metered{p.unitLabel ? ` · ${p.unitLabel}` : ""}
                            </span>
                          : <span key={t.id} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{t.name}</span>
                      ))}
                      {(p.tags ?? []).length === 0 && <span className="text-gray-300 text-xs">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${p.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => startEdit(p)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void toggle(p.id, !p.isActive)}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${p.isActive ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}
                      >
                        {p.isActive ? "Disable" : "Enable"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                  {rows.length === 0 ? "No products yet. Create one above." : "No products match the current filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}