"use client";
// app/dashboard/network/NetworkClient.tsx

import { useEffect, useState } from "react";

type IpRow = {
  ip:         string;
  type:       "4" | "6";
  location:   string | null;
  role:       "Primary" | "Additional";
  reserved:   boolean;
  serverName: string;
};

export function NetworkClient() {
  const [rows,    setRows]    = useState<IpRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/customer/network", { cache: "no-store" });
      const j = await r.json().catch(() => null) as { ok?: boolean; data?: IpRow[]; error?: string } | null;
      if (!j?.ok) { setErr(j?.error ?? "Failed to load"); setRows([]); return; }
      setRows(j.data ?? []);
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="cy-dash-wrap" style={{ padding: 24 }}>
      {/* Breadcrumb + Title */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 3 }}>DASHBOARD / NETWORK</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "#111827", margin: 0 }}>Network &amp; Public IP</h1>
          <button onClick={() => void load()} disabled={loading}
            style={{ height: 34, padding: "0 14px", fontSize: 12, fontWeight: 600, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", color: "#374151", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Loading..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      <p style={{ margin: "0 0 16px", fontSize: 13, color: "#9ca3af" }}>
        {loading ? "Loading…" : `${rows.length} IP address${rows.length !== 1 ? "es" : ""}`}
      </p>

      {err && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", fontSize: 13, color: "#b91c1c" }}>
          {err}
        </div>
      )}

      <div style={{ border: "1px solid #f3f4f6", borderRadius: 8, overflowX: "auto", WebkitOverflowScrolling: "touch" as any, background: "#fff" }}>
        <table style={{ width: "100%", minWidth: 760, borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
              <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase" }}>IP Address</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase" }}>IP Type</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase" }}>Location</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase" }}>Role</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase" }}>IP Mode</th>
              <th style={{ textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase" }}>Attached Server</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>No IP addresses found for your active servers.</td></tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={`${row.ip}-${idx}`} style={{ borderBottom: idx < rows.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 600, color: "#111827", whiteSpace: "nowrap" }}>{row.ip}</td>
                  <td style={{ padding: "14px 16px", color: "#374151", whiteSpace: "nowrap" }}>IPv{row.type}</td>
                  <td style={{ padding: "14px 16px", color: "#374151", whiteSpace: "nowrap" }}>{row.location ?? "—"}</td>
                  <td style={{ padding: "14px 16px", color: "#374151", whiteSpace: "nowrap" }}>{row.role}</td>
                  <td style={{ padding: "14px 16px", color: "#374151", whiteSpace: "nowrap" }}>{row.reserved ? "Reserved" : "Not Reserved"}</td>
                  <td style={{ padding: "14px 16px", color: "#374151", whiteSpace: "nowrap" }}>{row.serverName}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 6, border: "1px solid #f3f4f6", background: "#fafafa", fontSize: 12, color: "#9ca3af" }}>
        Reserved IPs persist independently of the server. Primary IPs are tied to the server lifecycle.
      </div>
    </div>
  );
}
