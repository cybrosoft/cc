// app/admin/system/settings/tabs/NumberSeriesTab.tsx
"use client";
import React, { useEffect, useState } from "react";
import { CLR } from "@/components/ui/admin-ui";
import { card, sectionTitle, TabHeader } from "./settings-ui";

interface Series {
  id: string; docType: string; prefix: string; nextNum: number;
  market: { id: string; key: string; name: string };
}

const DOC_TYPE_LABEL: Record<string, string> = {
  RFQ:           "RFQ",
  QUOTATION:     "Quotation",
  PO:            "Purchase Order",
  DELIVERY_NOTE: "Delivery Note",
  PROFORMA:      "Proforma Invoice",
  INVOICE:       "Invoice",
  CREDIT_NOTE:   "Credit Note / Return",
};

const DOC_TYPE_ORDER = ["RFQ","QUOTATION","PO","DELIVERY_NOTE","PROFORMA","INVOICE","CREDIT_NOTE"];

export default function NumberSeriesTab() {
  const [series, setSeries]   = useState<Series[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft]     = useState<{ prefix: string; nextNum: string }>({ prefix: "", nextNum: "" });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<Record<string, string>>({});
  const [saved, setSaved]     = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings/number-series")
      .then(r => r.json())
      .then(d => { if (d.ok) setSeries(d.series); })
      .finally(() => setLoading(false));
  }, []);

  function startEdit(s: Series) {
    setEditing(s.id);
    setDraft({ prefix: s.prefix, nextNum: String(s.nextNum) });
    setSaved(prev => ({ ...prev, [s.id]: false }));
    setError(prev => ({ ...prev, [s.id]: "" }));
  }

  async function saveRow(id: string) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/number-series", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, prefix: draft.prefix, nextNum: Number(draft.nextNum) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSeries(prev => prev.map(s => s.id === id ? { ...s, prefix: data.series.prefix, nextNum: data.series.nextNum } : s));
      setSaved(prev => ({ ...prev, [id]: true }));
      setEditing(null);
    } catch (e: any) {
      setError(prev => ({ ...prev, [id]: e.message }));
    }
    setSaving(false);
  }

  // Group by market
  const byMarket: Record<string, Series[]> = {};
  for (const s of series) {
    if (!byMarket[s.market.key]) byMarket[s.market.key] = [];
    byMarket[s.market.key].push(s);
  }

  if (loading) return <div style={{ padding: 40, fontSize: 13, color: "#9ca3af" }}>Loading…</div>;

  return (
    <div>
      <TabHeader
        title="Number Series"
        description="Configure document number prefixes and starting numbers per market. Changes take effect on the next document created."
      />

      <div style={{ ...card, background: "#fffbeb", border: "1px solid #fcd34d", marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: "#92400e" }}>
          <strong>Caution:</strong> Changing the next number will not affect already-issued documents.
          Only increase the next number — never decrease it, as this can create duplicate document numbers.
        </p>
      </div>

      {Object.entries(byMarket).map(([mKey, rows]) => {
        const sorted = [...rows].sort((a, b) =>
          DOC_TYPE_ORDER.indexOf(a.docType) - DOC_TYPE_ORDER.indexOf(b.docType)
        );
        const market = rows[0]?.market;

        return (
          <div key={mKey} style={card}>
            <p style={sectionTitle}>
              {market.name}
              <span style={{ fontSize: 11, fontWeight: 400, color: CLR.muted, marginLeft: 8 }}>({mKey})</span>
            </p>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  {["Document Type","Prefix","Next Number","Preview",""].map(h => (
                    <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map(s => {
                  const isEditing = editing === s.id;
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "10px 14px", fontWeight: 500 }}>
                        {DOC_TYPE_LABEL[s.docType] ?? s.docType}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {isEditing ? (
                          <input
                            value={draft.prefix}
                            onChange={e => setDraft(d => ({ ...d, prefix: e.target.value }))}
                            style={{ padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "monospace", width: 120 }}
                          />
                        ) : (
                          <code style={{ fontSize: 12, background: "#f3f4f6", padding: "2px 8px", color: CLR.primary, fontWeight: 600 }}>{s.prefix}</code>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {isEditing ? (
                          <input
                            type="number" min={1}
                            value={draft.nextNum}
                            onChange={e => setDraft(d => ({ ...d, nextNum: e.target.value }))}
                            style={{ padding: "5px 8px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "monospace", width: 100, textAlign: "right" as const }}
                          />
                        ) : (
                          <span style={{ fontFamily: "monospace", fontSize: 13 }}>{s.nextNum}</span>
                        )}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <code style={{ fontSize: 11, color: CLR.muted }}>
                          {isEditing ? `${draft.prefix}-${draft.nextNum}` : `${s.prefix}-${s.nextNum}`}
                        </code>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        {isEditing ? (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => saveRow(s.id)} disabled={saving}
                              style={{ padding: "5px 12px", fontSize: 12, fontWeight: 600, background: CLR.primary, color: "#fff", border: "none", cursor: "pointer", fontFamily: "inherit" }}>
                              {saving ? "…" : "Save"}
                            </button>
                            <button onClick={() => setEditing(null)}
                              style={{ padding: "5px 12px", fontSize: 12, background: "#fff", border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit" }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button onClick={() => startEdit(s)}
                              style={{ padding: "5px 12px", fontSize: 12, background: CLR.primaryBg, color: CLR.primary, border: `1px solid ${CLR.primary}33`, cursor: "pointer", fontFamily: "inherit" }}>
                              Edit
                            </button>
                            {saved[s.id] && <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>✓ Saved</span>}
                            {error[s.id] && <span style={{ fontSize: 11, color: "#dc2626" }}>{error[s.id]}</span>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {rows.length === 0 && (
              <p style={{ fontSize: 12, color: CLR.muted, padding: "12px 0" }}>
                No number series found for this market. Series are created automatically when the first document of each type is generated.
              </p>
            )}
          </div>
        );
      })}

      {Object.keys(byMarket).length === 0 && (
        <div style={{ ...card, textAlign: "center", padding: 40 }}>
          <p style={{ fontSize: 14, color: CLR.muted, fontWeight: 500 }}>No number series configured yet</p>
          <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
            Series are created automatically the first time a document is generated for each market and type.
          </p>
        </div>
      )}
    </div>
  );
}
