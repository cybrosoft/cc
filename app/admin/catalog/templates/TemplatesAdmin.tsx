"use client";
// app/admin/catalog/templates/TemplatesAdmin.tsx

import { useCallback, useEffect, useRef, useState } from "react";
import {
  PageShell, Card, Table, TR, TD, TypeBadge, TagPill,
  Btn, Input, Field, Alert, Empty, Modal, SaveRow, FiltersBar, CLR,
} from "@/components/ui/admin-ui";

type TemplateStatus   = "active" | "inactive" | "coming_soon";
type TemplateIconType = "devicon" | "upload";
type Tag = { id: string; key: string; name: string };
type TemplateRow = {
  id: string; slug: string; name: string; family: string | null;
  category: string; iconType: TemplateIconType; iconValue: string | null;
  status: TemplateStatus; sortOrder: number; isDefault: boolean;
  tagKeys: string[];        // legacy
  includeTags: string[];    // products with ANY of these tags appear with this template
  excludeTags: string[];    // products with ANY of these tags are hidden
  products?: { key: string }[];
};

const EMPTY_DRAFT = {
  slug: "", name: "", family: "", category: "OS",
  iconType: "devicon" as TemplateIconType, iconValue: "",
  status: "active" as TemplateStatus, sortOrder: 1, isDefault: false,
  tagKeys: [] as string[],
  includeTags: [] as string[],
  excludeTags: [] as string[],
};

// Popular devicons with label and class
const POPULAR_DEVICONS = [
  { label: "Ubuntu",     cls: "devicon-ubuntu-plain",     color: "#E95420" },
  { label: "Debian",     cls: "devicon-debian-plain",      color: "#A81D33" },
  { label: "CentOS",     cls: "devicon-centos-plain",      color: "#262577" },
  { label: "Fedora",     cls: "devicon-fedora-plain",      color: "#294172" },
  { label: "AlmaLinux",  cls: "devicon-linux-plain",       color: "#0F4266" },
  { label: "Windows",    cls: "devicon-windows8-original", color: "#0078D6" },
  { label: "Docker",     cls: "devicon-docker-plain",      color: "#2496ED" },
  { label: "NGINX",      cls: "devicon-nginx-original",    color: "#009639" },
  { label: "Apache",     cls: "devicon-apache-plain",      color: "#D22128" },
  { label: "MySQL",      cls: "devicon-mysql-plain",       color: "#4479A1" },
  { label: "PostgreSQL", cls: "devicon-postgresql-plain",  color: "#336791" },
  { label: "Redis",      cls: "devicon-redis-plain",       color: "#DC382D" },
  { label: "NodeJS",     cls: "devicon-nodejs-plain",      color: "#339933" },
  { label: "Python",     cls: "devicon-python-plain",      color: "#3776AB" },
  { label: "PHP",        cls: "devicon-php-plain",         color: "#777BB4" },
  { label: "WordPress",  cls: "devicon-wordpress-plain",   color: "#21759B" },
];

