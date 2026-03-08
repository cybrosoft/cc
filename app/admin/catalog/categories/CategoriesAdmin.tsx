// app/admin/catalog/categories/CategoriesAdmin.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

type CategoryRow = { id: string; key: string; name: string; isActive: boolean };

type CategoriesApiResponse =
  | { ok: true; data: CategoryRow[] }
  | { ok: false; error: string };

type EditDraft = { key: string; name: string };

export default function CategoriesAdmin() {
  const [rows,    setRows]    = useState<CategoryRow[]>([]);
  const [key,     setKey]     = useState("");
  const [name,    setName]    = useState("");
  const [loading, setLoading] = useState(false);

  // Inline edit
  const [editingId,   setEditingId]   = useState<string | null>(null);
  const [editDraft,   setEditDraft]   = useState<EditDraft | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  // ── Load ──────────────────────────────────────────────────────────────────────

  const load = useCallback(async (): Promise<void> => {
    const res  = await fetch("/api/admin/catalog/categories", { cache: "no-store" });
    const json = (await res.json().catch(() => null)) as CategoriesApiResponse | null;
    if (res.ok && json?.ok) setRows(json.data);
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Create ────────────────────────────────────────────────────────────────────

  async function create(): Promise<void> {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/catalog/categories", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ key: key.trim(), name: name.trim() }),
      });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) { alert(json?.error ?? "Create failed"); return; }
      setKey(""); setName("");
      await load();
    } finally {
      setLoading(false);
    }
  }

  // ── Edit ──────────────────────────────────────────────────────────────────────

  function startEdit(c: CategoryRow) {
    setEditingId(c.id);
    setEditDraft({ key: c.key, name: c.name });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(id: string): Promise<void> {
    if (!editDraft?.key.trim() || !editDraft?.name.trim()) return;
    setEditLoading(true);
    try {
      const res  = await fetch("/api/admin/catalog/categories/update", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id, key: editDraft.key.trim(), name: editDraft.name.trim() }),
      });
      const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
      if (!res.ok || !json?.ok) { alert(json?.error ?? "Update failed"); return; }
      cancelEdit();
      await load();
    } finally {
      setEditLoading(false);
    }
  }

  // ── Toggle ────────────────────────────────────────────────────────────────────

  async function toggle(id: string, isActive: boolean): Promise<void> {
    const res  = await fetch("/api/admin/catalog/categories/toggle", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id, isActive }),
    });
    const json = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) { alert(json?.error ?? "Update failed"); return; }
    await load();
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── Create form ── */}
      <div className="rounded-xl border bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Add New Category</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Key <span className="text-gray-400">(unique slug)</span></label>
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              style={{ width: 180 }}
              placeholder="e.g. cloud-servers"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-500">Name</label>
            <input
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              style={{ width: 220 }}
              placeholder="e.g. Cloud Servers"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <button
            onClick={() => void create()}
            disabled={loading || !key.trim() || !name.trim()}
            className="rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:opacity-40"
          >
            {loading ? "Creating…" : "+ Add Category"}
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-auto rounded-xl border bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((c) => {
              const isEditing = editingId === c.id;
              return (
                <tr key={c.id} className={`transition-colors hover:bg-gray-50 ${!c.isActive ? "opacity-50" : ""}`}>

                  {/* Key */}
                  <td className="px-4 py-3">
                    {isEditing && editDraft ? (
                      <input
                        autoFocus
                        className="w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                        value={editDraft.key}
                        onChange={(e) => setEditDraft({ ...editDraft, key: e.target.value })}
                        onKeyDown={(e) => { if (e.key === "Escape") cancelEdit(); }}
                      />
                    ) : (
                      <span className="font-mono text-xs text-gray-500">{c.key}</span>
                    )}
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3">
                    {isEditing && editDraft ? (
                      <input
                        className="w-full rounded-md border border-blue-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        value={editDraft.name}
                        onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter")  void saveEdit(c.id);
                          if (e.key === "Escape") cancelEdit();
                        }}
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{c.name}</span>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${c.isActive ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                      {c.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => void saveEdit(c.id)}
                          disabled={editLoading || !editDraft?.key.trim() || !editDraft?.name.trim()}
                          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40"
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
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(c)}
                          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => void toggle(c.id, !c.isActive)}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${c.isActive ? "border-red-200 text-red-600 hover:bg-red-50" : "border-green-200 text-green-600 hover:bg-green-50"}`}
                        >
                          {c.isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-400">
                  No categories yet. Add one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
