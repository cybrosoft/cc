"use client";
// app/admin/catalog/products/ProductsAdmin.tsx

import { useCallback, useEffect, useState } from "react";
import {
  PageShell, Card, Table, TR, TD, TypeBadge, StatusBadge, TagPill,
  Btn, Field, Alert, Empty, Modal, FiltersBar, SaveRow, SectionLabel,
  Select, InlinePanel, CLR,
} from "@/components/ui/admin-ui";

type ProductType = "plan" | "addon" | "service" | "product";
type Category    = { id: string; key: string; name: string };
type Tag         = { id: string; key: string; name: string };

type ProductRow = {
  id: string; key: string; name: string; nameAr: string | null;
  type: ProductType; isActive: boolean;
  unitLabel: string | null; zohoPlanId: string | null;
  category: { id: string; name: string } | null;
  tags: Tag[];
  addonPricingType: string | null; addonBehavior: string | null;
  applicableTags: string[]; addonUnitLabel: string | null;
  addonMinUnits: number | null; addonMaxUnits: number | null;
  addonPercentage: string | null;
  productDetails: string | null; detailsAr: string | null;
};

const EMPTY_DRAFT = {
  key: "", name: "", nameAr: "", type: "plan" as ProductType,
  categoryId: "", unitLabel: "", productDetails: "", detailsAr: "",
  tagIds: [] as string[],
  addonPricingType: "", addonBehavior: "optional",
  addonUnitLabel: "", addonMinUnits: "", addonMaxUnits: "", addonPercentage: "",
  applicableTagIds: [] as string[],
};

type Draft = typeof EMPTY_DRAFT;

