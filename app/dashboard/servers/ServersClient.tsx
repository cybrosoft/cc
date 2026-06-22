"use client";
// app/dashboard/servers/ServersClient.tsx

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { colors } from "@/lib/ui/tokens";

type ServerRow = {
  subscriptionId:     string;
  subscriptionStatus: string;
  paymentStatus:      string;
  billingPeriod:      string;
  periodEnd:          string | null;
  locationCode:       string | null;
  locationDisplay:    string | null;
  templateSlug:       string | null;
  productKey:         string;
  productName:        string;
  createdAt:          string;
  serverId:           string | null;
  serverName:         string | null;
  provider:           string;
  provisioned:        boolean;
  name:               string | null;
  status:             string | null;
  ipv4:               string | null;
  ipv6:               string | null;
  location:           string | null;
  vcpu:               number | null;
  ramGb:              number | null;
  diskGb:             number | null;
};

function Sk({ w = "80%", h = 12 }: { w?: string; h?: number }) {
  return <span className="cy-shimmer" style={{ display: "inline-block", width: w, height: h, borderRadius: 3 }} />;
}

function StateBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  let color = "#9ca3af", bg = "#f9fafb", border = "#e5e7eb";
  if (s === "running")                                    { color = "#15803d"; bg = "#f0fdf4"; border = "#86efac"; }
  else if (s === "off" || s === "stopped")                { color = "#dc2626"; bg = "#fef2f2"; border = "#fecaca"; }
  else if (["starting","stopping","rebooting"].includes(s)){ color = "#b45309"; bg = "#fffbeb"; border = "#fcd34d"; }

  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "2px 8px", background: bg, color, border: `1px solid ${border}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {status && status !== "N/A" ? status : "N/A"}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const COLS = "minmax(150px,1.5fr) 140px 85px 130px 75px 150px 100px 95px 85px 105px";

// ─── Inline name cell ─────────────────────────────────────────────────────────
function ServerNameCell({ subscriptionId, serverName, provisioned, onSaved }: {
  subscriptionId: string;
  serverName: string | null;
  provisioned: boolean;
  onSaved: (name: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value,   setValue]   = useState(serverName ?? "");
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

  function cancel() { setValue(serverName ?? ""); setEditing(false); }

  if (editing) {
    return (
      <div style={{ paddingRight: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void save(); if (e.key === "Escape") cancel(); }}
            style={{ fontSize: 12, padding: "3px 7px", border: "1px solid #318774", outline: "none", fontFamily: "inherit", width: 140 }} />
          <button onClick={() => void save()} disabled={saving}
            style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", background: "#318774", color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
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
    <div style={{ paddingRight: 8 }}>
      {serverName ? (
        <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: 2 }}>
          {serverName}
        </div>
      ) : (
        <button onClick={() => setEditing(true)}
          style={{ fontSize: 11, color: "#318774", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "inherit", textDecoration: "underline", marginBottom: 2 }}>
          + Add name
        </button>
      )}
      {!provisioned && (
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Not provisioned</div>
      )}
    </div>
  );
}

export default function ServersClient() {
  const [loading, setLoading] = useState(true);
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch("/api/servers/me", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) { setError(data?.error ?? "Failed to load servers"); return; }
      setServers(data.data ?? []);
    } catch { setError("Network error while loading servers"); }
    finally  { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <>
      <style>{`
        @keyframes cy-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .cy-shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%);background-size:800px 100%;animation:cy-shimmer 1.4s ease-in-out infinite;}
        .cy-srv-row:hover{background:#f9fafb!important;}
      `}</style>

      <div className="cy-page-content">
        <div className="cy-dash-wrap">

          {/* Page title + actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 3 }}>DASHBOARD / SERVERS</p>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "#111827", margin: 0 }}>Cloud Servers</h1>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={() => void load()} disabled={loading}
                style={{ height: 36, padding: "0 14px", fontSize: 12, fontWeight: 600, background: "#fff", border: "1px solid #e5e7eb", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", color: "#374151", opacity: loading ? 0.6 : 1 }}>
                {loading ? "Loading…" : "↻ Refresh"}
              </button>
              <button disabled
                style={{ height: 36, padding: "0 16px", fontSize: 12, fontWeight: 600, background: colors.primary, color: "#fff", border: "none", cursor: "not-allowed", fontFamily: "inherit", opacity: 0.7 }}>
                + New Server
              </button>
            </div>
          </div>

          {/* Count */}
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#9ca3af" }}>
            {loading ? "Loading…" : `${servers.length} server${servers.length !== 1 ? "s" : ""}`}
          </p>

          {/* Error */}
          {error && (
            <div style={{ marginBottom: 16, padding: "10px 16px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Scrollable table */}
          <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as any, border: "1px solid #e5e7eb" }}>
            <div style={{ background: "#fff", minWidth: 1000 }}>

              {/* Header */}
              <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "0 12px", padding: "9px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                {[
                  { label: "Name"           },
                  { label: "Instance ID"    },
                  { label: "State"          },
                  { label: "Public IP"      },
                  { label: "Type"           },
                  { label: "Specs"          },
                  { label: "Location"       },
                  { label: "Created"        },
                  { label: "Payment"        },
                  { label: "Actions", right: true },
                ].map(h => (
                  <span key={h.label} style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: h.right ? "right" : "left" }}>
                    {h.label}
                  </span>
                ))}
              </div>

              {/* Skeletons */}
              {loading && [1,2,3].map(i => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: COLS, gap: "0 12px", padding: "14px 16px", borderBottom: "1px solid #f3f4f6", alignItems: "center", minWidth: 1000 }}>
                  <div><Sk w="60%" h={13} /><br /><Sk w="40%" h={10} /></div>
                  <Sk w="110px" h={12} />
                  <Sk w="50px" h={22} />
                  <Sk w="100px" h={12} />
                  <Sk w="60px" h={12} />
                  <Sk w="120px" h={12} />
                  <Sk w="60px" h={12} />
                  <Sk w="80px" h={12} />
                  <Sk w="50px" h={22} />
                  <Sk w="50px" h={28} />
                </div>
              ))}

              {/* Empty */}
              {!loading && servers.length === 0 && (
                <div style={{ padding: "48px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>No servers yet</div>
                  <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Server subscriptions will appear here once assigned.</div>
                </div>
              )}

              {/* Rows */}
              {!loading && servers.map((s, idx) => {
                const isLast      = idx === servers.length - 1;
                const isPaid      = s.paymentStatus === "PAID";
                const specs       = s.vcpu || s.ramGb
                  ? [s.vcpu ? `${s.vcpu} vCPU` : null, s.ramGb ? `${s.ramGb} GB RAM` : null].filter(Boolean).join(" · ")
                  : null;

                return (
                  <div key={s.subscriptionId} className="cy-srv-row"
                    style={{ display: "grid", gridTemplateColumns: COLS, gap: "0 12px", padding: "12px 16px", borderBottom: isLast ? "none" : "1px solid #f3f4f6", alignItems: "center", transition: "background 0.1s", minWidth: 1000 }}>

                    {/* Name */}
                    <ServerNameCell
                      subscriptionId={s.subscriptionId}
                      serverName={s.serverName ?? null}
                      provisioned={s.provisioned}
                      onSaved={(name) => {
                        setServers(prev => prev.map(r =>
                          r.subscriptionId === s.subscriptionId ? { ...r, serverName: name } : r
                        ));
                      }}
                    />

                    {/* Instance ID */}
                    <span style={{ fontSize: 11, fontFamily: "inherit", color: "#6b7280" }}>
                      ci-{s.subscriptionId.slice(-15)}
                    </span>

                    {/* State */}
                    <div><StateBadge status={s.provisioned ? s.status : "N/A"} /></div>

                    {/* Public IP */}
                    <span style={{ fontSize: 12, fontFamily: "inherit", color: "#374151" }}>
                      {s.ipv4 ?? "—"}
                    </span>

                    {/* Type */}
                    <span style={{ fontSize: 12, fontFamily: "inherit", color: "#374151", textTransform: "uppercase" }}>
                      {s.productKey}
                    </span>

                    {/* Specs */}
                    <span style={{ fontSize: 12, color: "#6b7280" }}>
                      {specs ?? "—"}
                    </span>

                    {/* Location */}
                    <span style={{ fontSize: 12.5, color: "#374151" }}>
                      {s.locationDisplay ?? s.locationCode ?? "—"}
                    </span>

                    {/* Created */}
                    <span style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                      {fmtDate(s.createdAt)}
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

                    {/* Actions */}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Link href={`/dashboard/servers/sub/${encodeURIComponent(s.subscriptionId)}`}
                        style={{ display: "inline-flex", alignItems: "center", fontSize: 12, fontWeight: 600, padding: "5px 12px", background: "#fff", color: colors.primary, border: `1px solid ${colors.primary}44`, textDecoration: "none" }}>
                        View
                      </Link>
                    </div>
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
