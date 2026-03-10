"use client";
// app/admin/catalog/tags/TagsAdmin.tsx

import { useCallback, useEffect, useState } from "react";
import {
  PageShell, Card, Table, TR, TD, TagPill,
  Btn, Field, Alert, Empty, Modal, SaveRow, FiltersBar, Select,
  InlinePanel, CLR,
} from "@/components/ui/admin-ui";

type TagRow = { id: string; key: string; name: string; _count?: { products: number; users: number } };

export default function TagsAdmin() {
  const [rows, setRows]       = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Filters
  const [fSearch, setFSearch] = useState("");
  const [fUsed, setFUsed]     = useState(""); // "products" | "customers" | ""

  // Create
  const [open, setOpen]       = useState(false);
  const [tKey, setTKey]       = useState("");
  const [tName, setTName]     = useState("");
  const [saving, setSaving]   = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Inline edit
  const [editId, setEditId]   = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch("/api/admin/catalog/tags");
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setError("Failed to load tags"); return; }
      setRows(j.data);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = rows.filter(r => {
    if (fUsed === "products"  && !r._count?.products)  return false;
    if (fUsed === "customers" && !r._count?.users)     return false;
    if (fUsed === "unused"    && ((r._count?.products ?? 0) > 0 || (r._count?.users ?? 0) > 0)) return false;
    if (fSearch) {
      const q = fSearch.toLowerCase();
      return r.key.includes(q) || r.name.toLowerCase().includes(q);
    }
    return true;
  });

  async function create() {
    if (!tKey.trim() || !tName.trim()) { setSaveErr("Key and name are required"); return; }
    setSaving(true); setSaveErr(null);
    try {
      const r = await fetch("/api/admin/catalog/tags", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: tKey.trim().toLowerCase(), name: tName.trim() }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setSaveErr(j?.error ?? "Failed"); return; }
      setTKey(""); setTName(""); setOpen(false); void load();
    } catch { setSaveErr("Network error"); }
    finally { setSaving(false); }
  }

  function startEdit(t: TagRow) {
    setEditId(t.id);
    setEditName(t.name);
    setEditErr(null);
  }

  async function saveEdit() {
    if (!editName.trim() || !editId) { setEditErr("Name is required"); return; }
    setEditSaving(true); setEditErr(null);
    try {
      const r = await fetch("/api/admin/catalog/tags/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editId, name: editName.trim() }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setEditErr(j?.error ?? "Failed"); return; }
      setEditId(null); void load();
    } catch { setEditErr("Network error"); }
    finally { setEditSaving(false); }
  }

  return (
    <PageShell
      breadcrumb="ADMIN / CATALOG / TAGS"
      title="Tags"
      ctaLabel="New Tag"
      ctaOnClick={() => setOpen(true)}
    >
      {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

      <Card>
        <FiltersBar>
          <input
            className="cy-input"
            value={fSearch}
            onChange={e => setFSearch(e.target.value)}
            placeholder="Search key or name…"
            style={{ width: 200 }}
          />
          <select
            className="cy-input"
            value={fUsed}
            onChange={e => setFUsed(e.target.value)}
            style={{ width: 180 }}
          >
            <option value="">All Tags</option>
            <option value="products">Used on Products</option>
            <option value="customers">Used on Customers</option>
            <option value="unused">Unused</option>
          </select>
          {(fSearch || fUsed) && (
            <Btn variant="ghost" onClick={() => { setFSearch(""); setFUsed(""); }}>Clear</Btn>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>
            {filtered.length} tag{filtered.length !== 1 ? "s" : ""}
          </span>
        </FiltersBar>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <Empty message={fSearch || fUsed ? "No tags match your filters." : "No tags yet."} />
        ) : (
          <Table cols={["Key", "Name", "Products", "Customers", "Preview", ""]}>
            {filtered.map(t => (
              <tbody key={t.id}>
                <TR highlight={editId === t.id}>
                  <TD mono muted>{t.key}</TD>
                  <TD style={{ fontWeight: 500 }}>{t.name}</TD>
                  <TD muted>{t._count?.products ?? 0}</TD>
                  <TD muted>{t._count?.users ?? 0}</TD>
                  <TD><TagPill label={t.name} /></TD>
                  <TD right>
                    <Btn
                      variant="outline"
                      onClick={() => editId === t.id ? (setEditId(null)) : startEdit(t)}
                    >
                      {editId === t.id ? "Close" : "Edit"}
                    </Btn>
                  </TD>
                </TR>

                {editId === t.id && (
                  <InlinePanel>
                    {editErr && <div style={{ marginBottom: 12 }}><Alert type="error">{editErr}</Alert></div>}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 14, alignItems: "end" }}>
                      <Field label="Display Name" hint="Key cannot be changed after creation">
                        <input className="cy-input" value={editName}
                          onChange={e => setEditName(e.target.value)} placeholder="Hetzner" />
                      </Field>
                      <div style={{ paddingBottom: 1 }}>
                        <SaveRow
                          onCancel={() => setEditId(null)}
                          onSave={saveEdit}
                          saving={editSaving}
                        />
                      </div>
                    </div>
                  </InlinePanel>
                )}
              </tbody>
            ))}
          </Table>
        )}
      </Card>

      {/* Create modal */}
      <Modal open={open} onClose={() => { setOpen(false); setSaveErr(null); }} title="New Tag" width={420}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {saveErr && <Alert type="error">{saveErr}</Alert>}
          <Field label="Name" required>
            <input className="cy-input" value={tName} onChange={e => {
              const name = e.target.value;
              setTName(name);
              setTKey(name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
            }} placeholder="Hetzner" />
          </Field>
          <Field label="Key" hint="Auto-generated · editable">
            <input className="cy-input" value={tKey} onChange={e => setTKey(e.target.value.toLowerCase())} placeholder="hz" />
          </Field>
          <SaveRow onCancel={() => setOpen(false)} onSave={create} saving={saving} saveLabel="Create Tag" />
        </div>
      </Modal>
    </PageShell>
  );
}
