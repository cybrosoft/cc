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
const MARKET_ORDER   = ["SAUDI","GLOBAL"];

export default function NumberSeriesTab() {
  const [series,  setSeries]  = useState<Series[]>([]);
  const [activeM, setActiveM] = useState<string>("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft,   setDraft]   = useState<{ prefix: string; nextNum: string }>({ prefix: "", nextNum: "" });
  const [saving,  setSaving]  = useState(false);
  const [rowErr,  setRowErr]  = useState<Record<string, string>>({});
  const [rowOk,   setRowOk]   = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings/number-series")
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setSeries(d.series);
          const keys  = [...new Set(d.series.map((s: Series) => s.market.key))] as string[];
          const first = MARKET_ORDER.find(k => keys.includes(k)) ?? keys[0] ?? "";
          setActiveM(first);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  // Group by market key
  const byMarket: Record<string, Series[]> = {};
  for (const s of series) {
    if (!byMarket[s.market.key]) byMarket[s.market.key] = [];
    byMarket[s.market.key].push(s);
  }

  const marketKeys = Object.keys(byMarket).sort((a, b) => {
    const ai = MARKET_ORDER.indexOf(a); const bi = MARKET_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  function startEdit(s: Series) {
    setEditing(s.id);
    setDraft({ prefix: s.prefix, nextNum: String(s.nextNum) });
    setRowErr(p => ({ ...p, [s.id]: "" }));
    setRowOk(p => ({ ...p, [s.id]: false }));
  }

  function cancelEdit() {
    setEditing(null);
    setDraft({ prefix: "", nextNum: "" });
  }

  async function saveRow(s: Series) {
    const trimmed = draft.prefix.trim().toUpperCase();
    const newNum  = Number(draft.nextNum);

    if (!trimmed) {
      setRowErr(p => ({ ...p, [s.id]: "Prefix cannot be blank" }));
      return;
    }
    if (!/^[A-Z0-9\-]+$/.test(trimmed)) {
      setRowErr(p => ({ ...p, [s.id]: "Only letters, numbers and hyphens allowed" }));
      return;
    }
    if (isNaN(newNum) || newNum < 1) {
      setRowErr(p => ({ ...p, [s.id]: "Next number must be at least 1" }));
      return;
    }
    if (newNum < s.nextNum) {
      setRowErr(p => ({ ...p, [s.id]: `Cannot decrease — current value is ${s.nextNum}` }));
      return;
    }

    setSaving(true);
    setRowErr(p => ({ ...p, [s.id]: "" }));
    try {
      const res  = await fetch("/api/admin/settings/number-series", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ id: s.id, prefix: trimmed, nextNum: newNum }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSeries(prev => prev.map(r =>
        r.id === s.id ? { ...r, prefix: data.series.prefix, nextNum: data.series.nextNum } : r
      ));
      setRowOk(p => ({ ...p, [s.id]: true }));
      setEditing(null);
    } catch (e: any) {
      setRowErr(p => ({ ...p, [s.id]: e.message }));
    }
    setSaving(false);
  }

  if (loading) return <div style={{ padding: 40, fontSize: 13, color: CLR.faint }}>Loading…</div>;

  const activeRows = (byMarket[activeM] ?? []).sort(
    (a, b) => DOC_TYPE_ORDER.indexOf(a.docType) - DOC_TYPE_ORDER.indexOf(b.docType)
  );

  return (
    <div>
      <TabHeader
        title="Number Series"
        description="Set document number prefixes and starting numbers per market. Prefix must be configured before creating any documents."
      />

      {/* Caution */}
      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", padding: "10px 14px", marginBottom: 20 }}>
        <p style={{ fontSize: 12, color: "#92400e", margin: 0 }}>
          <strong>Caution:</strong> Changing the next number will not affect already-issued documents.
          You can only <strong>increase</strong> the next number — decreasing is blocked to prevent duplicate document numbers.
        </p>
      </div>

      {/* Market tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #e5e7eb", marginBottom: 0 }}>
        {marketKeys.map(mKey => {
          const mName   = byMarket[mKey]?.[0]?.market.name ?? mKey;
          const isActive = activeM === mKey;
          const hasBlank = byMarket[mKey]?.some(s => !s.prefix.trim());
          return (
            <button key={mKey} onClick={() => { setActiveM(mKey); cancelEdit(); }} style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "10px 22px", fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color:  isActive ? CLR.primary : CLR.muted,
              background: "none", border: "none",
              borderBottom: isActive ? `2px solid ${CLR.primary}` : "2px solid transparent",
              marginBottom: -2, cursor: "pointer", fontFamily: "inherit",
            }}>
              {mName}
              <span style={{ fontSize: 10, color: CLR.faint }}>({mKey})</span>
              {hasBlank && (
                <span style={{ width: 7, height: 7, background: "#f59e0b", borderRadius: "50%", display: "inline-block", flexShrink: 0 }} title="Some prefixes not configured" />
              )}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderTop: "none" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
              {["Document Type","Prefix","Next Number","Preview",""].map(h => (
                <th key={h} style={{ padding: "9px 16px", textAlign: "left" as const, fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activeRows.map(s => {
              const isEditing   = editing === s.id;
              const blankPrefix = !s.prefix.trim();
              return (
                <tr key={s.id} style={{ borderBottom: "1px solid #f3f4f6", background: blankPrefix && !isEditing ? "#fffbeb" : "#fff" }}>

                  {/* Doc type */}
                  <td style={{ padding: "12px 16px", fontWeight: 500 }}>
                    {DOC_TYPE_LABEL[s.docType] ?? s.docType}
                    {blankPrefix && !isEditing && (
                      <span style={{ fontSize: 10, color: "#b45309", marginLeft: 8, fontWeight: 400 }}>Prefix not set</span>
                    )}
                  </td>

                  {/* Prefix */}
                  <td style={{ padding: "12px 16px" }}>
                    {isEditing ? (
                      <input
                        value={draft.prefix}
                        onChange={e => setDraft(d => ({ ...d, prefix: e.target.value.toUpperCase() }))}
                        placeholder="e.g. CY-INV"
                        style={{ padding: "6px 10px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "monospace", width: 140, outline: "none", textTransform: "uppercase" as const }}
                      />
                    ) : blankPrefix ? (
                      <span style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic" }}>Not set</span>
                    ) : (
                      <code style={{ fontSize: 12, background: CLR.primaryBg, padding: "2px 8px", color: CLR.primary, fontWeight: 600 }}>{s.prefix}</code>
                    )}
                  </td>

                  {/* Next number */}
                  <td style={{ padding: "12px 16px" }}>
                    {isEditing ? (
                      <input
                        type="number" min={s.nextNum}
                        value={draft.nextNum}
                        onChange={e => setDraft(d => ({ ...d, nextNum: e.target.value }))}
                        style={{ padding: "6px 10px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "monospace", width: 110, textAlign: "right" as const, outline: "none" }}
                      />
                    ) : (
                      <span style={{ fontFamily: "monospace", fontSize: 13, color: CLR.text }}>{s.nextNum}</span>
                    )}
                  </td>

                  {/* Preview */}
                  <td style={{ padding: "12px 16px" }}>
                    {isEditing ? (
                      draft.prefix.trim()
                        ? <code style={{ fontSize: 12, color: CLR.primary, background: CLR.primaryBg, padding: "2px 8px" }}>{draft.prefix.trim()}-{draft.nextNum}</code>
                        : <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>
                    ) : blankPrefix ? (
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>
                    ) : (
                      <code style={{ fontSize: 12, color: CLR.muted }}>{s.prefix}-{s.nextNum}</code>
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: "12px 16px", minWidth: 160 }}>
                    {isEditing ? (
                      <div>
                        <div style={{ display: "flex", gap: 6, marginBottom: rowErr[s.id] ? 6 : 0 }}>
                          <button onClick={() => saveRow(s)} disabled={saving}
                            style={{ padding: "6px 16px", fontSize: 12, fontWeight: 600, background: saving ? "#9ca3af" : CLR.primary, color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                            {saving ? "Saving…" : "Save"}
                          </button>
                          <button onClick={cancelEdit}
                            style={{ padding: "6px 12px", fontSize: 12, background: "#fff", border: "1px solid #d1d5db", cursor: "pointer", fontFamily: "inherit" }}>
                            Cancel
                          </button>
                        </div>
                        {rowErr[s.id] && (
                          <p style={{ fontSize: 11, color: "#dc2626", margin: 0, fontWeight: 600 }}>{rowErr[s.id]}</p>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button onClick={() => startEdit(s)}
                          style={{ padding: "6px 16px", fontSize: 12, background: CLR.primaryBg, color: CLR.primary, border: `1px solid ${CLR.primary}44`, cursor: "pointer", fontFamily: "inherit" }}>
                          Edit
                        </button>
                        {rowOk[s.id] && <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>Saved</span>}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}