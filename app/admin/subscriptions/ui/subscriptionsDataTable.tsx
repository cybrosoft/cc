"use client";
// app/admin/subscriptions/ui/subscriptionsDataTable.tsx
// Expandable-row design — click row to expand inline panel with tabs

import { useState } from "react";
import type { SubRow } from "../subscriptionsTableTypes";
import { CLR } from "@/components/ui/admin-ui";
import {
  daysUntil,
  fmtDate,
  fmtDateInput,
  isoFromDateInput,
  isRecord,
  readBoolean,
  readString,
} from "./subscriptionsUtils";

// ─── Design tokens ────────────────────────────────────────────────────────────
const B = CLR.border;
const BL = "#f3f4f6";

const inp: React.CSSProperties = {
  padding: "6px 10px", fontSize: 12, fontFamily: "inherit",
  background: "#fff", border: `1px solid ${B}`, color: "#111827",
  outline: "none", width: "100%", boxSizing: "border-box" as const,
};

function btn(variant: "primary" | "default" | "danger" | "ghost" = "default"): React.CSSProperties {
  return {
    padding: "6px 14px", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
    cursor: "pointer", border: "1px solid",
    background:
      variant === "primary" ? CLR.primary
      : variant === "danger"  ? "#dc2626"
      : variant === "ghost"   ? "transparent"
      : "#fff",
    color:
      variant === "primary" ? "#fff"
      : variant === "danger"  ? "#fff"
      : variant === "ghost"   ? CLR.muted
      : CLR.text,
    borderColor:
      variant === "primary" ? CLR.primary
      : variant === "danger"  ? "#dc2626"
      : variant === "ghost"   ? "transparent"
      : B,
  };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: CLR.faint, textTransform: "uppercase", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function InfoBox({ color = CLR.primaryBg, border = CLR.primary, icon, children }: {
  color?: string; border?: string; icon?: string; children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "10px 12px", background: color, border: `1px solid ${border}`, marginBottom: 10 }}>
      {icon && <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>}
      <div style={{ fontSize: 11, color: CLR.text, lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

// ─── Badge helpers ────────────────────────────────────────────────────────────
const SUB_STATUS_MAP: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  ACTIVE:           { bg: "#dcfce7", color: "#15803d", dot: "#16a34a",  label: "Active" },
  PENDING_PAYMENT:  { bg: "#fef9c3", color: "#854d0e", dot: "#ca8a04",  label: "Pending Payment" },
  PENDING_EXTERNAL: { bg: "#dbeafe", color: "#1e40af", dot: "#3b82f6",  label: "Pending External" },
  CANCELED:         { bg: "#f3f4f6", color: "#6b7280", dot: "#9ca3af",  label: "Cancelled" },
};

function SubStatusBadge({ status }: { status: string }) {
  const c = SUB_STATUS_MAP[status] ?? SUB_STATUS_MAP.CANCELED;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", background: c.bg, color: c.color, border: `1px solid ${c.dot}33`, fontSize: 11, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {c.label}
    </span>
  );
}

const PAY_MAP: Record<string, { bg: string; color: string; icon: string }> = {
  PAID:   { bg: "#dcfce7", color: "#15803d", icon: "✓" },
  UNPAID: { bg: "#fee2e2", color: "#991b1b", icon: "○" },
  FAILED: { bg: "#fee2e2", color: "#991b1b", icon: "✗" },
};

function PayBadge({ status }: { status: string }) {
  const c = PAY_MAP[status] ?? PAY_MAP.UNPAID;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", background: c.bg, color: c.color, border: `1px solid ${c.color}33`, fontSize: 11, fontWeight: 600 }}>
      {c.icon} {status}
    </span>
  );
}

