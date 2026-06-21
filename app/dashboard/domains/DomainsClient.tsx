"use client";
// app/dashboard/domains/DomainsClient.tsx

import { useEffect, useState } from "react";

type DomainRow = {
  subscriptionId: string;
  product:        string;
  resourceId:     string;
  domainName:     string | null;
  status:         string;
  billingPeriod:  string;
  createdAt:      string;
  periodEnd:      string | null;
  paymentStatus:  string;
};

const C = {
  border: "1px solid #e5e7eb",
  borderB: "1px solid #f3f4f6",
  bg: "#ffffff",
  bgAlt: "#f9fafb",
  text: "#111827",
  muted: "#6b7280",
  faint: "#9ca3af",
  primary: "#318774",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtPeriod(p: string) {
  return p.replace(/_/g, " ").replace(/\w\S*/g, t => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase());
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  let color = C.muted, bg = C.bgAlt, border = "#e5e7eb";
  if (s === "ACTIVE")          { color = "#15803d"; bg = "#f0fdf4"; border = "#86efac"; }
  else if (s === "PENDING_PAYMENT") { color = "#b45309"; bg = "#fffbeb"; border = "#fcd34d"; }
  else if (s === "SUSPENDED" || s === "EXPIRED") { color = "#dc2626"; bg = "#fef2f2"; border = "#fecaca"; }
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 10px", background: bg, color, border: `1px solid ${border}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {s.replace(/_/g, " ")}
    </span>
  );
}

function PayBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  let color = C.muted, bg = C.bgAlt, border = "#e5e7eb";
  if (s === "PAID")   { color = "#15803d"; bg = "#f0fdf4"; border = "#86efac"; }
  if (s === "UNPAID") { color = "#b45309"; bg = "#fffbeb"; border = "#fcd34d"; }
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 10px", background: bg, color, border: `1px solid ${border}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {s}
    </span>
  );
}

function Btn({ onClick, children, disabled }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ height: 32, padding: "0 14px", fontSize: 12, background: C.bg, border: C.border, cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit", color: C.text, opacity: disabled ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
      {children}
    </button>
  );
}

export function DomainsClient() {
  const [rows,    setRows]    = useState<DomainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err,     setErr]     = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await fetch("/api/customer/domains", { cache: "no-store" });
      const j = await r.json().catch(() => null) as { ok?: boolean; data?: DomainRow[]; error?: string } | null;
      if (!j?.ok) { setErr(j?.error ?? "Failed to load"); setRows([]); return; }
      setRows(j.data ?? []);
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const COLS = ["Domain Name", "Resource ID", "Type", "State", "Billing Period", "Created", "Expiry", "Payment"];

  return (
    <div className="cy-page-content">
      <div className="cy-dash-wrap">

        {/* Header */}
        <div style={{ marginBottom: 8 }}>
          <p style={{ fontSize: 11, color: C.faint, letterSpacing: ".05em", margin: "0 0 4px" }}>DASHBOARD / DOMAIN &amp; DNS</p>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>Domain &amp; DNS</h1>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={() => void load()} disabled={loading}>
                <span style={{ fontSize: 16, lineHeight: 1 }}>↻</span> Refresh
              </Btn>
              <button disabled
                style={{ height: 32, padding: "0 16px", fontSize: 12, fontWeight: 600, background: C.primary, border: "none", cursor: "not-allowed", fontFamily: "inherit", color: "#fff", opacity: 0.6 }}>
                + New Domain or DNS
              </button>
            </div>
          </div>
        </div>

        <p style={{ fontSize: 13, color: C.faint, margin: "0 0 16px" }}>
          {loading ? "Loading…" : `${rows.length} subscription${rows.length !== 1 ? "s" : ""}`}
        </p>

        {err && (
          <div style={{ marginBottom: 16, padding: "8px 14px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 }}>
            {err}
          </div>
        )}

        <div style={{ border: C.border, background: C.bg }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                {COLS.map((c, i) => (
                  <th key={i} style={{ padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.faint, background: C.bgAlt, borderBottom: C.border, letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={COLS.length} style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: C.faint }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={COLS.length} style={{ padding: "32px 16px", textAlign: "center", fontSize: 13, color: C.faint }}>No domain or DNS subscriptions yet.</td></tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={row.subscriptionId}>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: C.text, borderBottom: i < rows.length - 1 ? C.borderB : "none", whiteSpace: "nowrap" }}>{row.domainName ?? "—"}</td>
                    <td style={{ padding: "12px 16px", color: C.muted, borderBottom: i < rows.length - 1 ? C.borderB : "none", whiteSpace: "nowrap", fontFamily: "monospace", fontSize: 12 }}>{row.resourceId}</td>
                    <td style={{ padding: "12px 16px", color: C.text, borderBottom: i < rows.length - 1 ? C.borderB : "none", whiteSpace: "nowrap" }}>{row.product}</td>
                    <td style={{ padding: "12px 16px", borderBottom: i < rows.length - 1 ? C.borderB : "none" }}><StatusBadge status={row.status} /></td>
                    <td style={{ padding: "12px 16px", color: C.text, borderBottom: i < rows.length - 1 ? C.borderB : "none", whiteSpace: "nowrap" }}>{fmtPeriod(row.billingPeriod)}</td>
                    <td style={{ padding: "12px 16px", color: C.muted, borderBottom: i < rows.length - 1 ? C.borderB : "none", whiteSpace: "nowrap" }}>{fmtDate(row.createdAt)}</td>
                    <td style={{ padding: "12px 16px", color: C.muted, borderBottom: i < rows.length - 1 ? C.borderB : "none", whiteSpace: "nowrap" }}>{fmtDate(row.periodEnd)}</td>
                    <td style={{ padding: "12px 16px", borderBottom: i < rows.length - 1 ? C.borderB : "none" }}><PayBadge status={row.paymentStatus} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}