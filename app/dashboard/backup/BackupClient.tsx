"use client";
// app/dashboard/backup/BackupClient.tsx

import { useEffect, useState } from "react";

type BackupRow = {
  serverName:  string;
  description: string;
  created:     string;
  sizeGb:      number | null;
  status:      string | null;
};

// ─── Design tokens (matching ServerDetailsClient.tsx) ──────────────────────
const C = {
  border:  "1px solid #e5e7eb",
  borderB: "1px solid #f3f4f6",
  bg:      "#ffffff",
  bgAlt:   "#f9fafb",
  text:    "#111827",
  muted:   "#6b7280",
  faint:   "#9ca3af",
};

function fmtDate(iso: string | null) {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatStatus(status: string | null): string {
  if (!status) return "N/A";
  const s = status.toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Card ────────────────────────────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: C.border, background: C.bg, marginBottom: 16 }}>
      <div style={{ padding: "10px 16px", borderBottom: C.border }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.faint, textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
      </div>
      <div>{children}</div>
    </div>
  );
}

// ─── Table ───────────────────────────────────────────────────────────────────
function T({ cols, rows, empty = "No data.", colWidths }: { cols: string[]; rows: (string | React.ReactNode)[][]; empty?: string; colWidths?: string[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: colWidths ? "fixed" : "auto" }}>
      {colWidths && (
        <colgroup>
          {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
        </colgroup>
      )}
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th key={i} style={{ padding: "8px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.faint, background: C.bgAlt, borderBottom: C.border, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr><td colSpan={cols.length} style={{ padding: "14px 16px", fontSize: 13, color: C.muted }}>{empty}</td></tr>
        )}
        {rows.map((row, i) => (
          <tr key={i}>
            {row.map((cell, j) => (
              <td key={j} style={{ padding: "9px 16px", color: C.text, borderBottom: i < rows.length - 1 ? C.borderB : "none", verticalAlign: "top" }}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Sk() {
  return <span style={{ display: "inline-block", width: 120, height: 12, background: "#f0f0f0", borderRadius: 2 }} />;
}

// ─── Btn ─────────────────────────────────────────────────────────────────────
function Btn({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ height: 32, padding: "0 14px", fontSize: 12, background: C.bg, border: C.border, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", color: C.text, opacity: disabled ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
      {children}
    </button>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────
export function BackupClient() {
  const [backups,   setBackups]   = useState<BackupRow[]>([]);
  const [snapshots, setSnapshots] = useState<BackupRow[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [err,       setErr]       = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/customer/backups", { cache: "no-store" });
      const j = await r.json().catch(() => null) as { ok?: boolean; backups?: BackupRow[]; snapshots?: BackupRow[]; error?: string } | null;
      if (!j?.ok) { setErr(j?.error ?? "Failed to load"); setBackups([]); setSnapshots([]); return; }
      setBackups(j.backups ?? []);
      setSnapshots(j.snapshots ?? []);
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const colWidths = ["18%", "32%", "20%", "15%", "15%"];

  return (
    <div className="cy-page-content">
      <div className="cy-dash-wrap">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          <div>
            <p style={{ fontSize: 11, color: C.faint, letterSpacing: ".05em", margin: "0 0 4px" }}>DASHBOARD / BACKUP</p>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Backup</h1>
          </div>
          <Btn onClick={() => void load()} disabled={loading}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>↻</span> Refresh
          </Btn>
        </div>

        {err && (
          <div style={{ marginBottom: 16, padding: "8px 14px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 }}>
            {err}
          </div>
        )}

        <Card title="Backups">
          {loading ? <div style={{ padding: 16 }}><Sk /></div> : (
            <T
              colWidths={colWidths}
              cols={["Server Name", "Description", "Created", "Size", "Status"]}
              rows={backups.map(b => [
                <span key="n" style={{ fontWeight: 600 }}>{b.serverName}</span>,
                b.description,
                fmtDate(b.created),
                b.sizeGb != null ? `${b.sizeGb} GB` : "N/A",
                formatStatus(b.status),
              ])}
              empty="No backups available."
            />
          )}
        </Card>

        <Card title="Snapshots">
          {loading ? <div style={{ padding: 16 }}><Sk /></div> : (
            <T
              colWidths={colWidths}
              cols={["Server Name", "Description", "Created", "Size", "Status"]}
              rows={snapshots.map(s => [
                <span key="n" style={{ fontWeight: 600 }}>{s.serverName}</span>,
                s.description,
                fmtDate(s.created),
                s.sizeGb != null ? `${s.sizeGb} GB` : "N/A",
                formatStatus(s.status),
              ])}
              empty="No snapshots available."
            />
          )}
        </Card>

      </div>
    </div>
  );
}
