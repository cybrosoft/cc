"use client";
// app/dashboard/servers/sub/[id]/ServerDetailsClient.tsx

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { colors } from "@/lib/ui/tokens";

// ─── Types ────────────────────────────────────────────────────────────────────
type FwRule = {
  _id: string; // stable client-side identity, never sent to API
  direction: "in" | "out";
  protocol: string;
  port: string | null;
  sourceIps: string[];
  destinationIps: string[];
  description: string | null; // used by Oracle Security Lists
};

type ServerDetail = {
  subscriptionId:     string;
  subscriptionStatus: string;
  paymentStatus:      string;
  billingPeriod:      string;
  periodEnd:          string | null;
  locationCode:       string | null;
  locationDisplay:    string | null;
  templateSlug:       string | null;
  templateDisplay:    string | null;
  productKey:         string;
  productName:        string;
  serverName:         string | null;
  os:                 string | null;
  createdAt:          string;
  serverId:           string | null;
  provider:           string | null;
  provisioned:        boolean;
  hetznerServerId:    string | null;
  oracleInstanceId:   string | null;
  oracleRegion:       string | null;
  status:             string | null;
  hostname:           string | null;
  ipv4:               string | null;
  ipv6:               string | null;
  location:           string | null;
  vcpu:               number | null;
  ramGb:              number | null;
  diskGb:             number | null;
  privateIp:          string | null;
  ipv4Reserved:       boolean | null;
  ipv6Reserved:       boolean | null;
  additionalIps:      string[];
  additionalDiskGb:   number | null;
  backups:            Array<{ id: number; type: string; description: string | null; created: string; status: string | null; sizeGb: number | null }>;
  snapshots:          Array<{ id: number; type: string; description: string | null; created: string; status: string | null; sizeGb: number | null }>;
  firewalls:          Array<{ id: number; name: string; rules: FwRule[] }>;
  privateNetworks:    Array<{ networkId: number; ip: string; aliasIps: string[]; macAddress: string | null }>;
  volumes:            Array<{ id: number; name: string; sizeGb: number | null; linuxDevice: string | null; format: string | null; status: string | null }>;
};

type Tab = "overview" | "network" | "backups" | "volumes";

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  border:    "1px solid #e5e7eb",
  borderB:   "1px solid #f3f4f6",
  bg:        "#ffffff",
  bgAlt:     "#f9fafb",
  text:      "#111827",
  muted:     "#6b7280",
  faint:     "#9ca3af",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function na(v: string | number | null | undefined) {
  return (v === null || v === undefined || v === "") ? "N/A" : String(v);
}
function fmtDate(iso: string | null) {
  if (!iso) return "N/A";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Badges ───────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  let color = C.muted, bg = C.bgAlt, border = "#e5e7eb";
  if (s === "running")                                       { color = "#15803d"; bg = "#f0fdf4"; border = "#86efac"; }
  else if (s === "off" || s === "stopped")                   { color = "#dc2626"; bg = "#fef2f2"; border = "#fecaca"; }
  else if (["starting","stopping","rebooting"].includes(s))  { color = "#b45309"; bg = "#fffbeb"; border = "#fcd34d"; }
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 10px", background: bg, color, border: `1px solid ${border}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {na(status)}
    </span>
  );
}

