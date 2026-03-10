"use client";
// app/admin/catalog/locations/LocationsAdmin.tsx

import { useCallback, useEffect, useState } from "react";
import {
  PageShell, Card, Table, TR, TD, TypeBadge, StatusBadge, TagPill,
  Btn, Input, Field, Alert, Empty, Modal, SaveRow, SectionLabel, FiltersBar, CLR,
} from "@/components/ui/admin-ui";

type LocationStatus = "active" | "inactive" | "coming_soon";
type Tag = { id: string; key: string; name: string };
type LocationRow = {
  id: string; code: string; name: string; family: string | null;
  flag: string | null; countryCode: string | null;
  status: LocationStatus; sortOrder: number; isDefault: boolean;
  includeTags: string[]; excludeTags: string[];
  products?: { key: string }[];
};

const STATUS_OPTS: LocationStatus[] = ["active","inactive","coming_soon"];
const EMPTY_DRAFT = {
  code: "", name: "", family: "", flag: "", countryCode: "",
  status: "active" as LocationStatus, sortOrder: 1, isDefault: false,
  includeTagKeys: [] as string[], excludeTagKeys: [] as string[],
};

export default function LocationsAdmin() {
  const [rows, setRows]       = useState<LocationRow[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [allProducts, setAllProducts] = useState<{ id: string; key: string; tags: { key: string }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [fSearch, setFSearch] = useState("");
  const [fStatus, setFStatus] = useState("");

  const [open, setOpen]     = useState(false);
  const [draft, setDraft]   = useState({ ...EMPTY_DRAFT });
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<LocationRow & { includeTagKeys: string[]; excludeTagKeys: string[] } | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [lr, tr, pr] = await Promise.all([
        fetch("/api/admin/catalog/locations").then(r => r.json()).catch(() => null),
        fetch("/api/admin/catalog/tags").then(r => r.json()).catch(() => null),
        fetch("/api/admin/catalog/products").then(r => r.json()).catch(() => null),
      ]);
      if (lr?.ok) setRows(lr.data);
      if (tr?.ok) setAllTags(tr.data);
      if (pr?.ok) setAllProducts(pr.data);
      if (!lr?.ok) setError("Failed to load locations");
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Derived: unique regions from existing rows
  const regions = [...new Set(rows.map(r => r.family).filter(Boolean))] as string[];

  const filtered = rows.filter(r => {
    if (fStatus && r.status !== fStatus) return false;
    if (fSearch) {
      const q = fSearch.toLowerCase();
      if (!r.code.toLowerCase().includes(q) && !r.name.toLowerCase().includes(q) && !(r.family?.toLowerCase().includes(q))) return false;
    }
    return true;
  });

  function toggleTagKey(key: string, field: "includeTagKeys" | "excludeTagKeys") {
    setDraft(d => ({
      ...d,
      [field]: (d[field] as string[]).includes(key)
        ? (d[field] as string[]).filter(x => x !== key)
        : [...(d[field] as string[]), key],
    }));
  }

  async function create() {
    if (!draft.code.trim() || !draft.name.trim()) { setSaveErr("Code and name required"); return; }
    setSaving(true); setSaveErr(null);
    try {
      const r = await fetch("/api/admin/catalog/locations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: draft.code.trim().toUpperCase(), name: draft.name.trim(),
          family: draft.family?.trim() || null, flag: draft.flag?.trim() || null,
          countryCode: draft.countryCode?.trim() || null,
          status: draft.status, sortOrder: Number(draft.sortOrder) || 1,
          isDefault: draft.isDefault,
          includeTags: draft.includeTagKeys, excludeTags: draft.excludeTagKeys,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setSaveErr(j?.error ?? "Failed"); return; }
      setOpen(false); setDraft({ ...EMPTY_DRAFT }); void load();
    } catch { setSaveErr("Network error"); }
    finally { setSaving(false); }
  }

  function startEdit(loc: LocationRow) {
    setEditId(loc.id);
    setEditDraft({ ...loc, includeTagKeys: loc.includeTags, excludeTagKeys: loc.excludeTags });
    setEditErr(null);
  }

  async function saveEdit() {
    if (!editDraft) return;
    setEditSaving(true); setEditErr(null);
    try {
      const r = await fetch("/api/admin/catalog/locations/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editDraft.id, code: editDraft.code, name: editDraft.name,
          family: editDraft.family || null, flag: editDraft.flag || null,
          countryCode: editDraft.countryCode || null,
          status: editDraft.status, sortOrder: Number(editDraft.sortOrder),
          isDefault: editDraft.isDefault,
          includeTags: editDraft.includeTagKeys, excludeTags: editDraft.excludeTagKeys,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setEditErr(j?.error ?? "Failed"); return; }
      setEditId(null); setEditDraft(null); void load();
    } catch { setEditErr("Network error"); }
    finally { setEditSaving(false); }
  }

  async function deleteLocation(id: string) {
    if (!confirm("Delete this location?")) return;
    await fetch("/api/admin/catalog/locations/delete", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    });
    void load();
  }

  return (
    <PageShell
      breadcrumb="ADMIN / CATALOG / LOCATIONS"
      title="Locations"
      ctaLabel="New Location"
      ctaOnClick={() => setOpen(true)}
    >
      {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

      <Card>
        <FiltersBar>
          <input className="cy-input" value={fSearch} onChange={e => setFSearch(e.target.value)}
            placeholder="Search code or name…" style={{ width: 200 }} />
          <select className="cy-input" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: 150 }}>
            <option value="">All Status</option>
            {STATUS_OPTS.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          {(fSearch || fStatus) && <Btn variant="ghost" onClick={() => { setFSearch(""); setFStatus(""); }}>Clear</Btn>}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>{filtered.length} locations</span>
        </FiltersBar>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <Empty message="No locations yet. Create one to get started." />
        ) : (
          <Table cols={["Code", "Name", "Region", "Include Tags", "Exclude Tags", "Status", "Order", ""]}>
            {filtered.map(loc => {
              const isEdit = editId === loc.id;
              return (
                <tbody key={loc.id}>
                  <TR highlight={isEdit}>
                    <TD mono muted>{loc.flag} {loc.code}</TD>
                    <TD style={{ fontWeight: 500 }}>
                      {loc.name}
                      {loc.isDefault && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, padding: "1px 5px", background: CLR.primaryBg, color: CLR.primary, border: "1px solid #a7d9d1" }}>Default</span>
                      )}
                    </TD>
                    <TD muted>{loc.family ?? "—"}</TD>
                    <TD>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {loc.includeTags.length === 0
                          ? <span style={{ fontSize: 11, color: "#ef4444" }}>⚠ None</span>
                          : loc.includeTags.map(tk => <TagPill key={tk} label={tk} />)
                        }
                      </div>
                    </TD>
                    <TD>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                        {loc.excludeTags.length === 0
                          ? <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>
                          : loc.excludeTags.map(tk => <TagPill key={tk} label={tk} color="gray" />)
                        }
                      </div>
                    </TD>
                    <TD><TypeBadge value={loc.status} /></TD>
                    <TD muted>{loc.sortOrder}</TD>
                    <TD right>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <Btn variant="outline" onClick={() => isEdit ? (setEditId(null), setEditDraft(null)) : startEdit(loc)}>
                          {isEdit ? "Close" : "Edit"}
                        </Btn>
                        <Btn variant="danger" onClick={() => deleteLocation(loc.id)}>Del</Btn>
                      </div>
                    </TD>
                  </TR>

                  {isEdit && editDraft && (
                    <tr>
                      <td colSpan={8} style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb", padding: "16px 20px" }}>
                        <LocationForm
                          draft={editDraft}
                          setDraft={d => setEditDraft(d as typeof editDraft)}
                          allTags={allTags}
                          allProducts={allProducts}
                          regions={regions}
                          saving={editSaving}
                          error={editErr}
                          onSave={saveEdit}
                          onCancel={() => { setEditId(null); setEditDraft(null); }}
                          isEdit
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

      <Modal open={open} onClose={() => { setOpen(false); setSaveErr(null); }} title="New Location" width={620}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {saveErr && <Alert type="error">{saveErr}</Alert>}
          <LocationForm
            draft={draft} setDraft={setDraft as any}
            allTags={allTags} allProducts={allProducts} regions={regions}
            saving={saving} error={null}
            onSave={create} onCancel={() => setOpen(false)}
          />
        </div>
      </Modal>
    </PageShell>
  );
}

// ── Shared location form ──────────────────────────────────────────────────────
function LocationForm({ draft, setDraft, allTags, allProducts, regions, saving, error, onSave, onCancel, isEdit }: {
  draft: any; setDraft: (d: any) => void;
  allTags: Tag[]; allProducts: { id: string; key: string; tags: { key: string }[] }[];
  regions: string[];
  saving: boolean; error: string | null;
  onSave: () => void; onCancel: () => void;
  isEdit?: boolean;
}) {
  const [customRegion, setCustomRegion] = useState(false);
  const familyInList = regions.includes(draft.family ?? "");

  // Products whose tags intersect with includeTagKeys
  const appliedTagKeys: string[] = draft.includeTagKeys ?? [];
  const matchingProducts = allProducts.filter(p =>
    p.tags.some(t => appliedTagKeys.includes(t.key))
  );

  const set = (k: string, v: unknown) => setDraft({ ...draft, [k]: v });

  const toggleTag = (key: string, field: "includeTagKeys" | "excludeTagKeys") =>
    setDraft({
      ...draft,
      [field]: (draft[field] as string[]).includes(key)
        ? (draft[field] as string[]).filter((x: string) => x !== key)
        : [...(draft[field] as string[]), key],
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <Alert type="error">{error}</Alert>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Region / Country">
          {/* Dropdown showing existing regions + Create New option */}
          {!customRegion && !(!familyInList && draft.family) ? (
            <select className="cy-input" value={draft.family ?? ""}
              onChange={e => {
                if (e.target.value === "__new__") { setCustomRegion(true); set("family", ""); }
                else set("family", e.target.value);
              }}>
              <option value="">— Select region —</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
              <option value="__new__">+ Create New</option>
            </select>
          ) : (
            <div style={{ display: "flex", gap: 6 }}>
              <input className="cy-input" value={draft.family ?? ""}
                onChange={e => set("family", e.target.value)} placeholder="Saudi Arabia" autoFocus />
              {regions.length > 0 && (
                <button type="button" onClick={() => setCustomRegion(false)}
                  style={{ padding: "0 10px", background: "#fff", border: "1px solid #d1d5db", color: "#6b7280", cursor: "pointer", fontSize: 12, whiteSpace: "nowrap" }}>
                  Pick existing
                </button>
              )}
            </div>
          )}
        </Field>
        <Field label="City Name" required>
          <input className="cy-input" value={draft.name}
            onChange={e => set("name", e.target.value)} placeholder="Jeddah" />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="Code" hint="Uppercase — e.g. JED, FRA" required>
          <input className="cy-input" value={draft.code}
            onChange={e => set("code", e.target.value.toUpperCase())} placeholder="JED" />
        </Field>
        <Field label="Flag Emoji">
          <input className="cy-input" value={draft.flag ?? ""}
            onChange={e => set("flag", e.target.value)} placeholder="🇸🇦" />
        </Field>
        <Field label="Country Code" hint="ISO 2-letter">
          <input className="cy-input" value={draft.countryCode ?? ""}
            onChange={e => set("countryCode", e.target.value.toUpperCase())} placeholder="SA" />
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <Field label="Status">
          <select className="cy-input" value={draft.status}
            onChange={e => set("status", e.target.value)}>
            {(["active","inactive","coming_soon"] as LocationStatus[]).map(s => (
              <option key={s} value={s}>{s.replace("_", " ")}</option>
            ))}
          </select>
        </Field>
        <Field label="Sort Order">
          <input className="cy-input" type="number" value={String(draft.sortOrder)}
            onChange={e => set("sortOrder", Number(e.target.value))} />
        </Field>
        <Field label="Default Location">
          <label style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={!!draft.isDefault}
              onChange={e => set("isDefault", e.target.checked)} />
            <span style={{ fontSize: 13 }}>Set as default</span>
          </label>
        </Field>
      </div>

      <TagSelectorPair
        allTags={allTags}
        includeKeys={draft.includeTagKeys ?? []}
        excludeKeys={draft.excludeTagKeys ?? []}
        onToggleInclude={k => toggleTag(k, "includeTagKeys")}
        onToggleExclude={k => toggleTag(k, "excludeTagKeys")}
      />

      {/* Applied products — derived from allProducts matching includeTagKeys */}
      {isEdit && matchingProducts.length > 0 && (
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", marginBottom: 6 }}>
            Products at this Location
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {matchingProducts.map(p => (
              <span key={p.key} style={{ fontSize: 11, padding: "2px 8px", background: "#f3f4f6", border: "1px solid #e5e7eb", color: "#374151", fontFamily: "monospace" }}>
                {p.key}
              </span>
            ))}
          </div>
        </div>
      )}

      <SaveRow onCancel={onCancel} onSave={onSave} saving={saving} saveLabel={isEdit ? "Save Changes" : "Create Location"} />
    </div>
  );
}

// ── Tag selector pair ─────────────────────────────────────────────────────────
function TagSelectorPair({ allTags, includeKeys, excludeKeys, onToggleInclude, onToggleExclude }: {
  allTags: Tag[]; includeKeys: string[]; excludeKeys: string[];
  onToggleInclude: (k: string) => void; onToggleExclude: (k: string) => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <div style={{ border: "1px solid #bbf7d0", padding: 12, background: "#f0fdf4" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#15803d", textTransform: "uppercase", marginBottom: 6 }}>
          ✚ Include Tags — products appear here
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {allTags.filter(t => !excludeKeys.includes(t.key)).map(t => {
            const on = includeKeys.includes(t.key);
            return (
              <button key={t.key} type="button" onClick={() => onToggleInclude(t.key)} style={{
                padding: "3px 9px", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                background: on ? "#dcfce7" : "#fff", color: on ? "#15803d" : "#6b7280",
                border: `1px solid ${on ? "#86efac" : "#e5e7eb"}`,
              }}>{on ? "✓ " : ""}{t.name}</button>
            );
          })}
        </div>
      </div>
      <div style={{ border: "1px solid #fca5a5", padding: 12, background: "#fff5f5" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#dc2626", textTransform: "uppercase", marginBottom: 6 }}>
          ✕ Exclude Tags — products hidden here
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {allTags.filter(t => !includeKeys.includes(t.key)).map(t => {
            const on = excludeKeys.includes(t.key);
            return (
              <button key={t.key} type="button" onClick={() => onToggleExclude(t.key)} style={{
                padding: "3px 9px", fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                background: on ? "#fee2e2" : "#fff", color: on ? "#dc2626" : "#6b7280",
                border: `1px solid ${on ? "#fca5a5" : "#e5e7eb"}`,
              }}>{on ? "✓ " : ""}{t.name}</button>
            );
          })}
        </div>
      </div>
    </div>
  );
}