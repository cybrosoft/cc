"use client";
// app/dashboard/servers/[id]/ServerDetailsClient.tsx

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { colors } from "@/lib/ui/tokens";

type ServerDetail = {
  id:                 string;
  subscriptionId:     string | null;
  hetznerServerId:    string | null;
  provider:           string;
  productKey:         string | null;
  productName:        string | null;
  paymentStatus:      string | null;
  subscriptionStatus: string | null;
  billingPeriod:      string | null;
  periodEnd:          string | null;
  locationCode:       string | null;
  templateSlug:       string | null;
  serverName:         string | null;
  name:               string | null;
  status:             string | null;
  ipv4:               string | null;
  ipv6:               string | null;
  location:           string | null;
  vcpu:               number | null;
  ramGb:              number | null;
  diskGb:             number | null;
  createdAt:          string;
  updatedAt:          string;
};

type Tab = "overview" | "backups" | "network" | "volumes";

function na(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "N/A";
  return String(v);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  let color = "#6b7280", bg = "#f3f4f6", border = "#e5e7eb";
  if (s === "running")                               { color = "#15803d"; bg = "#f0fdf4"; border = "#86efac"; }
  else if (s === "off" || s === "stopped")           { color = "#dc2626"; bg = "#fef2f2"; border = "#fecaca"; }
  else if (["starting","stopping","rebooting"].includes(s)) { color = "#b45309"; bg = "#fffbeb"; border = "#fcd34d"; }

  return (
    <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 600, padding: "3px 10px", background: bg, color, border: `1px solid ${border}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {na(status)}
    </span>
  );
}

function PayBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  let color = "#6b7280", bg = "#f3f4f6", border = "#e5e7eb";
  if (s === "paid")   { color = "#15803d"; bg = "#f0fdf4"; border = "#86efac"; }
  if (s === "unpaid") { color = "#b45309"; bg = "#fffbeb"; border = "#fcd34d"; }
  if (s === "failed") { color = "#dc2626"; bg = "#fef2f2"; border = "#fecaca"; }
  return (
    <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 600, padding: "3px 10px", background: bg, color, border: `1px solid ${border}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {na(status)}
    </span>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid #f3f4f6", padding: "10px 0" }}>
      <span style={{ width: 160, flexShrink: 0, fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: "#111827", fontWeight: 400 }}>{children}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", marginBottom: 16 }}>
      <div style={{ padding: "12px 20px", borderBottom: "1px solid #e5e7eb", fontSize: 12, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {title}
      </div>
      <div style={{ padding: "4px 20px 10px" }}>
        {children}
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <span style={{ display: "inline-block", width: 120, height: 12, background: "#f0f0f0", borderRadius: 3 }} />
  );
}

// ─── Inline name edit for detail page ─────────────────────────────────────────
function ServerNameInline({ serverId, subscriptionId, serverName, fallback, onSaved }: {
  serverId: string | null;
  subscriptionId: string | null;
  serverName: string | null;
  fallback: string;
  onSaved: (name: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value,   setValue]   = useState(serverName ?? "");
  const [saving,  setSaving]  = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setValue(serverName ?? ""); }, [serverName]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  async function save() {
    if (!subscriptionId) return;
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
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") void save(); if (e.key === "Escape") cancel(); }}
            style={{ fontSize: 20, fontWeight: 700, padding: "4px 10px", border: "2px solid #318774", outline: "none", fontFamily: "inherit", width: 260 }} />
          <button onClick={() => void save()} disabled={saving}
            style={{ fontSize: 12, fontWeight: 600, padding: "5px 14px", background: "#318774", color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {saving ? "…" : "Save"}
          </button>
          <button onClick={cancel}
            style={{ fontSize: 12, padding: "5px 10px", background: "none", border: "1px solid #e5e7eb", cursor: "pointer", fontFamily: "inherit", color: "#6b7280" }}>
            Cancel
          </button>
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af" }}>Enter to save · Esc to cancel</div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>
        {serverName || fallback}
      </h1>
      {subscriptionId && (
        <button onClick={() => setEditing(true)}
          title={serverName ? "Edit name" : "Add name"}
          style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 4px", opacity: 0.5, fontSize: 14, lineHeight: 1 }}>
          ✏️
        </button>
      )}
      {!serverName && subscriptionId && (
        <button onClick={() => setEditing(true)}
          style={{ fontSize: 12, color: "#318774", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", padding: 0 }}>
          + Add name
        </button>
      )}
    </div>
  );
}

export default function ServerDetailsClient() {
  const params = useParams();
  const router = useRouter();
  const id     = useMemo(() => String(params?.id ?? ""), [params]);

  const [tab,         setTab]         = useState<Tab>("overview");
  const [loading,     setLoading]     = useState(true);
  const [server,      setServer]      = useState<ServerDetail | null>(null);
  const [restartBusy, setRestartBusy] = useState(false);
  const [restartMsg,  setRestartMsg]  = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/servers/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data?.ok && data.server) setServer(data.server);
    } catch { /**/ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function restart() {
    if (!confirm("Restart this server?")) return;
    setRestartBusy(true); setRestartMsg(null);
    try {
      const res  = await fetch(`/api/servers/${encodeURIComponent(id)}/restart`, { method: "POST", cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        setRestartMsg("Restart requested successfully.");
        await load();
      } else {
        setRestartMsg(data?.error ?? "Restart failed.");
      }
    } catch { setRestartMsg("Network error."); }
    setRestartBusy(false);
  }

  const V = (v: string | number | null | undefined) =>
    loading ? <Skeleton /> : <span style={{ fontFamily: typeof v === "string" && /^\d{1,3}\.\d/.test(v) ? "monospace" : "inherit" }}>{na(v)}</span>;

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview"           },
    { id: "network",  label: "Network & Firewall" },
    { id: "backups",  label: "Backups"            },
    { id: "volumes",  label: "Additional Volumes" },
  ];

  return (
    <div className="cy-page-content">
      <div className="cy-dash-wrap">

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <Link href="/dashboard/servers" style={{ fontSize: 12, color: "#6b7280", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
            ← Cloud Servers
          </Link>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {loading ? (
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Loading…</h1>
              ) : (
                <ServerNameInline
                  serverId={server?.id ?? null}
                  subscriptionId={server?.subscriptionId ?? null}
                  serverName={server?.serverName ?? null}
                  fallback={server?.productName ?? "Server"}
                  onSaved={(name) => setServer(prev => prev ? { ...prev, serverName: name } : prev)}
                />
              )}
              {!loading && <StatusBadge status={server?.status ?? null} />}
              {!loading && <PayBadge status={server?.paymentStatus ?? null} />}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => void load()} disabled={loading}
                style={{ height: 34, padding: "0 14px", fontSize: 12, fontWeight: 600, background: "#fff", border: "1px solid #e5e7eb", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", color: "#374151", opacity: loading ? 0.6 : 1 }}>
                ↻ Refresh
              </button>
              <button onClick={() => void restart()} disabled={restartBusy || loading}
                style={{ height: 34, padding: "0 14px", fontSize: 12, fontWeight: 600, background: "#fef2f2", border: "1px solid #fecaca", cursor: (restartBusy || loading) ? "not-allowed" : "pointer", fontFamily: "inherit", color: "#dc2626", opacity: (restartBusy || loading) ? 0.6 : 1 }}>
                {restartBusy ? "Restarting…" : "Restart Server"}
              </button>
            </div>
          </div>
          {restartMsg && (
            <div style={{ marginTop: 10, padding: "8px 14px", background: "#f0fdf4", border: "1px solid #86efac", color: "#15803d", fontSize: 13 }}>
              {restartMsg}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #e5e7eb", paddingBottom: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{
                padding: "8px 16px", fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                color: tab === t.id ? colors.primary : "#6b7280",
                borderBottom: `2px solid ${tab === t.id ? colors.primary : "transparent"}`,
                marginBottom: -1,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === "overview" && (
          <>
            <Section title="Server Info">
              <InfoRow label="Server Name">{loading ? <Skeleton /> : <span>{server?.serverName ?? "—"}</span>}</InfoRow>
              <InfoRow label="Product">{V(server?.productName)}</InfoRow>
              <InfoRow label="Product Key">{V(server?.productKey)}</InfoRow>
              <InfoRow label="Provider">{V(server?.provider)}</InfoRow>
              <InfoRow label="Provider ID">{V(server?.hetznerServerId)}</InfoRow>
              <InfoRow label="Location">{V(server?.location ?? server?.locationCode)}</InfoRow>
              <InfoRow label="OS Template">{V(server?.templateSlug)}</InfoRow>
            </Section>

            <Section title="Resources">
              <InfoRow label="vCPU">{loading ? <Skeleton /> : <span>{server?.vcpu != null ? `${server.vcpu} vCPU` : "N/A"}</span>}</InfoRow>
              <InfoRow label="RAM">{loading ? <Skeleton /> : <span>{server?.ramGb != null ? `${server.ramGb} GB` : "N/A"}</span>}</InfoRow>
              <InfoRow label="Disk">{loading ? <Skeleton /> : <span>{server?.diskGb != null ? `${server.diskGb} GB` : "N/A"}</span>}</InfoRow>
            </Section>

            <Section title="Network">
              <InfoRow label="IPv4">{V(server?.ipv4)}</InfoRow>
              <InfoRow label="IPv6">{V(server?.ipv6)}</InfoRow>
            </Section>

            <Section title="Billing">
              <InfoRow label="Payment Status"><PayBadge status={server?.paymentStatus ?? null} /></InfoRow>
              <InfoRow label="Subscription Status">{V(server?.subscriptionStatus?.replace(/_/g, " "))}</InfoRow>
              <InfoRow label="Billing Period">{V(server?.billingPeriod?.replace(/_/g, " "))}</InfoRow>
              <InfoRow label="Period Ends">{loading ? <Skeleton /> : <span>{fmtDate(server?.periodEnd ?? null)}</span>}</InfoRow>
            </Section>
          </>
        )}

        {/* Network Tab */}
        {tab === "network" && (
          <Section title="Network & Firewall">
            <div style={{ padding: "24px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              Firewall rules and private network details coming soon.
            </div>
          </Section>
        )}

        {/* Backups Tab */}
        {tab === "backups" && (
          <Section title="Backups & Snapshots">
            <div style={{ padding: "24px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              Backup and snapshot management coming soon.
            </div>
          </Section>
        )}

        {/* Volumes Tab */}
        {tab === "volumes" && (
          <Section title="Additional Volumes">
            <div style={{ padding: "24px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
              Attached volumes will appear here.
            </div>
          </Section>
        )}

      </div>
    </div>
  );
}
