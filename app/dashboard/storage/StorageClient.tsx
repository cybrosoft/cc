"use client";
// app/dashboard/storage/StorageClient.tsx

import { useEffect, useState } from "react";

type StorageRow = {
  serverName: string;
  sizeGb:     number | null;
  location:   string | null;
  status:     string | null;
};

const thStyle: React.CSSProperties = { textAlign: "left", padding: "12px 16px", fontSize: 11, fontWeight: 700, color: "#9ca3af", letterSpacing: "0.05em", textTransform: "uppercase" };
const tdStyle: React.CSSProperties = { padding: "14px 16px", color: "#374151", whiteSpace: "nowrap" };

function StorageTable({ title, rows, loading, emptyText }: { title: string; rows: StorageRow[]; loading: boolean; emptyText: string }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 600, color: "#111827" }}>{title}</p>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#9ca3af" }}>
        {loading ? "Loading…" : `${rows.length} item${rows.length !== 1 ? "s" : ""}`}
      </p>

      <div style={{ border: "1px solid #f3f4f6", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#fafafa", borderBottom: "1px solid #f3f4f6" }}>
              <th style={thStyle}>Server Name</th>
              <th style={thStyle}>Size</th>
              <th style={thStyle}>Location</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>{emptyText}</td></tr>
            ) : (
              rows.map((row, idx) => (
                <tr key={`${row.serverName}-${idx}`} style={{ borderBottom: idx < rows.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: "#111827" }}>{row.serverName}</td>
                  <td style={tdStyle}>{row.sizeGb != null ? `${row.sizeGb} GB` : "—"}</td>
                  <td style={tdStyle}>{row.location ?? "—"}</td>
                  <td style={tdStyle}>{row.status ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function StorageClient() {
  const [boot,    setBoot]    = useState<StorageRow[]>([]);
  const [volumes, setVolumes] = useState<StorageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/customer/storage", { cache: "no-store" });
      const j = await r.json().catch(() => null) as { ok?: boolean; boot?: StorageRow[]; volumes?: StorageRow[]; error?: string } | null;
      if (!j?.ok) { setErr(j?.error ?? "Failed to load"); setBoot([]); setVolumes([]); return; }
      setBoot(j.boot ?? []);
      setVolumes(j.volumes ?? []);
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
        <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 3 }}>DASHBOARD / STORAGE</p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "#111827", margin: 0 }}>Storage</h1>
          <button onClick={() => void load()} disabled={loading}
            style={{ height: 34, padding: "0 14px", fontSize: 12, fontWeight: 600, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", color: "#374151", opacity: loading ? 0.6 : 1 }}>
            {loading ? "Loading..." : "↻ Refresh"}
          </button>
        </div>
      </div>

      {err && (
        <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 6, border: "1px solid #fecaca", background: "#fef2f2", fontSize: 13, color: "#b91c1c" }}>
          {err}
        </div>
      )}

      <StorageTable title="Boot Disks" rows={boot} loading={loading} emptyText="No boot disks found for your active servers." />
      <StorageTable title="Additional Storage" rows={volumes} loading={loading} emptyText="No additional storage volumes found." />
    </div>
  );
}