export default function ProductsAdmin() {
  const [rows, setRows]       = useState<ProductRow[]>([]);
  const [cats, setCats]       = useState<Category[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [fSearch, setFSearch] = useState("");
  const [fType, setFType]     = useState("");
  const [fCat, setFCat]       = useState("");
  const [fStatus, setFStatus] = useState("");

  const [open, setOpen]       = useState(false);
  const [draft, setDraft]     = useState<Draft>(EMPTY_DRAFT);
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [editId, setEditId]   = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [pr, cr, tr] = await Promise.all([
        fetch("/api/admin/catalog/products").then(r => r.json()).catch(() => null),
        fetch("/api/admin/catalog/categories").then(r => r.json()).catch(() => null),
        fetch("/api/admin/catalog/tags").then(r => r.json()).catch(() => null),
      ]);
      if (pr?.ok)  setRows(pr.data);
      if (cr?.ok)  setCats(cr.data);
      if (tr?.ok)  setAllTags(tr.data);
      if (!pr?.ok) setError("Failed to load products");
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = rows.filter(r => {
    if (fType   && r.type !== fType) return false;
    if (fCat    && r.category?.id !== fCat) return false;
    if (fStatus === "active"   && !r.isActive) return false;
    if (fStatus === "inactive" &&  r.isActive) return false;
    if (fSearch) {
      const q = fSearch.toLowerCase();
      if (!r.key.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function toggleId(id: string, field: "tagIds" | "applicableTagIds", d: Draft): Draft {
    return {
      ...d,
      [field]: (d[field] as string[]).includes(id)
        ? (d[field] as string[]).filter(x => x !== id)
        : [...(d[field] as string[]), id],
    };
  }

  async function create() {
    if (!draft.key.trim() || !draft.name.trim()) { setSaveErr("Key and Name required"); return; }
    setSaving(true); setSaveErr(null);
    try {
      const body = buildBody(draft, allTags);
      const r = await fetch("/api/admin/catalog/products", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setSaveErr(j?.error ?? "Failed"); return; }
      setOpen(false); setDraft(EMPTY_DRAFT); void load();
    } catch { setSaveErr("Network error"); }
    finally { setSaving(false); }
  }

  function startEdit(p: ProductRow) {
    setEditId(p.id); setEditErr(null);
    setEditDraft({
      key: p.key, name: p.name, nameAr: p.nameAr ?? "",
      type: p.type, categoryId: p.category?.id ?? "", unitLabel: p.unitLabel ?? "",
      productDetails: p.productDetails ?? "", detailsAr: p.detailsAr ?? "",
      tagIds: p.tags.map(t => t.id),
      addonPricingType: p.addonPricingType ?? "", addonBehavior: p.addonBehavior ?? "optional",
      addonUnitLabel: p.addonUnitLabel ?? "",
      addonMinUnits: p.addonMinUnits?.toString() ?? "",
      addonMaxUnits: p.addonMaxUnits?.toString() ?? "",
      addonPercentage: p.addonPercentage?.toString() ?? "",
      applicableTagIds: allTags.filter(t => p.applicableTags.includes(t.key)).map(t => t.id),
    });
  }

  async function saveEdit() {
    if (!editDraft || !editId) return;
    if (!editDraft.name.trim()) { setEditErr("Name is required"); return; }
    setEditSaving(true); setEditErr(null);
    try {
      const body = { id: editId, ...buildBody(editDraft, allTags) };
      const r = await fetch("/api/admin/catalog/products/update", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setEditErr(j?.error ?? "Failed"); return; }
      setEditId(null); setEditDraft(null); void load();
    } catch { setEditErr("Network error"); }
    finally { setEditSaving(false); }
  }

  async function toggle(id: string, active: boolean) {
    setToggling(id);
    try {
      await fetch("/api/admin/catalog/products/toggle", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !active }),
      });
      void load();
    } finally { setToggling(null); }
  }

  const clearFilters = () => { setFSearch(""); setFType(""); setFCat(""); setFStatus(""); };
  const hasFilters   = fSearch || fType || fCat || fStatus;

  return (
    <PageShell
      breadcrumb="ADMIN / CATALOG / PRODUCTS"
      title="Products"
      ctaLabel="New Product"
      ctaOnClick={() => setOpen(true)}
    >
      {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

      <Card>
        <FiltersBar>
          <input className="cy-input" value={fSearch} onChange={e => setFSearch(e.target.value)}
            placeholder="Search key or name…" style={{ width: 200 }} />
          <select className="cy-input" value={fType} onChange={e => setFType(e.target.value)} style={{ width: 130 }}>
            <option value="">All Types</option>
            {(["plan","addon","service","product"] as const).map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
            ))}
          </select>
          <select className="cy-input" value={fCat} onChange={e => setFCat(e.target.value)} style={{ width: 160 }}>
            <option value="">All Categories</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select className="cy-input" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: 130 }}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
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
          <Table cols={["Key", "Name", "Type", "Category", "Unit Label", "Tags", "Status", ""]}>
            {filtered.map(p => (
              <tbody key={p.id}>
                <TR highlight={editId === p.id}>
                  <TD mono muted>{p.key}</TD>
                  <TD>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    {p.nameAr && <div style={{ fontSize: 11, color: "#9ca3af", direction: "rtl" }}>{p.nameAr}</div>}
                  </TD>
                  <TD><TypeBadge value={p.type} /></TD>
                  <TD muted>{p.category?.name ?? <span style={{ color: "#d1d5db" }}>—</span>}</TD>
                  <TD muted>{p.unitLabel ?? <span style={{ color: "#d1d5db" }}>—</span>}</TD>
                  <TD>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {p.tags.map(t => <TagPill key={t.id} label={t.name} />)}
                      {p.tags.length === 0 && <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>}
                    </div>
                  </TD>
                  <TD><StatusBadge active={p.isActive} /></TD>
                  <TD right>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <Btn variant="outline"
                        onClick={() => editId === p.id ? (setEditId(null), setEditDraft(null)) : startEdit(p)}>
                        {editId === p.id ? "Close" : "Edit"}
                      </Btn>
                      <Btn variant={p.isActive ? "danger" : "outline"}
                        disabled={toggling === p.id} onClick={() => toggle(p.id, p.isActive)}>
                        {toggling === p.id ? "…" : p.isActive ? "Disable" : "Enable"}
                      </Btn>
                    </div>
                  </TD>
                </TR>

                {editId === p.id && editDraft && (
                  <InlinePanel>
                    {editErr && <div style={{ marginBottom: 12 }}><Alert type="error">{editErr}</Alert></div>}
                    <ProductForm
                      draft={editDraft}
                      setDraft={setEditDraft as any}
                      cats={cats}
                      allTags={allTags}
                      onToggleId={(id, field) => setEditDraft(d => d ? toggleId(id, field, d) : d)}
                      isEdit
                    />
                    <div style={{ marginTop: 14 }}>
                      <SaveRow onCancel={() => { setEditId(null); setEditDraft(null); }} onSave={saveEdit} saving={editSaving} />
                    </div>
                  </InlinePanel>
                )}
              </tbody>
            ))}
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => { setOpen(false); setSaveErr(null); setDraft(EMPTY_DRAFT); }} title="New Product" width={620}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {saveErr && <Alert type="error">{saveErr}</Alert>}
          <ProductForm
            draft={draft} setDraft={setDraft as any}
            cats={cats} allTags={allTags}
            onToggleId={(id, field) => setDraft(d => toggleId(id, field, d))}
          />
          <SaveRow onCancel={() => { setOpen(false); setDraft(EMPTY_DRAFT); }} onSave={create} saving={saving} saveLabel="Create Product" />
        </div>
      </Modal>
    </PageShell>
  );
}