function PayBadge({ status }: { status: string | null }) {
  const s = (status ?? "").toLowerCase();
  let color = C.muted, bg = C.bgAlt, border = "#e5e7eb";
  if (s === "paid")   { color = "#15803d"; bg = "#f0fdf4"; border = "#86efac"; }
  if (s === "unpaid") { color = "#b45309"; bg = "#fffbeb"; border = "#fcd34d"; }
  if (s === "failed") { color = "#dc2626"; bg = "#fef2f2"; border = "#fecaca"; }
  return (
    <span style={{ display: "inline-block", fontSize: 11, fontWeight: 600, padding: "3px 10px", background: bg, color, border: `1px solid ${border}`, textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {na(status)}
    </span>
  );
}

// ─── Card = bordered section card ─────────────────────────────────────────────
function Card({ title, action, children }: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div style={{ border: C.border, background: C.bg, marginBottom: 16 }}>
      <div style={{ padding: "10px 16px", borderBottom: C.border, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.faint, textTransform: "uppercase", letterSpacing: "0.08em" }}>{title}</span>
        {action && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{action}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

// ─── InfoRow ─────────────────────────────────────────────────────────────────
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", borderBottom: C.borderB }}>
      <div style={{ width: 192, flexShrink: 0, padding: "9px 16px", background: C.bgAlt, borderRight: C.border, fontSize: 12, color: C.faint, fontWeight: 500 }}>{label}</div>
      <div style={{ flex: 1, padding: "9px 16px", fontSize: 13, color: C.text }}>{children}</div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function Sk() {
  return <span style={{ display: "inline-block", width: 120, height: 12, background: "#f0f0f0", borderRadius: 2 }} />;
}

// ─── Table = flush bordered table inside a Card ───────────────────────────────
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

// ─── Btn = small action button ────────────────────────────────────────────────
function Btn({ onClick, children, danger, disabled }: { onClick: () => void; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: "3px 10px", fontSize: 11, fontWeight: 500, fontFamily: "inherit", background: C.bg, border: C.border, color: danger ? "#dc2626" : C.text, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>
      {children}
    </button>
  );
}

// ─── Server Name edit (in table) ─────────────────────────────────────────────
function ServerNameEdit({ subscriptionId, serverName, onSaved }: {
  subscriptionId: string;
  serverName: string | null;
  onSaved: (name: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value,   setValue]   = useState(serverName ?? "");
  const [saving,  setSaving]  = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setValue(serverName ?? ""); }, [serverName]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

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

  if (editing) {
    return (
      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input ref={ref} value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") void save(); if (e.key === "Escape") setEditing(false); }}
          style={{ fontSize: 13, padding: "3px 8px", border: `1px solid ${colors.primary}`, outline: "none", fontFamily: "inherit", width: 180 }} />
        <Btn onClick={() => void save()} disabled={saving}>{saving ? "…" : "Save"}</Btn>
        <Btn onClick={() => setEditing(false)}>Cancel</Btn>
      </span>
    );
  }

  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span>{serverName ?? "—"}</span>
      <button onClick={() => setEditing(true)}
        style={{ fontSize: 12, color: colors.primary, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
        {serverName ? "Edit name" : "+ Add name"}
      </button>
    </span>
  );
}

// ─── Port Input with common-ports dropdown ────────────────────────────────────
const COMMON_PORTS: Array<{ port: string; label: string }> = [
  { port: "22",   label: "SSH"   },
  { port: "53",   label: "DNS"   },
  { port: "80",   label: "HTTP"  },
  { port: "443",  label: "HTTPS" },
  { port: "3306", label: "MYSQL" },
  { port: "5432", label: "PGSQL" },
];

function PortInput({ value, onChange, inputStyle }: {
  value: string;
  onChange: (v: string) => void;
  inputStyle: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const filtered = value.trim()
    ? COMMON_PORTS.filter(p =>
        p.port.startsWith(value.trim()) ||
        p.label.toLowerCase().startsWith(value.trim().toLowerCase())
      )
    : COMMON_PORTS;

  function pick(port: string) {
    onChange(port);
    setOpen(false);
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="e.g. 80 or 8000-9000"
          style={{ ...inputStyle, paddingRight: 24 }}
        />
        {/* chevron */}
        <span
          onClick={() => setOpen(o => !o)}
          style={{ position: "absolute", right: 7, top: "50%", transform: open ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)", fontSize: 9, color: C.faint, cursor: "pointer", userSelect: "none", lineHeight: 1 }}>
          ▼
        </span>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 200,
          background: C.bg, border: C.border,
          boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
          minWidth: 200, marginTop: 2,
        }}>
          {/* "any" row */}
          <div
            onMouseDown={() => pick("")}
            style={{
              padding: "8px 14px", fontSize: 13, cursor: "pointer", color: C.text,
              borderBottom: C.borderB,
              background: value === "" ? "#f0fdf4" : C.bg,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
            onMouseLeave={e => (e.currentTarget.style.background = value === "" ? "#f0fdf4" : C.bg)}
          >
            any
          </div>

          {/* common port rows */}
          {filtered.map(p => (
            <div
              key={p.port}
              onMouseDown={() => pick(p.port)}
              style={{
                padding: "7px 14px", fontSize: 13, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                borderBottom: C.borderB,
                background: value === p.port ? "#f0fdf4" : C.bg,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = value === p.port ? "#f0fdf4" : C.bg)}
            >
              <span style={{ color: C.text }}>{p.port}</span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 7px",
                background: "#f3f4f6", color: C.muted,
                border: "1px solid #e5e7eb", letterSpacing: "0.04em",
              }}>
                {p.label}
              </span>
            </div>
          ))}

          {/* empty filtered state */}
          {filtered.length === 0 && (
            <div style={{ padding: "8px 14px", fontSize: 12, color: C.faint }}>
              Custom port — press Enter or click away
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─── IP Input with checkbox multi-select dropdown ────────────────────────────
const COMMON_IPS = [
  { cidr: "0.0.0.0/0", label: "All IPv4" },
  { cidr: "::/0",      label: "All IPv6" },
];

function IpInput({ value, onChange, inputStyle, err, isOracle = false }: {
  value: string;
  onChange: (v: string) => void;
  inputStyle: React.CSSProperties;
  err?: string | null;
  isOracle?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const currentCidrs = value.split(",").map(s => s.trim()).filter(Boolean);
  const visibleIps = isOracle ? COMMON_IPS.filter(p => p.cidr !== "::/0") : COMMON_IPS;

  function toggle(cidr: string) {
    const next = currentCidrs.includes(cidr)
      ? currentCidrs.filter(c => c !== cidr)
      : [...currentCidrs, cidr];
    onChange(next.join(", "));
    // keep dropdown open so user can pick multiple
  }

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <input
          value={value}
          onChange={e => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="0.0.0.0/0, ::/0"
          style={{ ...inputStyle, paddingRight: 24 }}
        />
        <span
          onClick={() => setOpen(o => !o)}
          style={{ position: "absolute", right: 7, top: "50%", transform: open ? "translateY(-50%) rotate(180deg)" : "translateY(-50%)", fontSize: 9, color: C.faint, cursor: "pointer", userSelect: "none", lineHeight: 1 }}>
          ▼
        </span>
      </div>

      {open && (
        <div style={{
          position: "absolute", top: "100%", left: 0, zIndex: 200,
          background: C.bg, border: C.border,
          boxShadow: "0 4px 12px rgba(0,0,0,0.10)",
          minWidth: 240, marginTop: 2,
        }}>
          {visibleIps.map((p, i) => {
            const checked = currentCidrs.includes(p.cidr);
            return (
              <div
                key={p.cidr}
                onMouseDown={e => { e.preventDefault(); toggle(p.cidr); }}
                style={{
                  padding: "8px 14px", fontSize: 13, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 10,
                  borderBottom: i < visibleIps.length - 1 ? C.borderB : "none",
                  background: checked ? "#f0fdf4" : C.bg,
                  userSelect: "none",
                }}
                onMouseEnter={e => { if (!checked) e.currentTarget.style.background = "#f9fafb"; }}
                onMouseLeave={e => { e.currentTarget.style.background = checked ? "#f0fdf4" : C.bg; }}
              >
                {/* checkbox */}
                <span style={{
                  width: 15, height: 15, flexShrink: 0,
                  border: `1.5px solid ${checked ? "#318774" : "#d1d5db"}`,
                  background: checked ? "#318774" : C.bg,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                }}>
                  {checked && <span style={{ color: "#fff", fontSize: 10, lineHeight: 1, fontWeight: 700 }}>✓</span>}
                </span>
                <span style={{ fontFamily: "monospace", fontSize: 12, color: C.text, flex: 1 }}>{p.cidr}</span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: "2px 7px",
                  background: "#f3f4f6", color: C.muted,
                  border: "1px solid #e5e7eb", letterSpacing: "0.04em",
                }}>
                  {p.label}
                </span>
              </div>
            );
          })}
          <div style={{ padding: "7px 14px", borderTop: C.border, fontSize: 11, color: C.faint }}>
            Or type a custom IP / CIDR above
          </div>
        </div>
      )}
      {err && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>{err}</div>}
    </div>
  );
}


const PORT_TYPE_MAP: Record<string, string> = {
  "22":   "SSH",
  "53":   "DNS",
  "80":   "HTTP",
  "443":  "HTTPS",
  "3306": "MYSQL",
  "5432": "PGSQL",
};

function portTypeLabel(port: string | null): string | null {
  if (!port) return null;
  // exact match only (not ranges)
  return PORT_TYPE_MAP[port.trim()] ?? null;
}

function TypeBadge({ port }: { port: string | null }) {
  const label = portTypeLabel(port);
  if (!label) return <span style={{ color: C.faint }}>—</span>;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "2px 7px",
      background: "#f3f4f6", color: C.muted,
      border: "1px solid #e5e7eb", letterSpacing: "0.04em",
    }}>
      {label}
    </span>
  );
}

// ─── Firewall Tab ─────────────────────────────────────────────────────────────
const PROTOCOLS = ["tcp", "udp", "icmp", "esp", "gre"];

function emptyRule(direction: "in" | "out"): FwRule {
  return { _id: crypto.randomUUID(), direction, protocol: "tcp", port: "", sourceIps: [], destinationIps: [], description: null };
}

// New rule row — state lifted to RulesCard, no inline buttons
function NewRuleRow({ direction, newRule, setNewRule, err, isOracle = false }: {
  direction: "in" | "out";
  newRule: FwRule;
  setNewRule: (r: FwRule) => void;
  err: string | null;
  isOracle?: boolean;
}) {
  const showPort = !["icmp","esp","gre"].includes(newRule.protocol);
  const ips = direction === "in" ? newRule.sourceIps.join(", ") : newRule.destinationIps.join(", ");
  const inp: React.CSSProperties = { fontSize: 12, padding: "4px 8px", fontFamily: "inherit", border: C.border, outline: "none", width: "100%", background: C.bg, color: C.text, boxSizing: "border-box" as const };

  return (
    <tr style={{ background: "#f0fdf4" }}>
      <td style={{ padding: "8px 16px", borderBottom: C.borderB }}>
        <select value={newRule.protocol}
          onChange={e => setNewRule({ ...newRule, protocol: e.target.value, port: null })}
          style={{ ...inp, width: 90 }}>
          {PROTOCOLS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
        </select>
      </td>
      <td style={{ padding: "8px 16px", borderBottom: C.borderB }}>
        {showPort ? (
          <>
            <PortInput
              value={newRule.port ?? ""}
              onChange={v => setNewRule({ ...newRule, port: v })}
              inputStyle={inp}
            />
            <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>Enter a single port (80) or a port range (8000-9000)</div>
          </>
        ) : <span style={{ color: C.faint, fontSize: 12 }}>—</span>}
      </td>
      <td style={{ padding: "8px 16px", borderBottom: C.borderB }}>
        <IpInput
          value={ips}
          onChange={v => {
            const list = v.split(",").map(s => s.trim()).filter(Boolean);
            setNewRule({ ...newRule, sourceIps: direction === "in" ? list : [], destinationIps: direction === "out" ? list : [] });
          }}
          inputStyle={inp}
          err={err}
        />
        <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>Enter one or more IPs or CIDR ranges separated by commas, or pick from the list.</div>
      </td>
      <td style={{ padding: "8px 16px", borderBottom: C.borderB }}>
        {isOracle ? (
          <input value={newRule.description ?? ""}
            onChange={e => setNewRule({ ...newRule, description: e.target.value || null })}
            placeholder="Optional" style={inp} />
        ) : (
          <TypeBadge port={newRule.port ?? null} />
        )}
      </td>
      <td style={{ borderBottom: C.borderB }}></td>
    </tr>
  );
}

function RulesCard({ title, rules, direction, subscriptionId, allRules, setAllRules, onSaved, readOnly = false, provider }: {
  title: string;
  rules: FwRule[];
  direction: "in" | "out";
  subscriptionId: string;
  allRules: FwRule[];
  setAllRules: (r: FwRule[]) => void;
  onSaved: () => void;
  readOnly?: boolean;
  provider?: string | null;
}) {
  const [editing,    setEditing]    = useState(false);
  const [adding,     setAdding]     = useState(false);
  const [newRule,    setNewRule]    = useState<FwRule>(emptyRule(direction));
  const [newErr,     setNewErr]     = useState<string | null>(null);
  const [editVals,   setEditVals]   = useState<Record<string, FwRule>>({});
  const [confirmId,  setConfirmId]  = useState<string | null>(null);
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState<string | null>(null);
  const [msgOk,      setMsgOk]      = useState(true);

  const ipCol = direction === "in" ? "Source IPs" : "Destination IPs";

  function enterEdit() {
    const vals: Record<string, FwRule> = {};
    rules.forEach(r => { vals[r._id] = { ...r }; });
    setEditVals(vals);
    setEditing(true);
    setAdding(false);
  }
  function exitEdit() { setEditing(false); setAdding(false); setNewRule(emptyRule(direction)); setNewErr(null); setConfirmId(null); }

  function updateEditVal(id: string, field: keyof FwRule, value: unknown) {
    setEditVals(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  function applyEdits() {
    const updated = allRules.map(r => editVals[r._id] ? { ...editVals[r._id] } : r);
    setAllRules(updated);
    exitEdit();
  }

  function commitAdd() {
    const showPort = !["icmp","esp","gre"].includes(newRule.protocol);
    const ips = direction === "in" ? newRule.sourceIps : newRule.destinationIps;
    if (!ips.length) { setNewErr("At least one IP/CIDR required"); return; }
    if (showPort && !newRule.port?.trim()) { setNewErr("Port required"); return; }
    const updatedRules = [...allRules, newRule];
    setAllRules(updatedRules);
    setAdding(false);
    setNewRule(emptyRule(direction));
    setNewErr(null);
    void saveRules(updatedRules);
  }
  function cancelAdd() { setAdding(false); setNewRule(emptyRule(direction)); setNewErr(null); }
  function deleteRule(id: string) { const updated = allRules.filter(r => r._id !== id); setAllRules(updated); setConfirmId(null); void saveRules(updated); }

  async function saveRules(rulesToSave: FwRule[]) {
    setSaving(true); setMsg(null);
    const endpoint = provider === "ORACLE"
      ? `/api/customer/servers/${subscriptionId}/oracle-firewall`
      : `/api/customer/servers/${subscriptionId}/firewall`;
    try {
      const res  = await fetch(endpoint, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules: rulesToSave.map(({ _id, ...rest }) => rest) }),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok) { setMsgOk(true); setMsg("Saved."); onSaved(); exitEdit(); }
      else           { setMsgOk(false); setMsg(data?.error ?? "Failed."); }
    } catch { setMsgOk(false); setMsg("Network error."); }
    setSaving(false);
  }

  async function save() {
    const finalRules = editing
      ? allRules.map(r => editVals[r._id] ? { ...editVals[r._id] } : r)
      : allRules;
    if (editing) applyEdits();
    await saveRules(finalRules);
  }

  const inp: React.CSSProperties = { fontSize: 12, padding: "3px 7px", fontFamily: "inherit", border: C.border, outline: "none", width: "100%", background: C.bg, color: C.text, boxSizing: "border-box" as const };

  const action = (
    <>
      {msg && <span style={{ fontSize: 11, color: msgOk ? "#15803d" : "#dc2626" }}>{msg}</span>}
      {!editing && !adding && <Btn onClick={enterEdit}>Edit</Btn>}
      {editing && <Btn onClick={exitEdit}>Cancel</Btn>}
      {!editing && !adding && <Btn onClick={() => { setAdding(true); }}>+ Add Rule</Btn>}
      {adding && <Btn onClick={cancelAdd}>Cancel</Btn>}
      {adding && <Btn onClick={commitAdd}>Save Rule</Btn>}
      {editing && <Btn onClick={() => void save()} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Btn>}
    </>
  );

  const isOracle = provider === "ORACLE";
  const cols = ["Protocol", "Port Range", ipCol, isOracle ? "Description" : "Type", ""];

  return (
    <Card title={title} action={action}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "15%" }} />
          <col style={{ width: "25%" }} />
          <col style={{ width: "42%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "6%" }} />
        </colgroup>
        <thead>
          <tr>
            {cols.map((col, i) => (
              <th key={i} style={{ padding: "8px 16px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.faint, background: C.bgAlt, borderBottom: C.border, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {adding && (
            <NewRuleRow direction={direction} newRule={newRule} setNewRule={setNewRule} err={newErr} isOracle={isOracle} />
          )}
          {rules.length === 0 && !adding && (
            <tr><td colSpan={cols.length} style={{ padding: "14px 16px", fontSize: 13, color: C.muted }}>No rules.</td></tr>
          )}
          {rules.map((r, rowI) => {
            const isLast = rowI === rules.length - 1;
            const borderB = isLast && !adding ? "none" : C.borderB;
            if (editing) {
              const ev = editVals[r._id] ?? r;
              const showPort = !["icmp","esp","gre"].includes(ev.protocol);
              const ips = direction === "in" ? ev.sourceIps.join(", ") : ev.destinationIps.join(", ");
              return (
                <tr key={r._id} style={{ background: "#fffbeb" }}>
                  <td style={{ padding: "6px 16px", borderBottom: borderB }}>
                    <select value={ev.protocol} onChange={e => updateEditVal(r._id, "protocol", e.target.value)} style={{ ...inp, width: 80 }}>
                      {PROTOCOLS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "6px 16px", borderBottom: borderB }}>
                    {showPort ? (
                      <div>
                        <PortInput
                          value={ev.port ?? ""}
                          onChange={v => updateEditVal(r._id, "port", v)}
                          inputStyle={inp}
                        />
                        <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>Enter a single port (80) or a port range (8000-9000)</div>
                      </div>
                    ) : <span style={{ color: C.faint, fontSize: 12 }}>—</span>}
                  </td>
                  <td style={{ padding: "6px 16px", borderBottom: borderB }}>
                    <IpInput
                      value={ips}
                      onChange={v => {
                        const list = v.split(",").map(s => s.trim()).filter(Boolean);
                        updateEditVal(r._id, direction === "in" ? "sourceIps" : "destinationIps", list);
                      }}
                      inputStyle={inp}
                      isOracle={isOracle}
                    />
                    <div style={{ fontSize: 11, color: C.faint, marginTop: 3 }}>Enter one or more IPs or CIDR ranges separated by commas, or pick from the list.</div>
                  </td>
                  <td style={{ padding: "6px 16px", borderBottom: borderB }}>
                    {isOracle ? (
                      <input value={ev.description ?? ""}
                        onChange={e => updateEditVal(ev._id, "description", e.target.value || null)}
                        placeholder="Optional" style={inp} />
                    ) : (
                      <TypeBadge port={ev.port ?? null} />
                    )}
                  </td>
                  <td style={{ padding: "6px 16px", borderBottom: borderB, whiteSpace: "nowrap" as const }}>
                    {confirmId === r._id ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, color: C.muted }}>Delete?</span>
                        <Btn onClick={() => deleteRule(r._id)} danger>Yes</Btn>
                        <Btn onClick={() => setConfirmId(null)}>No</Btn>
                      </span>
                    ) : (
                      <Btn onClick={() => setConfirmId(r._id)} danger>Delete</Btn>
                    )}
                  </td>
                </tr>
              );
            }
            return (
              <tr key={r._id}>
                <td style={{ padding: "9px 16px", color: C.text, borderBottom: borderB }}>{r.protocol.toUpperCase()}</td>
                <td style={{ padding: "9px 16px", color: C.text, borderBottom: borderB }}>{r.port || "Any"}</td>
                <td style={{ padding: "9px 16px", color: C.text, borderBottom: borderB }}>{(direction === "in" ? r.sourceIps : r.destinationIps).join(", ") || "Any"}</td>
                <td style={{ padding: "9px 16px", borderBottom: borderB }}>{isOracle ? <span style={{ color: C.muted, fontSize: 12 }}>{r.description ?? "—"}</span> : <TypeBadge port={r.port ?? null} />}</td>
                <td style={{ borderBottom: borderB }}></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function FirewallTab({ subscriptionId, firewalls, loading, privateNetworks, onSaved, provider }: {
  subscriptionId: string;
  firewalls: Array<{ id: number; name: string; rules: FwRule[] }>;
  loading: boolean;
  privateNetworks: Array<{ networkId: number; ip: string; aliasIps: string[]; macAddress: string | null }>;
  onSaved: () => void;
  provider: string | null;
}) {
  const fw = firewalls[0] ?? null;
  function tagRules(raw: FwRule[]): FwRule[] {
    return raw.map(r => ({ ...r, _id: r._id || crypto.randomUUID() }));
  }
  const [rules, setRules] = useState<FwRule[]>(tagRules(fw?.rules ?? []));
  useEffect(() => { setRules(tagRules(fw?.rules ?? [])); }, [fw]);

  if (loading) return <Card title="Network & Firewall"><Sk /></Card>;
  if (!fw)     return <Card title="Network & Firewall"><div style={{ padding: "8px 0", fontSize: 13, color: C.muted }}>No firewall attached to this server.</div></Card>;

  const inbound  = rules.filter(r => r.direction === "in");
  const outbound = rules.filter(r => r.direction === "out");

  return (<>
    <RulesCard title="Inbound Rules"  rules={inbound}  direction="in"  subscriptionId={subscriptionId} allRules={rules} setAllRules={setRules} onSaved={onSaved} readOnly={false} provider={provider} />
    <RulesCard title="Outbound Rules" rules={outbound} direction="out" subscriptionId={subscriptionId} allRules={rules} setAllRules={setRules} onSaved={onSaved} readOnly={false} provider={provider} />
    <Card title="Private Networks">
      {!privateNetworks.length ? (
        <div style={{ padding: "14px 16px", fontSize: 13, color: C.muted }}>No private networks attached.</div>
      ) : (
        <T
          cols={["Network ID", "IP", "Alias IPs", "MAC Address"]}
          rows={privateNetworks.map(n => [
            provider === "ORACLE"
              ? (n.aliasIps[0] ?? "N/A")   // aliasIps[0] carries "NID-XXXX" for Oracle
              : String(n.networkId),
            n.ip,
            provider === "ORACLE" ? "N/A" : (n.aliasIps.join(", ") || "N/A"),
            n.macAddress ?? "N/A",
          ])}
        />
      )}
    </Card>
  </>);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ServerDetailsClient() {
  const params = useParams();
  const id     = String(params?.id ?? "");

  const [tab,         setTab]         = useState<Tab>("overview");
  const [loading,     setLoading]     = useState(true);
  const [server,      setServer]      = useState<ServerDetail | null>(null);
  const [restartBusy, setRestartBusy] = useState(false);
  const [restartMsg,  setRestartMsg]  = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res  = await fetch(`/api/servers/sub/${id}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data?.ok && data.server) setServer({
        ...data.server,
        backups:         data.server.backups         ?? [],
        snapshots:       data.server.snapshots       ?? [],
        firewalls:       data.server.firewalls       ?? [],
        privateNetworks: data.server.privateNetworks ?? [],
        volumes:         data.server.volumes         ?? [],
        additionalIps:   data.server.additionalIps   ?? [],
        ipv6Reserved:    data.server.ipv6Reserved    ?? null,
      });
    } catch { /**/ }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function restart() {
    if (!server?.serverId) return;
    if (!confirm("Restart this server?")) return;
    setRestartBusy(true); setRestartMsg(null);
    try {
      const res  = await fetch(`/api/servers/${server.serverId}/restart`, { method: "POST", cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (data?.ok) { setRestartMsg("Restart requested."); await load(); }
      else           setRestartMsg(data?.error ?? "Restart failed.");
    } catch { setRestartMsg("Network error."); }
    setRestartBusy(false);
  }

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
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          <div>
            {loading ? (
              <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: "0 0 8px" }}>Loading…</h1>
            ) : (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: 0 }}>
                    {server?.serverName || server?.productName || "Server"}
                  </h1>
                  <StatusBadge status={server?.provisioned ? server.status : "Not Provisioned"} />
                  {server?.paymentStatus !== "PAID" && <PayBadge status={server?.paymentStatus ?? null} />}
                </div>
                <p style={{ fontSize: 13, color: C.faint, margin: "4px 0 0" }}>Cloud Servers · ci-{id.slice(-15)}</p>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => void load()} disabled={loading}
              style={{ height: 32, padding: "0 14px", fontSize: 12, background: C.bg, border: C.border, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", color: C.text, opacity: loading ? 0.6 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>↻</span> Refresh
            </button>
            {server?.provisioned && (
              <button onClick={() => void restart()} disabled={restartBusy || loading}
                style={{ height: 32, padding: "0 14px", fontSize: 12, background: "#fef2f2", border: "1px solid #fecaca", cursor: "pointer", fontFamily: "inherit", color: "#dc2626", opacity: (restartBusy || loading) ? 0.6 : 1 }}>
                {restartBusy ? "Restarting…" : "Restart Server"}
              </button>
            )}
          </div>
        </div>

        {restartMsg && (
          <div style={{ marginBottom: 16, padding: "8px 14px", background: "#f0fdf4", border: "1px solid #86efac", color: "#15803d", fontSize: 13 }}>
            {restartMsg}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "1px solid #e5e7eb" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: "8px 16px", fontSize: 13, fontWeight: tab === t.id ? 600 : 400, background: "none", border: "none", borderBottom: `2px solid ${tab === t.id ? colors.primary : "transparent"}`, cursor: "pointer", fontFamily: "inherit", color: tab === t.id ? colors.primary : C.muted, marginBottom: -1 }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {tab === "overview" && (<>
          <Card title="Server Info">
            <InfoRow label="Server Name">
              {loading ? <Sk /> : <ServerNameEdit subscriptionId={id} serverName={server?.serverName ?? null} onSaved={(name) => setServer(prev => prev ? { ...prev, serverName: name } : prev)} />}
            </InfoRow>
            <InfoRow label="Instance ID">{loading ? <Sk /> : <span>ci-{id.slice(-15)}</span>}</InfoRow>
            <InfoRow label="Product">{loading ? <Sk /> : <span>{server?.productName ?? "N/A"}</span>}</InfoRow>
            <InfoRow label="Product Key">{loading ? <Sk /> : <span style={{ textTransform: "uppercase" }}>{na(server?.productKey)}</span>}</InfoRow>
            <InfoRow label="Location">{loading ? <Sk /> : <span>{server?.locationDisplay ?? server?.locationCode ?? "N/A"}</span>}</InfoRow>
            <InfoRow label="OS">{loading ? <Sk /> : <span>{server?.os ?? "N/A"}</span>}</InfoRow>
            <InfoRow label="OS Template">{loading ? <Sk /> : <span>{server?.templateDisplay ?? server?.templateSlug ?? "N/A"}</span>}</InfoRow>
          </Card>

          <Card title="Resources">
            <InfoRow label="vCPU">{loading ? <Sk /> : <span>{server?.vcpu != null ? `${server.vcpu} vCPU` : "N/A"}</span>}</InfoRow>
            <InfoRow label="RAM">{loading ? <Sk /> : <span>{server?.ramGb != null ? `${server.ramGb} GB` : "N/A"}</span>}</InfoRow>
            <InfoRow label="Boot Disk">{loading ? <Sk /> : <span>{server?.diskGb != null ? `${server.diskGb} GB` : "N/A"}</span>}</InfoRow>
            <InfoRow label="Additional Disk">{loading ? <Sk /> : <span>{server?.additionalDiskGb != null ? `${server.additionalDiskGb} GB` : "N/A"}</span>}</InfoRow>
          </Card>

          <Card title="Basic Network Details">
            <InfoRow label="Primary IPv4">{loading ? <Sk /> : <span>{na(server?.ipv4)}</span>}</InfoRow>
            <InfoRow label="Primary IPv4 Type">
              {loading ? <Sk /> : server?.ipv4Reserved === true
                ? <span>Reserved</span>
                : server?.ipv4Reserved === false
                  ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      Not Reserved
                      {!server?.additionalIps?.length && <>
                        <span title="This IP address is not reserved and may be lost if the server is rebuilt or terminated." style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: "50%", background: "#e5e7eb", color: "#374151", fontSize: 9, fontWeight: 700, cursor: "help" }}>!</span>
                        <span style={{ fontSize: 11, color: C.muted }}>This IP address is not reserved and may be lost if the server is rebuilt or terminated.</span>
                      </>}
                    </span>
                  : <span>N/A</span>
              }
            </InfoRow>
            {(loading || server?.ipv6) && (<>
              <InfoRow label="Primary IPv6">{loading ? <Sk /> : <span>{na(server?.ipv6)}</span>}</InfoRow>
              <InfoRow label="Primary IPv6 Type">
                {loading ? <Sk /> : server?.ipv6Reserved === true
                  ? <span>Reserved</span>
                  : server?.ipv6Reserved === false
                    ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        Not Reserved
                        {!server?.additionalIps?.length && <>
                          <span title="This IP address is not reserved and may be lost if the server is rebuilt or terminated." style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: "50%", background: "#e5e7eb", color: "#374151", fontSize: 9, fontWeight: 700, cursor: "help" }}>!</span>
                          <span style={{ fontSize: 11, color: C.muted }}>This IP address is not reserved and may be lost if the server is rebuilt or terminated.</span>
                        </>}
                      </span>
                    : <span>N/A</span>
                }
              </InfoRow>
            </>)}
            {(loading || server?.privateIp) && (
              <InfoRow label="Private IP">{loading ? <Sk /> : <span>{na(server?.privateIp)}</span>}</InfoRow>
            )}
            <InfoRow label="Additional IPs">
              {loading ? <Sk /> : server?.additionalIps?.length
                ? <span>{server.additionalIps.map((ip, i) => (
                    <span key={i} style={{ display: "block" }}>
                      {ip} <span style={{ fontSize: 11, color: C.faint }}>(Reserved · {ip.includes(":") ? "IPv6" : "IPv4"})</span>
                    </span>
                  ))}</span>
                : <span>N/A</span>
              }
            </InfoRow>
          </Card>

          <Card title="Billing">
            <InfoRow label="Payment">{loading ? <Sk /> : <PayBadge status={server?.paymentStatus ?? null} />}</InfoRow>
            <InfoRow label="Subscription Status">{loading ? <Sk /> : <span>{server?.subscriptionStatus?.replace(/_/g, " ") ?? "N/A"}</span>}</InfoRow>
            <InfoRow label="Billing Period">{loading ? <Sk /> : <span>{server?.billingPeriod?.replace(/_/g, " ") ?? "N/A"}</span>}</InfoRow>
            <InfoRow label="Period Ends">{loading ? <Sk /> : <span>{fmtDate(server?.periodEnd ?? null)}</span>}</InfoRow>
            <InfoRow label="Created">{loading ? <Sk /> : <span>{fmtDate(server?.createdAt ?? null)}</span>}</InfoRow>
          </Card>
        </>)}

        {/* Network & Firewall Tab */}
        {tab === "network" && (
          <FirewallTab
            subscriptionId={id}
            firewalls={server?.firewalls ?? []}
            loading={loading}
            privateNetworks={server?.privateNetworks ?? []}
            onSaved={() => void load()}
            provider={server?.provider ?? null}
          />
        )}

        {/* Backups Tab */}
        {tab === "backups" && (<>
          <Card title="Backups">
            {loading ? <div style={{ padding: 16 }}><Sk /></div> : (
              <T colWidths={["50%", "20%", "15%", "15%"]} cols={["Description", "Created", "Size", "Status"]}
                rows={server?.backups?.length ? server.backups.map(b => [b.description ?? "—", fmtDate(b.created), b.sizeGb != null ? `${b.sizeGb} GB` : "N/A", b.status ?? "N/A"]) : []}
                empty="No backups available." />
            )}
          </Card>
          <Card title="Snapshots">
            {loading ? <div style={{ padding: 16 }}><Sk /></div> : (
              <T colWidths={["50%", "20%", "15%", "15%"]} cols={["Description", "Created", "Size", "Status"]}
                rows={server?.snapshots?.length ? server.snapshots.map(s => [s.description ?? "—", fmtDate(s.created), s.sizeGb != null ? `${s.sizeGb} GB` : "N/A", s.status ?? "N/A"]) : []}
                empty="No snapshots available." />
            )}
          </Card>
        </>)}

        {/* Volumes Tab */}
        {tab === "volumes" && (
          <Card title="Additional Volumes">
            {loading ? <div style={{ padding: 16 }}><Sk /></div> : (
              <T cols={["Name", "Size", "Format", "Device", "Status"]}
                rows={server?.volumes?.length ? server.volumes.map(v => [v.name, v.sizeGb != null ? `${v.sizeGb} GB` : "N/A", v.format ?? "N/A", v.linuxDevice ?? "N/A", v.status ?? "N/A"]) : []}
                empty="No additional volumes attached." />
            )}
          </Card>
        )}

      </div>
    </div>
  );
}
