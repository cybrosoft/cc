"use client";
// components/customer/CategoryPageClient.tsx
// Shared list page for customer service categories (GPU, Storage, Backup, …).
// Same table pattern as app/dashboard/servers/ServersClient.tsx, minus live
// provider columns (no IP/specs — those are server-specific).

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { colors } from "@/lib/ui/tokens";

type Row = {
  subscriptionId:  string;
  name:            string | null;
  productName:     string;
  productKey:      string | null;
  categoryName:    string | null;
  unitLabel:       string | null;
  quantity:        number;
  status:          string;
  paymentStatus:   string;
  billingPeriod:   string;
  periodEnd:       string | null;
  locationDisplay: string | null;
  createdAt:       string;
};

function Sk({ w = "80%", h = 12 }: { w?: string; h?: number }) {
  return <span className="cy-shimmer" style={{ display: "inline-block", width: w, height: h, borderRadius: 3 }} />;
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  let color = "#9ca3af", bg = "#f9fafb", border = "#e5e7eb";
  if (s === "ACTIVE")                                   { color = "#15803d"; bg = "#f0fdf4"; border = "#86efac"; }
  else if (["SUSPENDED", "CANCELED"].includes(s))       { color = "#dc2626"; bg = "#fef2f2"; border = "#fecaca"; }
  else if (["PENDING_PAYMENT", "PENDING_EXTERNAL", "PROCESSING"].includes(s)) { color = "#b45309"; bg = "#fffbeb"; border = "#fcd34d"; }

  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", background: bg, color, border: `1px solid ${border}`, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const COLS = "minmax(160px,1.6fr) 110px 150px 95px 105px 95px 110px";

// ── Inline name cell (same endpoint as servers list page) ────────────────────
function NameCell({ subscriptionId, name, onSaved }: {
  subscriptionId: string;
  name: string | null;
  onSaved: (name: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value,   setValue]   = useState(name ?? "");
  const [saving,  setSaving]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function save() {
    setSaving(true);
    try {
      const res  = await fetch(`/api/customer/subscriptions/${subscriptionId}/name`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok) { onSaved(data.serverName); setEditing(false); }
    } catch { /**/ }
    setSaving(false);
  }

  function cancel() { setValue(name ?? ""); setEditing(false); }

  if (editing) {
    return (
      <div style={{ paddingRight: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void save(); if (e.key === "Escape") cancel(); }}
            style={{ fontSize: 12, padding: "3px 7px", border: `1px solid ${colors.primary}`, outline: "none", fontFamily: "inherit", width: 140 }} />
          <button onClick={() => void save()} disabled={saving}
            style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", background: colors.primary, color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {saving ? "…" : "Save"}
          </button>
          <button onClick={cancel}
            style={{ fontSize: 11, padding: "3px 6px", background: "none", border: "1px solid #e5e7eb", cursor: "pointer", fontFamily: "inherit", color: "#6b7280" }}>
            ✕
          </button>
        </div>
        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>Enter to save · Esc to cancel</div>
      </div>
    );
  }

  return (
    <div style={{ paddingRight: 8, minWidth: 0 }}>
      {name ? (
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {name}
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          style={{ fontSize: 11, color: colors.primary, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", textDecoration: "underline", marginBottom: 2 }}>
          + Add name
        </button>
      )}
      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {/* product name as subline for context */}
      </div>
    </div>
  );
}

export default function CategoryPageClient({ pageKey, title }: { pageKey: string; title: string }) {
  const [loading, setLoading] = useState(true);
  const [rows,    setRows]    = useState<Row[]>([]);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch(`/api/customer/services/${encodeURIComponent(pageKey)}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) { setError(data?.error ?? "Failed to load services"); return; }
      setRows(data.data ?? []);
    } catch { setError("Network error while loading services"); }
    finally  { setLoading(false); }
  }, [pageKey]);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <style>{`
        @keyframes cy-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .cy-shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%);background-size:800px 100%;animation:cy-shimmer 1.4s ease-in-out infinite;}
        .cy-cat-row:hover{background:#f9fafb!important;}
      `}</style>

      <div className="cy-page-content">
        <div className="cy-dash-wrap">

          {/* Page title + actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 3 }}>DASHBOARD / {title.toUpperCase()}</p>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "#111827", margin: 0 }}>{title}</h1>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => void load()} disabled={loading}
                style={{ height: 36, padding: "0 14px", fontSize: 12, fontWeight: 600, background: "#fff", border: "1px solid #e5e7eb", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", color: "#374151", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Loading…" : "↻ Refresh"}
              </button>
              <Link href="#"
              aria-disabled="true"
              tabIndex={-1}
              style={{ display: "inline-flex", alignItems: "center", height: 36, padding: "0 16px", fontSize: 12, fontWeight: 600, background: colors.primary, color: "#fff", border: "none", textDecoration: "none", fontFamily: "inherit", opacity: 0.5, pointerEvents: "none", cursor: "not-allowed" }}>
              + New Service
            </Link>
            </div>
          </div>

          {/* Count */}
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#9ca3af" }}>
            {loading ? "Loading…" : `${rows.length} service${rows.length !== 1 ? "s" : ""}`}
          </p>

          {/* Error */}
          {error && (
            <div style={{ marginBottom: 16, padding: "10px 16px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Scrollable table */}
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as any, border: "1px solid #e5e7eb" }}>
            <div style={{ background: "#fff", minWidth: 900 }}>

              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "0 12px", padding: "9px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                {["Name", "Type", "Location", "Billing", "Expires", "Payment", "Status"].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {h}
                  </span>
                ))}
              </div>

              {/* Skeletons */}
              {loading && [1, 2, 3].map(i => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: COLS, gap: "0 12px", padding: "14px 16px", borderBottom: "1px solid #f3f4f6", alignItems: "center", minWidth: 900 }}>
                  <div><Sk w="60%" h={13} /><br /><Sk w="40%" h={10} /></div>
                  <Sk w="60px" h={12} />
                  <Sk w="100px" h={12} />
                  <Sk w="60px" h={12} />
                  <Sk w="80px" h={12} />
                  <Sk w="50px" h={22} />
                  <Sk w="60px" h={22} />
                </div>
              ))}

              {/* Empty */}
              {!loading && rows.length === 0 && (
                <div style={{ padding: "48px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>No services yet</div>
                  <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Your {title} subscriptions will appear here.</div>
                </div>
              )}

              {/* Rows */}
              {!loading && rows.map((r, idx) => {
                const isLast = idx === rows.length - 1;
                const isPaid = r.paymentStatus === "PAID";

                return (
                  <div key={r.subscriptionId} className="cy-cat-row"
                    style={{ display: "grid", gridTemplateColumns: COLS, gap: "0 12px", padding: "12px 16px", borderBottom: isLast ? "none" : "1px solid #f3f4f6", alignItems: "center", transition: "background 0.1s", minWidth: 900 }}>

                    {/* Name (custom, with product name subline) */}
                    <div style={{ minWidth: 0 }}>
                      <NameCell
                        subscriptionId={r.subscriptionId}
                        name={r.name}
                        onSaved={(name) => {
                          setRows(prev => prev.map(row =>
                            row.subscriptionId === r.subscriptionId ? { ...row, name } : row
                          ));
                        }}
                      />
                      <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.productName}{r.quantity > 1 ? ` × ${r.quantity}` : ""}
                      </div>
                    </div>

                    {/* Type */}
                    <span style={{ fontSize: 12, color: "#374151", textTransform: "uppercase", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.productKey ?? "N/A"}
                    </span>

                    {/* Location */}
                    <span style={{ fontSize: 12.5, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.locationDisplay ?? "N/A"}
                    </span>

                    {/* Billing */}
                    <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                      {r.billingPeriod.replace(/_/g, " ")}
                    </span>

                    {/* Expires */}
                    <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                      {fmtDate(r.periodEnd)}
                    </span>

                    {/* Payment */}
                    <div>
                      {isPaid ? (
                        <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 0", width: 72, textAlign: "center", background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", textTransform: "uppercase" }}>
                          Paid
                        </span>
                      ) : (
                        <Link href="/dashboard/invoices"
                          style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 0", width: 72, textAlign: "center", background: "#fff", color: "#111827", border: "1px solid #d1d5db", textDecoration: "none", whiteSpace: "nowrap" }}>
                          Pay Now
                        </Link>
                      )}
                    </div>

                    {/* Status */}
                    <div><StatusBadge status={r.status} /></div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