export default function TemplatesAdmin() {
  const [rows, setRows]       = useState<TemplateRow[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allProducts, setAllProducts] = useState<{ id: string; key: string; tags: { key: string }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [fSearch, setFSearch] = useState("");
  const [fCat, setFCat]       = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fFamily, setFFamily] = useState("");

  const [open, setOpen]     = useState(false);
  const [draft, setDraft]   = useState(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [editId, setEditId]   = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<typeof EMPTY_DRAFT | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [tr, tgr, pr] = await Promise.all([
        fetch("/api/admin/catalog/templates").then(r => r.json()).catch(() => null),
        fetch("/api/admin/catalog/tags").then(r => r.json()).catch(() => null),
        fetch("/api/admin/catalog/products").then(r => r.json()).catch(() => null),
      ]);
      if (tr?.ok)  setRows(tr.data);
      if (tgr?.ok) setAllTags(tgr.data);
      if (pr?.ok)  setAllProducts(pr.data);
      if (!tr?.ok) setError("Failed to load templates");
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const families = [...new Set(rows.map(r => r.family).filter(Boolean))] as string[];

  const filtered = rows.filter(r => {
    if (fCat    && r.category !== fCat)    return false;
    if (fStatus && r.status   !== fStatus) return false;
    if (fFamily && r.family   !== fFamily) return false;
    if (fSearch) {
      const q = fSearch.toLowerCase();
      if (!r.slug.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q) && !(r.family?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  async function create() {
    if (!draft.slug.trim() || !draft.name.trim()) { setSaveErr("Slug and name required"); return; }
    setSaving(true); setSaveErr(null);
    try {
      const r = await fetch("/api/admin/catalog/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: draft.slug.trim().toLowerCase(), name: draft.name.trim(),
          family: draft.family?.trim() || null, category: draft.category,
          iconType: draft.iconType, iconValue: draft.iconValue?.trim() || null,
          status: draft.status, sortOrder: Number(draft.sortOrder),
          isDefault: draft.isDefault,
          includeTags: draft.includeTags,
          excludeTags: draft.excludeTags,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setSaveErr(j?.error ?? "Failed"); return; }
      setOpen(false); setDraft(EMPTY_DRAFT); void load();
    } catch { setSaveErr("Network error"); }
    finally { setSaving(false); }
  }

  function startEdit(t: TemplateRow) {
    setEditId(t.id);
    setEditDraft({ slug: t.slug, name: t.name, family: t.family ?? "", category: t.category, iconType: t.iconType, iconValue: t.iconValue ?? "", status: t.status, sortOrder: t.sortOrder, isDefault: t.isDefault, tagKeys: t.tagKeys ?? [], includeTags: t.includeTags ?? [], excludeTags: t.excludeTags ?? [] });
  }

  async function saveEdit() {
    if (!editDraft || !editId) return;
    setEditSaving(true); setEditErr(null);
    try {
      const r = await fetch("/api/admin/catalog/templates/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editId, slug: editDraft.slug, name: editDraft.name,
          family: editDraft.family || null, category: editDraft.category,
          iconType: editDraft.iconType, iconValue: editDraft.iconValue || null,
          status: editDraft.status, sortOrder: Number(editDraft.sortOrder),
          isDefault: editDraft.isDefault,
          includeTags: editDraft.includeTags,
          excludeTags: editDraft.excludeTags,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setEditErr(j?.error ?? "Failed"); return; }
      setEditId(null); setEditDraft(null); void load();
    } catch { setEditErr("Network error"); }
    finally { setEditSaving(false); }
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this template?")) return;
    await fetch("/api/admin/catalog/templates/delete", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    void load();
  }

  return (
    <PageShell
      breadcrumb="ADMIN / CATALOG / TEMPLATES"
      title="OS Templates"
      ctaLabel="New Template"
      ctaOnClick={() => setOpen(true)}
    >
      {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

      {/* Devicon CSS — loaded always so icons show in table */}
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/devicons/devicon@latest/devicon.min.css" />

      <Card>
        <FiltersBar>
          <input className="cy-input" value={fSearch} onChange={e => setFSearch(e.target.value)}
            placeholder="Search slug or name…" style={{ width: 200 }} />
          <select className="cy-input" value={fCat} onChange={e => setFCat(e.target.value)} style={{ width: 110 }}>
            <option value="">All Categories</option>
            <option value="OS">OS</option>
            <option value="App">App</option>
          </select>
          <select className="cy-input" value={fFamily} onChange={e => setFFamily(e.target.value)} style={{ width: 140 }}>
            <option value="">All Families</option>
            {families.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <select className="cy-input" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: 140 }}>
            <option value="">All Status</option>
            {["active","inactive","coming_soon"].map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
          </select>
          {(fSearch || fCat || fFamily || fStatus) && (
            <Btn variant="ghost" onClick={() => { setFSearch(""); setFCat(""); setFFamily(""); setFStatus(""); }}>Clear</Btn>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>{filtered.length} templates</span>
        </FiltersBar>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <Empty />
        ) : (
          <Table cols={["", "Slug", "Name", "Family", "Category", "Tags", "Status", "Order", ""]}>
            {filtered.map(t => {
              const isEdit = editId === t.id;
              return (
                <tbody key={t.id}>
                  <TR highlight={isEdit}>
                    <TD style={{ width: 40 }}>
                      {t.iconType === "upload" && t.iconValue
                        ? <img src={t.iconValue} alt={t.name} style={{ width: 24, height: 24, objectFit: "contain" }} />
                        : t.iconValue
                          ? <i className={`${t.iconValue} colored`} style={{ fontSize: 22 }} />
                          : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>
                      }
                    </TD>
                    <TD mono muted>{t.slug}</TD>
                    <TD style={{ fontWeight: 500 }}>
                      {t.name}
                      {t.isDefault && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, padding: "1px 5px", background: CLR.primaryBg, color: CLR.primary, border: "1px solid #a7d9d1" }}>Default</span>
                      )}
                    </TD>
                    <TD muted>{t.family ?? <span style={{ color: "#d1d5db" }}>standalone</span>}</TD>
                    <TD><TypeBadge value={t.category} /></TD>
                    <TD>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {(t.includeTags ?? []).map(k => {
                          const tg = allTags.find(x => x.key === k);
                          return tg ? <TagPill key={k} label={tg.name} color="green" /> : null;
                        })}
                        {(t.excludeTags ?? []).map(k => {
                          const tg = allTags.find(x => x.key === k);
                          return tg ? <TagPill key={k} label={tg.name} color="red" /> : null;
                        })}
                        {!(t.includeTags ?? []).length && !(t.excludeTags ?? []).length && <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>}
                      </div>
                    </TD>
                    <TD><TypeBadge value={t.status} /></TD>
                    <TD muted>{t.sortOrder}</TD>
                    <TD right>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <Btn variant="outline" onClick={() => isEdit ? (setEditId(null), setEditDraft(null)) : startEdit(t)}>
                          {isEdit ? "Close" : "Edit"}
                        </Btn>
                        <Btn variant="danger" onClick={() => deleteTemplate(t.id)}>Del</Btn>
                      </div>
                    </TD>
                  </TR>

                  {isEdit && editDraft && (
                    <tr>
                      <td colSpan={9} style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", padding: "16px 20px" }}>
                        {editErr && <div style={{ marginBottom: 12 }}><Alert type="error">{editErr}</Alert></div>}
                        <TemplateForm
                          draft={editDraft} setDraft={setEditDraft as any}
                          allTags={allTags} allProducts={allProducts} families={families}
                          onToggleTag={k => setEditDraft(d => d ? toggleTagKey(k, d) : d)}
                          isEdit
                        />
                        <div style={{ marginTop: 14 }}>
                          <SaveRow onCancel={() => { setEditId(null); setEditDraft(null); }} onSave={saveEdit} saving={editSaving} />
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => { setOpen(false); setSaveErr(null); }} title="New Template" width={620}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {saveErr && <Alert type="error">{saveErr}</Alert>}
          <TemplateForm
            draft={draft} setDraft={setDraft as any}
            allTags={allTags} allProducts={allProducts} families={families}
          />
          <SaveRow onCancel={() => setOpen(false)} onSave={create} saving={saving} saveLabel="Create Template" />
        </div>
      </Modal>
    </PageShell>
  );
}

// ── Shared template form ──────────────────────────────────────────────────────
function TemplateForm({ draft, setDraft, allTags, allProducts, families, isEdit }: {
  draft: typeof EMPTY_DRAFT; setDraft: (d: typeof EMPTY_DRAFT) => void;
  allTags: Tag[]; allProducts?: { id: string; key: string; tags: { key: string }[] }[];
  families: string[];
  isEdit?: boolean;
}) {
  const set = (k: string, v: unknown) => setDraft({ ...draft, [k]: v });
  const [customFamily, setCustomFamily] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        {/* Family dropdown with existing + Create New */}
        <Field label="Family" hint="Group name — e.g. Ubuntu">
          {!customFamily ? (
            <select className="cy-input" value={draft.family}
              onChange={e => {
                if (e.target.value === "__new__") { setCustomFamily(true); set("family", ""); }
                else set("family", e.target.value);
              }}>
              <option value="">— Select family —</option>
              {families.map(f => <option key={f} value={f}>{f}</option>)}
              <option value="__new__">+ Create New</option>
            </select>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <input className="cy-input" value={draft.family}
                onChange={e => set("family", e.target.value)} placeholder="Ubuntu" autoFocus />
              {families.length > 0 && (
                <button type="button" onClick={() => setCustomFamily(false)}
                  style={{ padding: "0 8px", background: "#fff", border: "1px solid #d1d5db", color: "#6b7280", cursor: "pointer", fontSize: 11, whiteSpace: "nowrap" }}>
                  Pick
                </button>
              )}
            </div>
          )}
        </Field>
        <Field label="Name" hint="Version — e.g. 22.04 LTS" required>
          <input className="cy-input" value={draft.name}
            onChange={e => {
              const name = e.target.value;
              const autoSlug = (draft.family ? draft.family.toLowerCase().replace(/[^a-z0-9]+/g,"-") + "-" : "") + name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
              setDraft({ ...draft, name, slug: autoSlug });
            }} placeholder="22.04 LTS" />
        </Field>
        <Field label="Category">
          <select className="cy-input" value={draft.category} onChange={e => set("category", e.target.value)}>
            <option value="OS">OS</option>
            <option value="App">App</option>
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Slug" hint="Auto-generated · editable">
          <input className="cy-input" value={draft.slug}
            onChange={e => set("slug", e.target.value.toLowerCase())} placeholder="ubuntu-22-04" />
        </Field>
        <Field label="Status">
          <select className="cy-input" value={draft.status} onChange={e => set("status", e.target.value)}>
            {["active","inactive","coming_soon"].map(s => <option key={s} value={s}>{s.replace("_"," ")}</option>)}
          </select>
        </Field>
      </div>

      {/* Icon Type */}
      <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 12 }}>
        <Field label="Icon Type">
          <select className="cy-input" value={draft.iconType} onChange={e => set("iconType", e.target.value)}>
            <option value="devicon">Devicon CSS class</option>
            <option value="upload">Upload image</option>
          </select>
        </Field>

        {draft.iconType === "devicon" ? (
          <Field label={
            <span>
              Devicon Class&nbsp;
              <a href="https://devicon.dev" target="_blank" rel="noopener noreferrer"
                style={{ fontSize: 10, color: CLR.primary, textDecoration: "none", fontWeight: 400 }}>
                Browse devicons ↗
              </a>
            </span>
          }>
            <input className="cy-input" value={draft.iconValue}
              onChange={e => set("iconValue", e.target.value)}
              placeholder="devicon-ubuntu-plain" />
          </Field>
        ) : (
          <Field label="Image Upload">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input className="cy-input" value={draft.iconValue}
                onChange={e => set("iconValue", e.target.value)}
                placeholder="URL will appear here after upload" readOnly={!!draft.iconValue}
                style={{ flex: 1 }} />
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ padding: "0 14px", height: 34, background: "#fff", border: "1px solid #d1d5db", color: "#374151", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, whiteSpace: "nowrap" }}>
                Choose file
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  // Preview as base64 / or upload to your API
                  const reader = new FileReader();
                  reader.onload = ev => set("iconValue", ev.target?.result as string);
                  reader.readAsDataURL(file);
                }} />
              {draft.iconValue && draft.iconValue.startsWith("data:") && (
                <img src={draft.iconValue} alt="" style={{ width: 32, height: 32, objectFit: "contain", border: "1px solid #e5e7eb" }} />
              )}
            </div>
          </Field>
        )}
      </div>

      {/* Devicon picker — shown only for devicon type */}
      {draft.iconType === "devicon" && (
        <div style={{ border: "1px solid #e5e7eb", padding: 12, background: "#fafafa" }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", marginBottom: 8 }}>
            Common Icons — click to use
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {POPULAR_DEVICONS.map(icon => {
              const active = draft.iconValue === icon.cls;
              return (
                <button key={icon.cls} type="button" onClick={() => set("iconValue", icon.cls)}
                  title={icon.cls}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                    padding: "8px 10px", cursor: "pointer", fontFamily: "inherit",
                    background: active ? CLR.primaryBg : "#fff",
                    border: `1px solid ${active ? CLR.primary : "#e5e7eb"}`,
                    minWidth: 64,
                  }}>
                  <i className={`${icon.cls} colored`} style={{ fontSize: 24 }} />
                  <span style={{ fontSize: 10, color: active ? CLR.primary : "#6b7280" }}>{icon.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Sort Order">
          <input className="cy-input" type="number" value={String(draft.sortOrder)} onChange={e => set("sortOrder", Number(e.target.value))} />
        </Field>
        <Field label="Default in Family">
          <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={draft.isDefault} onChange={e => set("isDefault", e.target.checked)} />
            <span style={{ fontSize: 13 }}>Mark as default for this family</span>
          </label>
        </Field>
      </div>

      <TemplateTags
        includeTags={draft.includeTags}
        setIncludeTags={v => set("includeTags", v)}
        excludeTags={draft.excludeTags}
        setExcludeTags={v => set("excludeTags", v)}
        allTags={allTags}
      />

      {/* Include / Exclude tags panel */}

      {/* Matched products preview */}
      {(() => {
        const matching = (allProducts ?? []).filter(p =>
          draft.includeTags.length === 0
            ? true
            : p.tags.some(t => draft.includeTags.includes(t.key))
        ).filter(p => !p.tags.some(t => draft.excludeTags.includes(t.key)));
        return matching.length > 0 ? (
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, marginBottom: 6 }}>
              ✅ {matching.length} Matched Product{matching.length !== 1 ? "s" : ""}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5 }}>
              {matching.map(p => (
                <span key={p.key} style={{ fontSize: 11, padding: "2px 8px", background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#374151", fontFamily: "monospace" }}>
                  {p.key}
                </span>
              ))}
            </div>
          </div>
        ) : null;
      })()}
    </div>
  );
}

// ── TemplateTags — include / exclude selector ──────────────────────────────────

function TagSelector({ mode, tagKeys, setTagKeys, allTags, otherKeys }: {
  mode: "include" | "exclude";
  tagKeys: string[]; setTagKeys: (v: string[]) => void;
  allTags: Tag[]; otherKeys: string[];
}) {
  const isInclude  = mode === "include";
  const selected   = allTags.filter(t => tagKeys.includes(t.key));
  const available  = allTags.filter(t => !tagKeys.includes(t.key) && !otherKeys.includes(t.key));
  const add    = (k: string) => { if (!tagKeys.includes(k)) setTagKeys([...tagKeys, k]); };
  const remove = (k: string) => setTagKeys(tagKeys.filter(x => x !== k));

  const pillStyle: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4,
    fontSize: 11, fontWeight: 600, padding: "2px 8px",
    background: isInclude ? "#f0fdf4" : "#fef2f2",
    border: `1px solid ${isInclude ? "#86efac" : "#fca5a5"}`,
    color: isInclude ? "#15803d" : "#dc2626",
  };
  const addStyle: React.CSSProperties = {
    fontSize: 11, padding: "2px 8px", cursor: "pointer", fontFamily: "inherit",
    background: "#fff",
    border: `1px dashed ${isInclude ? "#86efac" : "#fca5a5"}`,
    color: isInclude ? "#16a34a" : "#ef4444",
  };
  const wrapStyle: React.CSSProperties = {
    border: `1px solid ${isInclude ? "#bbf7d0" : "#fecaca"}`,
    background: isInclude ? "#f0fdf4" : "#fff5f5",
    padding: 12,
  };

  return (
    <div style={wrapStyle}>
      <div style={{ fontSize: 11, fontWeight: 700, color: isInclude ? "#15803d" : "#dc2626", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 6 }}>
        {isInclude ? "✚ Include Tags" : "✕ Exclude Tags"}
      </div>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 8 }}>
        {isInclude
          ? "Template appears on products matching ANY of these tags."
          : "Hidden from products matching ANY of these tags, even if they match an include tag."}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, minHeight: 28, marginBottom: 8 }}>
        {selected.length === 0
          ? <span style={{ fontSize: 11, color: "#d1d5db" }}>{isInclude ? "No include tags — appears on all products" : "No excludes"}</span>
          : selected.map(t => (
              <span key={t.key} style={pillStyle}>
                {t.name}
                <button onClick={() => remove(t.key)} style={{ border: "none", background: "none", cursor: "pointer", color: "inherit", fontSize: 14, lineHeight: 1, padding: 0, opacity: 0.6 }}>×</button>
              </span>
            ))
        }
      </div>
      {available.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
          {available.map(t => (
            <button key={t.key} type="button" onClick={() => add(t.key)} style={addStyle}>+ {t.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateTags({ includeTags, setIncludeTags, excludeTags, setExcludeTags, allTags }: {
  includeTags: string[]; setIncludeTags: (v: string[]) => void;
  excludeTags: string[]; setExcludeTags: (v: string[]) => void;
  allTags: Tag[];
}) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 8 }}>
        Product Matching Tags
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <TagSelector mode="include" tagKeys={includeTags} setTagKeys={setIncludeTags} allTags={allTags} otherKeys={excludeTags} />
        <TagSelector mode="exclude" tagKeys={excludeTags} setTagKeys={setExcludeTags} allTags={allTags} otherKeys={includeTags} />
      </div>
      {includeTags.length > 0 ? (
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 6 }}>
          Shows on products matching: <strong>{includeTags.join(", ")}</strong>
          {excludeTags.length > 0 && <> — except: <strong style={{ color: "#dc2626" }}>{excludeTags.join(", ")}</strong></>}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
          No include tags set — template appears on all products (use include tags to restrict).
        </div>
      )}
    </div>
  );
}