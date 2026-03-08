// app/admin/catalog/tags/TagsAdmin.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tag = {
  id:           string;
  key:          string;
  name:         string;
  _count:       { products: number };
  createdAt:    string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TagsAdmin() {
  const [tags,        setTags]        = useState<Tag[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);

  // Create form
  const [newName, setNewName] = useState("");
  const [newKey,  setNewKey]  = useState("");
  const [keyManual, setKeyManual] = useState(false); // true once user edits key manually

  // Inline edit
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editName,    setEditName]    = useState("");

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/catalog/tags", { cache: "no-store" });
      const json = await res.json().catch(() => null) as { ok: boolean; data: Tag[] } | null;
      if (json?.ok) setTags(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Create ────────────────────────────────────────────────────────────────────

  function handleNameChange(val: string) {
    setNewName(val);
    if (!keyManual) setNewKey(slugify(val));
  }

  async function create() {
    const name = newName.trim();
    const key  = newKey.trim();
    if (!name || !key) return;
    setSaving(true);
    try {
      const res  = await fetch("/api/admin/catalog/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, name }),
      });
      const json = await res.json().catch(() => null) as { ok: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) { alert(json?.error ?? "Create failed"); return; }
      setNewName(""); setNewKey(""); setKeyManual(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setEditName(tag.name);
  }

  async function saveEdit(tag: Tag) {
    const name = editName.trim();
    if (!name) return;
    setSaving(true);
    try {
      const res  = await fetch("/api/admin/catalog/tags/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: tag.id, name }),
      });
      const json = await res.json().catch(() => null) as { ok: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) { alert(json?.error ?? "Update failed"); return; }
      setEditingId(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const res  = await fetch("/api/admin/catalog/tags/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      const json = await res.json().catch(() => null) as { ok: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) { alert(json?.error ?? "Delete failed"); return; }
      setDeleteTarget(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Product Tags</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Tags are used to group and filter products (e.g. Windows, Linux). Products can have multiple tags.
          </p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
          {tags.length} tag{tags.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Create form ── */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">Add New Tag</h3>
        <div className="flex flex-wrap items-end gap-3">

          {/* Name */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Display Name</label>
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              style={{ width: 180 }}
              placeholder="e.g. Windows Server"
              value={newName}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

          {/* Key */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">
              Key <span className="text-gray-400">(auto-generated, used in API)</span>
            </label>
            <input
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
              style={{ width: 200 }}
              placeholder="e.g. windows-server"
              value={newKey}
              onChange={(e) => { setNewKey(slugify(e.target.value)); setKeyManual(true); }}
            />
          </div>

          <button
            onClick={() => void create()}
            disabled={saving || !newName.trim() || !newKey.trim()}
            className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-40"
          >
            {saving ? "Adding…" : "+ Add Tag"}
          </button>
        </div>
      </div>

      {/* ── Tags table ── */}
      <div className="overflow-auto rounded-xl border bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-gray-400">Loading tags…</div>
        ) : tags.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <span className="text-2xl">🏷️</span>
            <p className="text-sm text-gray-400">No tags yet. Add one above.</p>
          </div>
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Key</th>
                <th className="px-5 py-3">Products</th>
                <th className="px-5 py-3">API Usage</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tags.map((tag) => (
                <tr key={tag.id} className="transition-colors hover:bg-gray-50">

                  {/* Name — editable inline */}
                  <td className="px-5 py-3">
                    {editingId === tag.id ? (
                      <input
                        autoFocus
                        className="rounded-lg border border-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")  void saveEdit(tag);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{tag.name}</span>
                    )}
                  </td>

                  {/* Key */}
                  <td className="px-5 py-3">
                    <code className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{tag.key}</code>
                  </td>

                  {/* Product count */}
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      tag._count.products > 0
                        ? "bg-blue-50 text-blue-700"
                        : "bg-gray-100 text-gray-400"
                    }`}>
                      {tag._count.products} product{tag._count.products !== 1 ? "s" : ""}
                    </span>
                  </td>

                  {/* API snippet */}
                  <td className="px-5 py-3">
                    <code className="rounded bg-gray-50 px-2 py-0.5 text-[11px] text-gray-500">
                      ?tag={tag.key}
                    </code>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3 text-right">
                    {editingId === tag.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => void saveEdit(tag)}
                          disabled={saving}
                          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40"
                        >
                          {saving ? "…" : "Save"}
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => startEdit(tag)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          Rename
                        </button>
                        <button
                          onClick={() => setDeleteTarget(tag)}
                          className="rounded-lg border border-red-100 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Delete confirm modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-gray-900">Delete tag "{deleteTarget.name}"?</h3>
            <p className="mt-2 text-sm text-gray-500">
              {deleteTarget._count.products > 0
                ? `This tag is used by ${deleteTarget._count.products} product${deleteTarget._count.products !== 1 ? "s" : ""}. Deleting it will remove the tag from all those products.`
                : "This tag is not used by any products. It will be permanently removed."}
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void confirmDelete()}
                disabled={saving}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40"
              >
                {saving ? "Deleting…" : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
