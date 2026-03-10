"use client";
// app/admin/catalog/categories/CategoriesAdmin.tsx

import { useCallback, useEffect, useState } from "react";
import {
  PageShell, Card, Table, TR, TD, StatusBadge,
  Btn, Input, Select, Field, Alert, Empty, Modal, SaveRow, FiltersBar,
  InlinePanel, CLR,
} from "@/components/ui/admin-ui";

type CategoryRow = {
  id: string; key: string; name: string; nameAr: string | null;
  isActive: boolean; _count?: { products: number };
};

type EditDraft = { key: string; name: string; nameAr: string; isActive: boolean };

export default function CategoriesAdmin() {
  const [rows, setRows]       = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [fSearch, setFSearch] = useState("");
  const [fStatus, setFStatus] = useState("");

  const [open, setOpen]       = useState(false);
  const [cKey, setCKey]       = useState("");
  const [cName, setCName]     = useState("");
  const [cNameAr, setCNameAr] = useState("");
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const [editId, setEditId]   = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/admin/catalog/categories");
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setError("Failed to load categories"); return; }
      setRows(j.data);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = rows.filter(c => {
    if (fStatus === "active"   && !c.isActive) return false;
    if (fStatus === "inactive" &&  c.isActive) return false;
    if (fSearch) {
      const q = fSearch.toLowerCase();
      return c.key.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.nameAr ?? "").includes(q);
    }
    return true;
  });

  async function create() {
    if (!cKey.trim() || !cName.trim()) { setSaveErr("Key and name are required"); return; }
    setSaving(true); setSaveErr(null);
    try {
      const r = await fetch("/api/admin/catalog/categories", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: cKey.trim().toLowerCase(), name: cName.trim(), nameAr: cNameAr.trim() || null }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setSaveErr(j?.error ?? "Failed to create"); return; }
      setCKey(""); setCName(""); setCNameAr(""); setOpen(false); void load();
    } catch { setSaveErr("Network error"); }
    finally { setSaving(false); }
  }

  function startEdit(c: CategoryRow) {
    setEditId(c.id);
    setEditDraft({ key: c.key, name: c.name, nameAr: c.nameAr ?? "", isActive: c.isActive });
    setEditErr(null);
  }

  async function saveEdit() {
    if (!editDraft || !editId) return;
    if (!editDraft.name.trim()) { setEditErr("Name is required"); return; }
    setEditSaving(true); setEditErr(null);
    try {
      const r = await fetch("/api/admin/catalog/categories/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, key: editDraft.key.trim().toLowerCase(), name: editDraft.name.trim(), nameAr: editDraft.nameAr.trim() || null, isActive: editDraft.isActive }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setEditErr(j?.error ?? "Failed to save"); return; }
      setEditId(null); setEditDraft(null); void load();
    } catch { setEditErr("Network error"); }
    finally { setEditSaving(false); }
  }

  async function toggle(id: string, current: boolean) {
    setToggling(id);
    try {
      await fetch("/api/admin/catalog/categories/toggle", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !current }),
      });
      void load();
    } finally { setToggling(null); }
  }

  return (
    <PageShell
      breadcrumb="ADMIN / CATALOG / CATEGORIES"
      title="Categories"
      ctaLabel="New Category"
      ctaOnClick={() => setOpen(true)}
    >
      {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

      <Card>
        <FiltersBar>
          <input className="cy-input" value={fSearch} onChange={e => setFSearch(e.target.value)}
            placeholder="Search key or name…" style={{ width: 200 }} />
          <select className="cy-input" value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: 140 }}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          {(fSearch || fStatus) && (
            <Btn variant="ghost" onClick={() => { setFSearch(""); setFStatus(""); }}>Clear</Btn>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>
            {filtered.length} categor{filtered.length !== 1 ? "ies" : "y"}
          </span>
        </FiltersBar>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <Empty message={fSearch || fStatus ? "No categories match your filters." : "No categories yet."} />
        ) : (
          <Table cols={["Key", "Name (EN)", "Name (AR)", "Products", "Status", ""]}>
            {filtered.map(c => (
              <tbody key={c.id}>
                <TR highlight={editId === c.id}>
                  <TD mono muted>{c.key}</TD>
                  <TD style={{ fontWeight: 500 }}>{c.name}</TD>
                  <TD>
                    {c.nameAr
                      ? <span style={{ direction: "rtl", display: "inline-block" }}>{c.nameAr}</span>
                      : <span style={{ color: "#d1d5db" }}>—</span>
                    }
                  </TD>
                  <TD muted>{c._count?.products ?? 0}</TD>
                  <TD><StatusBadge active={c.isActive} /></TD>
                  <TD right>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <Btn variant="outline"
                        onClick={() => editId === c.id ? (setEditId(null), setEditDraft(null)) : startEdit(c)}>
                        {editId === c.id ? "Close" : "Edit"}
                      </Btn>
                      <Btn variant={c.isActive ? "danger" : "outline"}
                        disabled={toggling === c.id} onClick={() => toggle(c.id, c.isActive)}>
                        {toggling === c.id ? "…" : c.isActive ? "Disable" : "Enable"}
                      </Btn>
                    </div>
                  </TD>
                </TR>

                {editId === c.id && editDraft && (
                  <InlinePanel>
                    {editErr && <div style={{ marginBottom: 12 }}><Alert type="error">{editErr}</Alert></div>}
                    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1.5fr 1fr 140px", gap: 14, alignItems: "end" }}>
                      <Field label="Name (English)" required>
                        <input className="cy-input" value={editDraft.name}
                          onChange={e => setEditDraft(d => d ? { ...d, name: e.target.value } : d)}
                          placeholder="Cloud VPS" />
                      </Field>
                      <Field label="Name (Arabic)">
                        <input className="cy-input" value={editDraft.nameAr}
                          onChange={e => setEditDraft(d => d ? { ...d, nameAr: e.target.value } : d)}
                          placeholder="خوادم سحابية" dir="rtl" />
                      </Field>
                      <Field label="Key">
                        <input className="cy-input" value={editDraft.key}
                          onChange={e => setEditDraft(d => d ? { ...d, key: e.target.value.toLowerCase() } : d)}
                          placeholder="cloud-vps" />
                      </Field>
                      <Field label="Status">
                        <select className="cy-input"
                          value={editDraft.isActive ? "active" : "inactive"}
                          onChange={e => setEditDraft(d => d ? { ...d, isActive: e.target.value === "active" } : d)}>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </Field>
                    </div>
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

      <Modal open={open} onClose={() => { setOpen(false); setSaveErr(null); }} title="New Category">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {saveErr && <Alert type="error">{saveErr}</Alert>}
          <Field label="Name (English)" required>
            <input className="cy-input" value={cName} onChange={e => {
              const name = e.target.value;
              setCName(name);
              setCKey(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
            }} placeholder="Cloud VPS" />
          </Field>
          <Field label="Key" hint="Auto-generated · editable">
            <input className="cy-input" value={cKey} onChange={e => setCKey(e.target.value.toLowerCase())} placeholder="cloud-vps" />
          </Field>
          <Field label="Name (Arabic)" hint="Optional">
            <input className="cy-input" value={cNameAr} onChange={e => setCNameAr(e.target.value)} placeholder="خوادم سحابية" dir="rtl" />
          </Field>
          <SaveRow onCancel={() => setOpen(false)} onSave={create} saving={saving} saveLabel="Create Category" />
        </div>
      </Modal>
    </PageShell>
  );
}