const TYPE_MAP: Record<string, { bg: string; color: string; border: string }> = {
  plan:    { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  addon:   { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  service: { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  product: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
};

function TypeBadge({ type }: { type: string }) {
  const s = TYPE_MAP[type] ?? TYPE_MAP.plan;
  return (
    <span style={{ display: "inline-flex", padding: "2px 7px", background: s.bg, color: s.color, border: `1px solid ${s.border}`, fontSize: 10, fontWeight: 700, letterSpacing: "0.03em" }}>
      {type.toUpperCase()}
    </span>
  );
}

function getServerTag(sub: SubRow): { label: string; icon: string; color: string; bg: string; border: string } | null {
  const catKey = sub.product.category?.key ?? "";
  if (catKey === "servers-o") return { label: "Server", icon: "🗄️", color: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe" };
  if (catKey === "servers-g") return { label: "VPS",    icon: "🖥️", color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" };
  return null;
}

function isOneTime(sub: SubRow): boolean {
  // ONE_TIME billing period - no period dates
  return !sub.currentPeriodStart && !sub.currentPeriodEnd && sub.status === "ACTIVE";
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────
function BillingTab({ sub, onChanged }: { sub: SubRow; onChanged: () => void }) {
  const oneTime = isOneTime(sub);
  const [start,      setStart]      = useState(fmtDateInput(sub.currentPeriodStart));
  const [end,        setEnd]        = useState(fmtDateInput(sub.currentPeriodEnd));
  const [payDate,    setPayDate]    = useState(fmtDateInput(sub.activatedAt));
  const [busy,       setBusy]       = useState(false);
  const [msg,        setMsg]        = useState<string | null>(null);
  const [saved,      setSaved]      = useState(false);

  const d = daysUntil(sub.currentPeriodEnd);
  const urgent = !oneTime && sub.status === "ACTIVE" && d !== null && d <= 30;

  async function handleSave() {
    setBusy(true); setMsg(null);
    try {
      const body: Record<string, unknown> = {
        subscriptionId: sub.id,
        currentPeriodStart: isoFromDateInput(start),
        currentPeriodEnd: isoFromDateInput(end),
        activatedAt: isoFromDateInput(payDate) ?? undefined,
      };
      const r = await fetch("/api/admin/subscriptions/approve-manual", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null) as unknown;
      if (!r.ok || !isRecord(j) || !readBoolean(j, "ok")) {
        setMsg(isRecord(j) ? (readString(j, "error") ?? "Save failed") : "Save failed");
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onChanged();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  async function handleUploadReceipt(file: File) {
    setBusy(true); setMsg(null);
    try {
      const fd = new FormData();
      fd.append("subscriptionId", sub.id);
      fd.append("file", file);
      const r = await fetch("/api/admin/subscriptions/upload-receipt", { method: "POST", body: fd });
      const j = await r.json().catch(() => null) as unknown;
      if (!r.ok || !isRecord(j) || !readBoolean(j, "ok")) {
        setMsg(isRecord(j) ? (readString(j, "error") ?? "Upload failed") : "Upload failed");
        return;
      }
      onChanged();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {urgent && (
        <InfoBox color="#fef9c3" border="#ca8a04" icon="⚠️">
          <strong>Renewal due in {d} day{d !== 1 ? "s" : ""}</strong>
          <div style={{ color: CLR.muted, marginTop: 2 }}>Once payment received, set new end date and click Save.</div>
        </InfoBox>
      )}
      {oneTime && (
        <InfoBox color="#f9fafb" border={B} icon="🏷️">
          <strong>One-time payment product</strong>
          <div style={{ color: CLR.muted, marginTop: 2 }}>No subscription period — record payment date only.</div>
        </InfoBox>
      )}

      {/* Period progress */}
      {!oneTime && sub.currentPeriodStart && sub.currentPeriodEnd && (() => {
        const total = new Date(sub.currentPeriodEnd).getTime() - new Date(sub.currentPeriodStart).getTime();
        const elapsed = Date.now() - new Date(sub.currentPeriodStart).getTime();
        const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
        const barColor = pct > 90 ? "#dc2626" : pct > 70 ? "#ca8a04" : CLR.primary;
        return (
          <div style={{ padding: "12px 14px", background: "#f9fafb", border: `1px solid ${B}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <SectionLabel>Current Period</SectionLabel>
              {d !== null && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", background: d <= 7 ? "#fee2e2" : d <= 30 ? "#fef9c3" : "#dcfce7", color: d <= 7 ? "#991b1b" : d <= 30 ? "#854d0e" : "#15803d" }}>
                  {d}d remaining
                </span>
              )}
            </div>
            <div style={{ height: 4, background: BL, marginBottom: 6 }}>
              <div style={{ height: 4, width: `${pct}%`, background: barColor, transition: "width 0.3s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: CLR.faint }}>
              <span>{fmtDate(sub.currentPeriodStart)}</span>
              <span>{fmtDate(sub.currentPeriodEnd)}</span>
            </div>
          </div>
        );
      })()}

      {/* Date inputs */}
      <div style={{ padding: "12px 14px", background: "#f9fafb", border: `1px solid ${B}` }}>
        <SectionLabel>{oneTime ? "Payment Record" : "Update Billing"}</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: oneTime ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
          {!oneTime && (
            <div>
              <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>Start Date</div>
              <input type="date" value={start} onChange={e => setStart(e.target.value)} disabled={busy} style={inp} />
            </div>
          )}
          {!oneTime && (
            <div>
              <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>End Date</div>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)} disabled={busy} style={inp} />
            </div>
          )}
          <div>
            <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>Payment Date</div>
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} disabled={busy} style={inp} />
          </div>
        </div>

        {/* Receipt */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: `1px solid ${BL}` }}>
          <span style={{ fontSize: 11, color: CLR.muted }}>Receipt:</span>
          <label style={{ ...btn(), cursor: "pointer", fontSize: 11, padding: "4px 10px" }}>
            {sub.receiptUrl ? "Re-upload" : "Upload PDF"}
            <input type="file" style={{ display: "none" }} accept=".pdf,.png,.jpg" disabled={busy}
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void handleUploadReceipt(f); }} />
          </label>
          {sub.receiptUrl
            ? <a href={sub.receiptUrl} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: CLR.primary }}>View PDF ↗</a>
            : <span style={{ fontSize: 11, color: CLR.faint }}>No receipt yet</span>}
        </div>
      </div>

      {msg && <div style={{ fontSize: 11, color: "#dc2626", padding: "6px 10px", background: "#fef2f2", border: "1px solid #fca5a5" }}>{msg}</div>}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: CLR.faint }}>Saving updates the subscription period and records payment.</span>
        <button style={{ ...btn("primary"), opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void handleSave()}>
          {saved ? "✓ Saved" : busy ? "Saving…" : sub.status === "ACTIVE" ? "Update & Save" : "Approve & Activate"}
        </button>
      </div>
    </div>
  );
}

// ─── VPS Tab ──────────────────────────────────────────────────────────────────
function VpsTab({ sub, onChanged }: { sub: SubRow; onChanged: () => void }) {
  const tag = getServerTag(sub);
  const catKey = sub.product.category?.key ?? "";
  const isOracle  = catKey === "servers-o";
  const isHetzner = catKey === "servers-g";

  const existingHetzner = sub.servers.find(x => x.hetznerServerId)?.hetznerServerId ?? "";
  const [serverId,  setServerId]  = useState(existingHetzner);
  const [token,     setToken]     = useState("");
  const [busy,      setBusy]      = useState(false);
  const [msg,       setMsg]       = useState<string | null>(null);
  const [saved,     setSaved]     = useState(false);

  if (!tag) return null;

  async function handleSave() {
    setBusy(true); setMsg(null);
    try {
      const body: Record<string, unknown> = { subscriptionId: sub.id };
      if (isHetzner) { body.hetznerServerId = serverId; body.hetznerApiToken = token || undefined; }
      if (isOracle)  { body.oracleInstanceId = serverId; }
      const r = await fetch(`/api/admin/subscriptions/${encodeURIComponent(sub.id)}/vps`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null) as unknown;
      if (!r.ok || !isRecord(j) || !readBoolean(j, "ok")) {
        setMsg(isRecord(j) ? (readString(j, "error") ?? "Save failed") : "Save failed");
        return;
      }
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      onChanged();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  const hasServer = sub.servers.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: tag.bg, border: `1px solid ${tag.border}` }}>
        <span>{tag.icon}</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: tag.color }}>
          {tag.label} — {isOracle ? "Oracle Cloud" : isHetzner ? "Hetzner" : "Unknown"}
        </span>
      </div>

      {hasServer && (
        <InfoBox color="#dcfce7" border="#86efac" icon="✅">
          <strong>{tag.label} assigned</strong>
          <div style={{ fontFamily: "monospace", fontSize: 11, marginTop: 2 }}>
            {isOracle
              ? `Instance OCID: ${sub.servers[0]?.hetznerServerId ?? "—"}`
              : `Hetzner ID: ${sub.servers[0]?.hetznerServerId ?? "—"}`}
          </div>
        </InfoBox>
      )}

      <div style={{ padding: "12px 14px", background: "#f9fafb", border: `1px solid ${B}` }}>
        <SectionLabel>{tag.label} Assignment</SectionLabel>
        <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 12 }}>Blank fields won't clear existing values.</div>

        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>
            {isOracle ? "Oracle Instance OCID" : "Hetzner Server ID"}
          </div>
          <input
            value={serverId}
            onChange={e => setServerId(e.target.value)}
            placeholder={isOracle ? "ocid1.instance.oc1.je1.abc..." : "e.g. 48291037"}
            disabled={busy}
            style={{ ...inp, fontFamily: "monospace", fontSize: 11 }}
          />
        </div>

        {isHetzner && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>
              API Token <span style={{ color: CLR.faint }}>(write-only — never shown again)</span>
            </div>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Paste Hetzner API token…"
              disabled={busy}
              style={{ ...inp, fontFamily: "monospace" }}
            />
          </div>
        )}

        {isOracle && (
          <InfoBox color="#fef9c3" border="#ca8a04" icon="🔑">
            Oracle API credentials (tenancy, user, fingerprint, key) are managed in server environment variables.
          </InfoBox>
        )}
      </div>

      {sub.provisionLocation && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#fff", border: `1px solid ${B}` }}>
          <span style={{ fontSize: 11, color: CLR.muted }}>Location:</span>
          <span style={{ fontSize: 12, color: CLR.text }}>{sub.provisionLocation}</span>
        </div>
      )}

      {msg && <div style={{ fontSize: 11, color: "#dc2626", padding: "6px 10px", background: "#fef2f2", border: "1px solid #fca5a5" }}>{msg}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button style={{ ...btn("primary"), opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void handleSave()}>
          {saved ? "✓ Saved" : busy ? "Saving…" : hasServer ? `Update ${tag.label}` : `Assign ${tag.label}`}
        </button>
      </div>
    </div>
  );
}

// ─── Details Tab ──────────────────────────────────────────────────────────────
function DetailsTab({ sub, onChanged }: { sub: SubRow; onChanged: () => void }) {
  const isAddon = sub.product.type === "addon";
  const [details,  setDetails]  = useState(sub.productDetails ?? "");
  const [note,     setNote]     = useState(sub.productNote ?? "");
  const [parentId, setParentId] = useState(sub.addonPlanSubscriptionId ?? "");
  const [planSubs, setPlanSubs] = useState<Array<{ id: string; product: { name: string; key: string } }>>([]);
  const [busy,     setBusy]     = useState(false);
  const [msg,      setMsg]      = useState<string | null>(null);
  const [saved,    setSaved]    = useState(false);

  // Load plan subs for addon linking
  useState(() => {
    if (!isAddon) return;
    void (async () => {
      try {
        const r = await fetch(`/api/admin/users/${sub.user.id}/plan-subscriptions`);
        const j = await r.json().catch(() => null) as unknown;
        if (isRecord(j) && Array.isArray((j as Record<string, unknown>).data)) {
          setPlanSubs((j as { data: Array<{ id: string; product: { name: string; key: string } }> }).data);
        }
      } catch { /* ignore */ }
    })();
  });

  async function handleSave() {
    setBusy(true); setMsg(null);
    try {
      const body: Record<string, unknown> = {
        subscriptionId: sub.id,
        productDetails: details || null,
        productNote: note || null,
        addonPlanSubscriptionId: isAddon ? (parentId || null) : undefined,
      };
      const r = await fetch("/api/admin/subscriptions/update-details", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null) as unknown;
      if (!r.ok || !isRecord(j) || !readBoolean(j, "ok")) {
        setMsg(isRecord(j) ? (readString(j, "error") ?? "Save failed") : "Save failed");
        return;
      }
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      onChanged();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {isAddon && (
        <div style={{ padding: "12px 14px", background: "#faf5ff", border: "1px solid #ddd6fe" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span>🔗</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed" }}>Link to Plan Subscription</span>
          </div>
          <div style={{ fontSize: 11, color: "#7c3aed", marginBottom: 10 }}>
            This addon must be linked to the customer's active plan. It will appear nested under that plan on their dashboard.
          </div>
          <select
            value={parentId}
            onChange={e => setParentId(e.target.value)}
            disabled={busy}
            style={{ ...inp, border: "1px solid #ddd6fe" }}
          >
            <option value="">— Select plan subscription —</option>
            {planSubs.map(p => (
              <option key={p.id} value={p.id}>{p.product.name} ({p.product.key}) · {p.id}</option>
            ))}
          </select>
          {parentId && (() => {
            const p = planSubs.find(s => s.id === parentId);
            return p ? (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#fff", border: "1px solid #ddd6fe" }}>
                <span style={{ fontSize: 11, color: "#a78bfa" }}>Linked to:</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: "#7c3aed" }}>{p.product.name}</span>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: "#c4b5fd", marginLeft: "auto" }}>{p.id}</span>
              </div>
            ) : null;
          })()}
        </div>
      )}

      <div style={{ padding: "12px 14px", background: "#f9fafb", border: `1px solid ${B}` }}>
        <SectionLabel>Customer-Visible Content</SectionLabel>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>Details</div>
          <textarea
            value={details}
            onChange={e => setDetails(e.target.value)}
            rows={3}
            placeholder="e.g. domain, OS, requirements…"
            disabled={busy}
            style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}
          />
        </div>
        <div>
          <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>Note</div>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Extra instructions, configuration…"
            disabled={busy}
            style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}
          />
        </div>
      </div>

      {msg && <div style={{ fontSize: 11, color: "#dc2626", padding: "6px 10px", background: "#fef2f2", border: "1px solid #fca5a5" }}>{msg}</div>}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button style={{ ...btn("primary"), opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => void handleSave()}>
          {saved ? "✓ Saved" : busy ? "Saving…" : "Save Details"}
        </button>
      </div>
    </div>
  );
}

// ─── Status Tab ───────────────────────────────────────────────────────────────
function StatusTab({ sub, onChanged }: { sub: SubRow; onChanged: () => void }) {
  const [comment,       setComment]       = useState("");
  const [cancelReason,  setCancelReason]  = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy,          setBusy]          = useState(false);
  const [msg,           setMsg]           = useState<string | null>(null);
  const [localStatus,   setLocalStatus]   = useState(sub.status);

  const ACTION_MAP: Record<string, { label: string; icon: string; next: string; color: string; bg: string }> = {
    PENDING_PAYMENT:  { label: "Approve & Activate", icon: "✅", next: "ACTIVE",    color: "#15803d", bg: "#dcfce7" },
    PENDING_EXTERNAL: { label: "Approve & Activate", icon: "✅", next: "ACTIVE",    color: "#15803d", bg: "#dcfce7" },
    ACTIVE:           { label: "Suspend",            icon: "⏸",  next: "SUSPENDED", color: "#b45309", bg: "#fef3c7" },
    SUSPENDED:        { label: "Reactivate",         icon: "▶️",  next: "ACTIVE",    color: "#15803d", bg: "#dcfce7" },
  };
  const action = ACTION_MAP[localStatus];

  async function applyAction() {
    if (!action) return;
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/subscriptions/approve", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: sub.id, comment: comment || undefined }),
      });
      const j = await r.json().catch(() => null) as unknown;
      if (!r.ok || !isRecord(j) || !readBoolean(j, "ok")) {
        setMsg(isRecord(j) ? (readString(j, "error") ?? "Action failed") : "Action failed");
        return;
      }
      setLocalStatus(action.next);
      setComment("");
      onChanged();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  async function applyCancel() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/subscriptions/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: sub.id, reason: cancelReason || undefined }),
      });
      const j = await r.json().catch(() => null) as unknown;
      if (!r.ok || !isRecord(j) || !readBoolean(j, "ok")) {
        setMsg(isRecord(j) ? (readString(j, "error") ?? "Cancel failed") : "Cancel failed");
        return;
      }
      setLocalStatus("CANCELED");
      setConfirmCancel(false);
      setCancelReason("");
      onChanged();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Status overview */}
      <div style={{ padding: "12px 14px", background: "#f9fafb", border: `1px solid ${B}` }}>
        <SectionLabel>Current Status</SectionLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <div>
            <div style={{ fontSize: 10, color: CLR.faint, marginBottom: 4 }}>SUBSCRIPTION</div>
            <SubStatusBadge status={localStatus} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: CLR.faint, marginBottom: 4 }}>PAYMENT</div>
            <PayBadge status={sub.paymentStatus} />
          </div>
          {sub.activatedAt && (
            <div>
              <div style={{ fontSize: 10, color: CLR.faint, marginBottom: 4 }}>ACTIVATED</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: CLR.text }}>{fmtDate(sub.activatedAt)}</span>
            </div>
          )}
        </div>
      </div>

      {msg && <div style={{ fontSize: 11, color: "#dc2626", padding: "6px 10px", background: "#fef2f2", border: "1px solid #fca5a5" }}>{msg}</div>}

      {/* Primary action */}
      {action && localStatus !== "CANCELED" && (
        <div style={{ padding: "12px 14px", background: "#f9fafb", border: `1px solid ${B}` }}>
          <SectionLabel>Change Status</SectionLabel>
          {(localStatus === "PENDING_PAYMENT" || localStatus === "PENDING_EXTERNAL") && (
            <InfoBox color="#eff6ff" border="#bfdbfe" icon="ℹ️">
              Activating does not affect payment status. Bill will remain unpaid until recorded in the Billing tab.
            </InfoBox>
          )}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 4 }}>
              Comment <span style={{ color: CLR.faint }}>(optional — stored in audit log)</span>
            </div>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={2}
              disabled={busy}
              style={{ ...inp, resize: "none", lineHeight: 1.5 }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              disabled={busy}
              style={{ ...btn("primary"), background: action.bg, color: action.color, borderColor: action.color + "44", opacity: busy ? 0.6 : 1 }}
              onClick={() => void applyAction()}>
              {action.icon} {busy ? "Applying…" : action.label}
            </button>
          </div>
        </div>
      )}

      {/* Cancel */}
      {localStatus !== "CANCELED" && (
        <div style={{ padding: "12px 14px", background: "#fff5f5", border: "1px solid #fca5a5" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <span>🚫</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#991b1b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Cancel Subscription
            </span>
          </div>
          <div style={{ fontSize: 11, color: "#991b1b", marginBottom: 10 }}>
            Immediately cancels. Customer loses access. Cannot be auto-reversed.
          </div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, color: "#dc2626", marginBottom: 4 }}>Reason <span style={{ color: "#fca5a5" }}>(optional)</span></div>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={2}
              disabled={busy}
              placeholder="e.g. Non-payment, customer requested cancellation…"
              style={{ ...inp, border: "1px solid #fca5a5", resize: "none" }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 11, color: "#dc2626", marginBottom: 10 }}>
            <input type="checkbox" checked={confirmCancel} onChange={e => setConfirmCancel(e.target.checked)} disabled={busy} />
            I understand this cancels the subscription immediately.
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              disabled={!confirmCancel || busy}
              style={{ ...btn("danger"), opacity: confirmCancel && !busy ? 1 : 0.4, cursor: confirmCancel && !busy ? "pointer" : "not-allowed" }}
              onClick={() => { if (confirmCancel && !busy) void applyCancel(); }}>
              {busy ? "Cancelling…" : "Cancel Subscription"}
            </button>
          </div>
        </div>
      )}

      {localStatus === "CANCELED" && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "32px 0", gap: 8, textAlign: "center" }}>
          <div style={{ fontSize: 32 }}>🚫</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: CLR.muted }}>Subscription Cancelled</div>
          <div style={{ fontSize: 11, color: CLR.faint }}>No further actions available.</div>
        </div>
      )}
    </div>
  );
}

// ─── Expanded panel ───────────────────────────────────────────────────────────
function ExpandedPanel({ sub, onChanged }: { sub: SubRow; onChanged: () => void }) {
  const tag     = getServerTag(sub);
  const oneTime = isOneTime(sub);
  const isAddon = sub.product.type === "addon";

  type TabId = "billing" | "vps" | "details" | "status";
  const TABS: Array<{ id: TabId; label: string; icon: string }> = [
    { id: "billing", label: "Billing", icon: "💳" },
    ...(tag ? [{ id: "vps" as TabId, label: tag.label, icon: tag.icon }] : []),
    { id: "details", label: "Details", icon: "📝" },
    { id: "status",  label: "Status",  icon: "🔘" },
  ];

  const [tab, setTab] = useState<TabId>("billing");

  return (
    <div style={{ borderTop: `1px solid ${BL}` }}>
      {/* Info bar */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "7px 16px", background: "#fafafa", borderBottom: `1px solid ${BL}` }}>
        <span style={{ fontFamily: "monospace", fontSize: 10, color: CLR.faint }}>{sub.id}</span>
        <TypeBadge type={sub.product.type} />
        {sub.provisionLocation && <span style={{ fontSize: 10, color: CLR.muted }}>📍 {sub.provisionLocation}</span>}
        {sub.addonPlanSubscriptionId && (
          <span style={{ fontSize: 10, color: "#7c3aed", background: "#f5f3ff", padding: "1px 7px", border: "1px solid #ddd6fe" }}>
            🔗 Addon · linked to {sub.addonPlanSubscriptionId.slice(0, 22)}…
          </span>
        )}
        {oneTime && (
          <span style={{ fontSize: 10, color: CLR.muted, background: "#f3f4f6", padding: "1px 7px", border: `1px solid ${B}` }}>🏷️ One-time</span>
        )}
      </div>

      <div style={{ display: "flex" }}>
        {/* Sidebar */}
        <div style={{ width: 120, flexShrink: 0, borderRight: `1px solid ${BL}`, background: "#fff", display: "flex", flexDirection: "column" }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "10px 12px", fontSize: 12, fontWeight: 500,
                background: tab === t.id ? CLR.header : "transparent",
                color: tab === t.id ? "#fff" : CLR.muted,
                border: "none", cursor: "pointer", textAlign: "left",
                borderBottom: `1px solid ${BL}`, fontFamily: "inherit",
                transition: "background 0.1s",
              }}
            >
              <span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, padding: 16, overflowY: "auto", maxHeight: 520, background: "#fff" }}>
          {tab === "billing" && <BillingTab sub={sub} onChanged={onChanged} />}
          {tab === "vps"     && <VpsTab     sub={sub} onChanged={onChanged} />}
          {tab === "details" && <DetailsTab sub={sub} onChanged={onChanged} />}
          {tab === "status"  && <StatusTab  sub={sub} onChanged={onChanged} />}
        </div>
      </div>
    </div>
  );
}

// ─── Main table component ─────────────────────────────────────────────────────
export function SubscriptionsDataTable({
  rows,
  loading,
  onChanged,
}: {
  rows: SubRow[];
  loading: boolean;
  onChanged: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const COLS = "2fr 1.6fr 0.7fr 1.1fr 1fr 1fr 28px";

  return (
    <div style={{ background: "#fff", border: `1px solid ${B}` }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "0 16px", padding: "8px 16px", background: "#f9fafb", borderBottom: `1px solid ${B}` }}>
        {["Customer", "Product", "Type", "Status", "Payment", "Expiry", ""].map((h, i) => (
          <div key={i} style={{ fontSize: 10, fontWeight: 700, color: CLR.faint, letterSpacing: "0.07em", textTransform: "uppercase" }}>{h}</div>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ padding: "40px 20px", textAlign: "center", color: CLR.faint, fontSize: 13 }}>Loading…</div>
      )}

      {/* Empty */}
      {!loading && rows.length === 0 && (
        <div style={{ padding: "48px 20px", textAlign: "center", color: CLR.faint, fontSize: 13 }}>No subscriptions found.</div>
      )}

      {/* Rows */}
      {rows.map(sub => {
        const isOpen  = expandedId === sub.id;
        const tag     = getServerTag(sub);
        const d       = daysUntil(sub.currentPeriodEnd);
        const oneTime = isOneTime(sub);

        return (
          <div key={sub.id} style={{ borderBottom: `1px solid ${BL}` }}>
            {/* Row */}
            <div
              onClick={() => setExpandedId(isOpen ? null : sub.id)}
              style={{
                display: "grid", gridTemplateColumns: COLS, gap: "0 16px",
                padding: "11px 16px", cursor: "pointer", alignItems: "center",
                background: isOpen ? CLR.primaryBg : "#fff",
                borderLeft: isOpen ? `3px solid ${CLR.primary}` : "3px solid transparent",
                transition: "all 0.1s",
              }}
            >
              {/* Customer */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: CLR.text }}>{sub.user.email}</div>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: CLR.faint, marginTop: 1 }}>{sub.id.slice(0, 24)}…</div>
              </div>

              {/* Product */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: CLR.text }}>{sub.product.name}</span>
                  {tag && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", background: tag.bg, color: tag.color, border: `1px solid ${tag.border}` }}>
                      {tag.icon} {tag.label}
                    </span>
                  )}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 10, color: CLR.faint, marginTop: 1 }}>{sub.product.key}</div>
              </div>

              {/* Type */}
              <div><TypeBadge type={sub.product.type} /></div>

              {/* Status */}
              <div><SubStatusBadge status={sub.status} /></div>

              {/* Payment */}
              <div><PayBadge status={sub.paymentStatus} /></div>

              {/* Expiry */}
              <div>
                {oneTime
                  ? <span style={{ fontSize: 10, color: CLR.muted, background: "#f3f4f6", padding: "2px 7px", border: `1px solid ${B}` }}>One-time</span>
                  : !sub.currentPeriodEnd || sub.status !== "ACTIVE"
                    ? <span style={{ color: CLR.faint, fontSize: 12 }}>—</span>
                    : (
                      <span style={{ fontSize: 12, fontWeight: 600, color: d !== null && d <= 7 ? "#dc2626" : d !== null && d <= 30 ? "#ca8a04" : CLR.text }}>
                        {d !== null && d <= 30 && (d <= 7 ? "🔴 " : "🟡 ")}{fmtDate(sub.currentPeriodEnd)}
                      </span>
                    )
                }
              </div>

              {/* Chevron */}
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none"
                  style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s", color: isOpen ? CLR.primary : CLR.faint }}>
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Inline expanded panel */}
            {isOpen && <ExpandedPanel sub={sub} onChanged={() => { onChanged(); }} />}
          </div>
        );
      })}
    </div>
  );
}