// ── Shared product form ───────────────────────────────────────────────────────
function ProductForm({ draft, setDraft, cats, allTags, onToggleId, isEdit }: {
  draft: Draft; setDraft: (d: Draft) => void;
  cats: Category[]; allTags: Tag[];
  onToggleId: (id: string, field: "tagIds" | "applicableTagIds") => void;
  isEdit?: boolean;
}) {
  const set = (k: keyof Draft, v: unknown) => setDraft({ ...draft, [k]: v });

  // Check if "metered" tag is selected
  const meteredTag = allTags.find(t => t.key === "metered");
  const isMetered = meteredTag ? draft.tagIds.includes(meteredTag.id) : false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Type" required>
          <select className="cy-input" value={draft.type} onChange={e => set("type", e.target.value)}>
            {(["plan","addon","service","product"] as const).map(t => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select className="cy-input" value={draft.categoryId} onChange={e => set("categoryId", e.target.value)}>
            <option value="">None</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
      </div>

      {!isEdit && (
        <Field label="Key" hint="Unique lowercase slug — e.g. cloud-vps-2gb" required>
          <input className="cy-input" value={draft.key} onChange={e => set("key", e.target.value.toLowerCase())} placeholder="cloud-vps-2gb" />
        </Field>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Name (English)" required>
          <input className="cy-input" value={draft.name} onChange={e => set("name", e.target.value)} placeholder="Cloud VPS 2GB" />
        </Field>
        <Field label="Name (Arabic)">
          <input className="cy-input" value={draft.nameAr} onChange={e => set("nameAr", e.target.value)} placeholder="خادم سحابي 2 جيجا" dir="rtl" />
        </Field>
      </div>

      {/* Product tags — shown before Unit Label so metered detection works */}
      <Field label="Product Tags">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingTop: 2 }}>
          {allTags.map(t => {
            const on = draft.tagIds.includes(t.id);
            return (
              <button key={t.id} type="button" onClick={() => onToggleId(t.id, "tagIds")} style={{
                padding: "3px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                background: on ? CLR.primaryBg : "#fff", color: on ? CLR.primary : "#6b7280",
                border: `1px solid ${on ? CLR.primary : "#d1d5db"}`,
              }}>{on ? "✓ " : ""}{t.name}</button>
            );
          })}
        </div>
      </Field>

      {/* Unit Label — only shown when metered tag is selected */}
      {isMetered && (
        <Field label="Unit Label" hint="e.g. GB, seat, mailbox — shown in pricing as 'Price per GB'">
          <input className="cy-input" value={draft.unitLabel} onChange={e => set("unitLabel", e.target.value)} placeholder="GB" />
        </Field>
      )}

      {draft.type === "addon" && (
        <div style={{ border: "1px solid #e5e7eb", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionLabel>Addon Configuration</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Pricing Type">
              <select className="cy-input" value={draft.addonPricingType} onChange={e => set("addonPricingType", e.target.value)}>
                <option value="">Select…</option>
                <option value="fixed">Fixed price</option>
                <option value="percentage">Percentage of parent</option>
                <option value="per_unit">Per unit</option>
              </select>
            </Field>
            <Field label="Behavior">
              <select className="cy-input" value={draft.addonBehavior} onChange={e => set("addonBehavior", e.target.value)}>
                <option value="optional">Optional — customer chooses</option>
                <option value="required">Required — auto-added</option>
              </select>
            </Field>
          </div>
          {draft.addonPricingType === "per_unit" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label="Unit Label">
                <input className="cy-input" value={draft.addonUnitLabel} onChange={e => set("addonUnitLabel", e.target.value)} placeholder="GB" />
              </Field>
              <Field label="Min Units">
                <input className="cy-input" type="number" value={draft.addonMinUnits} onChange={e => set("addonMinUnits", e.target.value)} placeholder="1" />
              </Field>
              <Field label="Max Units">
                <input className="cy-input" type="number" value={draft.addonMaxUnits} onChange={e => set("addonMaxUnits", e.target.value)} placeholder="100" />
              </Field>
            </div>
          )}
          {draft.addonPricingType === "percentage" && (
            <Field label="Percentage %">
              <input className="cy-input" type="number" value={draft.addonPercentage} onChange={e => set("addonPercentage", e.target.value)} placeholder="10" />
            </Field>
          )}
          <Field label="Appears for Plans Tagged">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingTop: 2 }}>
              {allTags.map(t => {
                const on = draft.applicableTagIds.includes(t.id);
                return (
                  <button key={t.id} type="button" onClick={() => onToggleId(t.id, "applicableTagIds")} style={{
                    padding: "3px 10px", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                    background: on ? "#fffbeb" : "#fff", color: on ? "#b45309" : "#6b7280",
                    border: `1px solid ${on ? "#fde68a" : "#d1d5db"}`,
                  }}>{on ? "✓ " : ""}{t.name}</button>
                );
              })}
            </div>
          </Field>
        </div>
      )}

      <Field label="Product Details (English)" hint="Shown to customers. Markdown supported.">
        <textarea className="cy-input" rows={3} value={draft.productDetails}
          onChange={e => set("productDetails", e.target.value)}
          placeholder="Describe this product for customers…" style={{ resize: "vertical" }} />
      </Field>
      <Field label="Product Details (Arabic)">
        <textarea className="cy-input" rows={3} value={draft.detailsAr}
          onChange={e => set("detailsAr", e.target.value)}
          placeholder="وصف المنتج…" dir="rtl" style={{ resize: "vertical" }} />
      </Field>
    </div>
  );
}

function buildBody(draft: Draft, allTags: Tag[]) {
  const body: Record<string, unknown> = {
    key: draft.key.trim().toLowerCase(), name: draft.name.trim(),
    nameAr: draft.nameAr.trim() || null, type: draft.type,
    categoryId: draft.categoryId || null,
    unitLabel: draft.unitLabel.trim() || null,
    productDetails: draft.productDetails.trim() || null,
    detailsAr: draft.detailsAr.trim() || null,
    tagIds: draft.tagIds,
  };
  if (draft.type === "addon") {
    body.addonPricingType = draft.addonPricingType || null;
    body.addonBehavior    = draft.addonBehavior;
    body.addonUnitLabel   = draft.addonUnitLabel.trim() || null;
    body.addonMinUnits    = draft.addonMinUnits   ? Number(draft.addonMinUnits)   : null;
    body.addonMaxUnits    = draft.addonMaxUnits   ? Number(draft.addonMaxUnits)   : null;
    body.addonPercentage  = draft.addonPercentage ? Number(draft.addonPercentage) : null;
    body.applicableTagKeys = allTags.filter(t => draft.applicableTagIds.includes(t.id)).map(t => t.key);
  }
  return body;
}
