"use client";
// app/admin/subscriptions/ui/subscriptionsDataTable.tsx

import { useEffect, useState } from "react";
import type { SubRow } from "../subscriptionsTableTypes";
import Icon from "@/components/ui/Icon";
import { daysUntil, fmtDate, fmtDateInput, isoFromDateInput, isRecord, readBoolean, readString } from "./subscriptionsUtils";

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  primary:    "#318774",
  primaryBg:  "#eaf4f2",
  primaryMid: "#a7d9d1",
  border:     "#e2e8f0",
  borderL:    "#f1f5f9",
  text:       "#0f172a",
  muted:      "#64748b",
  faint:      "#94a3b8",
};

const PERIOD_LABELS: Record<string, string> = {
  MONTHLY: "Monthly", SIX_MONTHS: "6 Months", YEARLY: "Yearly", ONE_TIME: "One-time",
};

// ─── Status / type config ───────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; bg: string; color: string; border: string; dot: string }> = {
  ACTIVE:           { label: "Active",           bg: "#f0fdf4", color: "#15803d", border: "#86efac", dot: "#22c55e"  },
  PENDING_PAYMENT:  { label: "Pending Payment",  bg: "#fffbeb", color: "#92400e", border: "#fcd34d", dot: "#f59e0b"  },
  PROCESSING:       { label: "Processing",       bg: "#eff6ff", color: "#1e40af", border: "#93c5fd", dot: "#3b82f6"  },
  CANCELED:         { label: "Cancelled",        bg: "#fef2f2", color: "#dc2626", border: "#fca5a5", dot: "#ef4444"  },
  SUSPENDED:        { label: "Suspended",        bg: "#fff7ed", color: "#c2410c", border: "#fdba74", dot: "#f97316"  },
  EXPIRED:          { label: "Expired",          bg: "#f8fafc", color: "#64748b", border: "#cbd5e1", dot: "#94a3b8"  },
};

const TYPE_CFG: Record<string, { bg: string; color: string; border: string }> = {
  plan:    { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  addon:   { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  service: { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  product: { bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
};

// ─── Shared input styles ────────────────────────────────────────────────────────
const INP: React.CSSProperties = {
  width: "100%", padding: "7px 10px", fontSize: 12, fontFamily: "inherit",
  background: "#fff", border: `1px solid ${C.border}`, color: C.text,
  outline: "none", boxSizing: "border-box" as const,
};
const LBL: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: C.faint,
  letterSpacing: "0.07em", textTransform: "uppercase" as const,
  marginBottom: 4, display: "block",
};

// ─── Badges ─────────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_CFG[status] ?? STATUS_CFG.EXPIRED;
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600, padding:"3px 8px", background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
      <span style={{ width:6, height:6, borderRadius:"50%", background:s.dot, flexShrink:0 }} />
      {s.label}
    </span>
  );
}

function PayBadge({ paymentStatus }: { paymentStatus: string }) {
  const paid    = paymentStatus === "PAID";
  const partial = paymentStatus === "PARTIAL";
  const bg      = paid ? "#f0fdf4"  : partial ? "#fff7ed"  : "#fef9c3";
  const color   = paid ? "#15803d"  : partial ? "#c2410c"  : "#92400e";
  const border  = paid ? "#86efac"  : partial ? "#fdba74"  : "#fde047";
  const icon    = paid ? "check"    : partial ? "clock"    : "clock";
  const label   = paid ? "Paid"     : partial ? "Partial"  : "Unpaid";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, padding:"3px 8px", background:bg, color, border:`1px solid ${border}` }}>
      <Icon name={icon} size={10} color={color} />
      {label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const t = TYPE_CFG[type] ?? TYPE_CFG.plan;
  return (
    <span style={{ display:"inline-flex", fontSize:9, fontWeight:700, padding:"2px 6px", background:t.bg, color:t.color, border:`1px solid ${t.border}`, letterSpacing:"0.05em", textTransform:"uppercase" as const }}>{type}</span>
  );
}

function ExpiryDisplay({ endIso, status }: { endIso: string | null; status: string }) {
  if (status !== "ACTIVE" || !endIso) return <span style={{ color:C.faint, fontSize:12 }}>—</span>;
  const d = daysUntil(endIso);
  const dt = fmtDate(endIso);
  if (d === null) return <span style={{ fontSize:12, color:C.muted }}>{dt}</span>;
  const u7 = d <= 7, u30 = d <= 30;
  return (
    <div>
      <div style={{ fontSize:12, fontWeight:u30?600:400, color:u7?"#dc2626":u30?"#d97706":C.text, display:"flex", alignItems:"center", gap:4 }}>
        {u7 && <Icon name="alertCircle" size={11} color="#dc2626" />}
        {u30 && !u7 && <Icon name="clock" size={11} color="#d97706" />}
        {dt}
      </div>
      {u30 && <div style={{ fontSize:10, color:u7?"#dc2626":"#d97706", marginTop:1 }}>{d<=0?"Expired":`${d}d remaining`}</div>}
    </div>
  );
}

function SaveBtn({ busy, saved, activeLabel, onClick }: { busy:boolean; saved:boolean; activeLabel:string; onClick:()=>void }) {
  return (
    <button onClick={onClick} disabled={busy} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"8px 18px", fontSize:12, fontWeight:700, fontFamily:"inherit", background:saved?"#f0fdf4":C.primary, color:saved?"#15803d":"#fff", border:`1px solid ${saved?"#86efac":C.primary}`, cursor:busy?"wait":"pointer", transition:"all 0.15s" }}>
      <Icon name={saved?"check":"save"} size={13} color={saved?"#15803d":"#fff"} />
      {busy ? "Saving…" : saved ? "Saved!" : activeLabel}
    </button>
  );
}

// ─── Invoice status badge ────────────────────────────────────────────────────────
function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    DRAFT:   { bg: "#f8fafc", color: "#64748b", border: "#cbd5e1" },
    ISSUED:  { bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" },
    SENT:    { bg: "#eff6ff", color: "#1d4ed8", border: "#93c5fd" },
    PAID:    { bg: "#f0fdf4", color: "#15803d", border: "#86efac" },
    PARTIAL: { bg: "#fff7ed", color: "#c2410c", border: "#fdba74" },
    OVERDUE: { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5" },
    VOID:    { bg: "#f8fafc", color: "#94a3b8", border: "#e2e8f0" },
  };
  const s = map[status] ?? map.DRAFT;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

// ─── Metered Upgrade Panel ──────────────────────────────────────────────────────
function MeteredUpgradePanel({ sub, currency, onChanged }: {
  sub: SubRow; currency: string; onChanged: () => void;
}) {
  const currentQty  = sub.quantity ?? 1;
  const unitLabel   = sub.product.unitLabel ?? "unit";
  const [newQty,    setNewQty]    = useState(currentQty);
  const [note,      setNote]      = useState("");
  const [preview,   setPreview]   = useState<{ proRateCents: number | null; proRateDetails: string | null; pricePerUnitCents: number | null } | null>(null);
  const [busy,      setBusy]      = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [msg,       setMsg]       = useState<string | null>(null);
  const [open,      setOpen]      = useState(false);

  const isUpgrade   = newQty > currentQty;
  const isDowngrade = newQty < currentQty;
  const unchanged   = newQty === currentQty;

  useEffect(() => {
    if (!open || !isUpgrade || !sub.currentPeriodEnd) { setPreview(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/admin/subscriptions/${sub.id}/upgrade?qty=${newQty}`)
        .then(r => r.json())
        .then(j => { if (j.ok) setPreview(j.data); })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [newQty, open, isUpgrade]);

  async function save() {
    if (unchanged) { setMsg("Quantity not changed."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/admin/subscriptions/${sub.id}/upgrade`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newQuantity: newQty, note: note.trim() || undefined, autoInvoice: true }),
      });
      const j = await r.json().catch(() => null) as any;
      if (!r.ok || !j?.ok) { setMsg(j?.error ?? "Failed"); return; }
      setSaved(true); setTimeout(() => { setSaved(false); setOpen(false); }, 2000);
      onChanged();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ border: `1px solid ${C.border}` }}>
      <div onClick={() => setOpen(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", cursor: "pointer", background: open ? C.primaryBg : "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Icon name="layers" size={14} color={C.primary} />
          <div>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Units — </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>{currentQty} {unitLabel}{currentQty !== 1 ? "s" : ""}</span>
          </div>
          {preview?.pricePerUnitCents != null && (
            <span style={{ fontSize: 11, color: C.faint }}>@ {(preview.pricePerUnitCents / 100).toFixed(2)} {currency}/{unitLabel}</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: C.primary, fontWeight: 600 }}>Upgrade / Downgrade</span>
          <span style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", display: "flex" }}>
            <Icon name="chevronDown" size={13} color={C.faint} />
          </span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px", display: "flex", flexDirection: "column" as const, gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <span style={LBL}>New Quantity ({unitLabel}s)</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <button onClick={() => setNewQty(q => Math.max(1, q - 1))} style={{ width: 32, height: 32, border: `1px solid ${C.border}`, background: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>−</button>
                <input type="number" min={1} value={newQty} onChange={e => setNewQty(Math.max(1, parseInt(e.target.value) || 1))} style={{ ...INP, width: 80, textAlign: "center" as const, fontSize: 15, fontWeight: 700 }} />
                <button onClick={() => setNewQty(q => q + 1)} style={{ width: 32, height: 32, border: `1px solid ${C.border}`, background: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "inherit" }}>+</button>
                <span style={{ fontSize: 12, color: C.faint }}>{isUpgrade ? `+${newQty - currentQty}` : isDowngrade ? `−${currentQty - newQty}` : "no change"}</span>
              </div>
            </div>
            {!unchanged && (
              <div style={{ padding: "8px 14px", background: isUpgrade ? "#f0fdf4" : "#fff7ed", border: `1px solid ${isUpgrade ? "#86efac" : "#fdba74"}`, textAlign: "center" as const }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isUpgrade ? "#15803d" : "#c2410c" }}>{isUpgrade ? "UPGRADE" : "DOWNGRADE"}</div>
                <div style={{ fontSize: 10, color: isUpgrade ? "#166534" : "#9a3412", marginTop: 2 }}>{isUpgrade ? "Pro-rated charge applies" : "No charge · renewal uses new qty"}</div>
              </div>
            )}
          </div>

          {isUpgrade && sub.currentPeriodEnd && (
            <div style={{ padding: "12px 14px", background: "#fffbeb", border: "1px solid #fde68a" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="dollarSign" size={12} color="#d97706" />
                Pro-rated Charge for Remaining Period
              </div>
              {preview?.proRateDetails ? (
                <>
                  <div style={{ fontSize: 12, color: "#92400e", marginBottom: 6 }}>{preview.proRateDetails}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#92400e" }}>{preview.proRateCents != null ? `${(preview.proRateCents / 100).toFixed(2)} ${currency}` : "—"}</div>
                  <div style={{ fontSize: 10, color: "#b45309", marginTop: 4 }}>This amount should be collected separately. Full invoice generated in Sales module (Step 5).</div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: "#b45309" }}>Calculating…</div>
              )}
            </div>
          )}

          {isDowngrade && (
            <div style={{ padding: "10px 14px", background: "#f8fafc", border: `1px solid ${C.border}`, fontSize: 12, color: C.muted, display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="info" size={13} color={C.faint} />
              Downgrade takes effect immediately. No charge adjustment. Renewal will use {newQty} {unitLabel}{newQty !== 1 ? "s" : ""}.
            </div>
          )}

          <div>
            <span style={LBL}>Note <span style={{ fontWeight: 400, color: C.faint }}>— optional</span></span>
            <input value={note} onChange={e => setNote(e.target.value)} style={INP} placeholder="e.g. Customer requested upgrade, invoice to follow…" />
          </div>

          {msg && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", fontSize: 12, color: "#dc2626" }}>
              <Icon name="alertCircle" size={13} color="#dc2626" /> {msg}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={() => { setOpen(false); setNewQty(currentQty); setMsg(null); }} style={{ fontSize: 12, color: C.muted, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <SaveBtn busy={busy} saved={saved} activeLabel={isUpgrade ? `Upgrade to ${newQty} ${unitLabel}s` : isDowngrade ? `Downgrade to ${newQty} ${unitLabel}s` : "No Change"} onClick={save} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Billing History Table ──────────────────────────────────────────────────────
function BillingHistoryTable({ sub, grandTotal, currency, linkedInvoice, renewalData }: {
  sub: SubRow; grandTotal: number; currency: string;
  linkedInvoice: any | null; renewalData: any;
}) {
  const renewals: RenewalEntry[] | null = renewalData?.renewals ?? null;

  const invStatus  = linkedInvoice?.status as string | undefined;
  const isPaid     = invStatus === "PAID";
  const isPartial  = invStatus === "PARTIALLY_PAID";

  const currentRow = sub.currentPeriodStart ? {
    period:    `${fmtDate(sub.currentPeriodStart)} → ${fmtDate(sub.currentPeriodEnd)}`,
    bp:        PERIOD_LABELS[sub.billingPeriod] ?? sub.billingPeriod,
    paidOn:    isPaid ? fmtDate(sub.currentPeriodStart) : null,
    status:    isPaid ? "PAID" : isPartial ? "PARTIAL" : "UNPAID",
    amount:    linkedInvoice ? `${(linkedInvoice.total / 100).toFixed(2)} ${linkedInvoice.currency}` : grandTotal > 0 ? `${grandTotal.toFixed(2)} ${currency}` : "—",
    invoice:   linkedInvoice?.docNum ?? "—",
    reference: "—",
    isCurrent: true,
  } : null;

  const hasAny = currentRow || (renewals && renewals.length > 0);
  if (!hasAny) return null;

  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <Icon name="clock" size={13} color={C.primary} />
        Billing History
      </div>
      <div style={{ border: `1px solid ${C.border}`, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 90px 80px 110px 120px 120px", background: "#f8fafc", borderBottom: `1px solid ${C.border}`, padding: "7px 14px", fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
          <div>Period</div><div>Paid On</div><div>Status</div><div>Amount</div><div>Invoice #</div><div>Reference</div>
        </div>

        {renewals && renewals.map(r => {
          const rPaid   = r.isAutomatic || (renewals.indexOf(r) < renewals.length - 1);
          const rBg     = rPaid ? "#f0fdf4" : "#fef9c3";
          const rColor  = rPaid ? "#15803d" : "#92400e";
          const rBorder = rPaid ? "#86efac" : "#fde047";
          return (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 90px 80px 110px 120px 120px", padding: "10px 14px", fontSize: 12, alignItems: "center", borderBottom: `1px solid ${C.borderL}`, background: "#fffbeb" }}>
              <div>
                <div style={{ color: C.text }}>{fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <span style={{ fontSize: 10, color: C.faint }}>{PERIOD_LABELS[r.billingPeriod] ?? r.billingPeriod}</span>
                  <span style={{ fontSize: 9, padding: "1px 5px", background: r.isAutomatic ? "#eff6ff" : "#f5f3ff", color: r.isAutomatic ? "#2563eb" : "#7c3aed", border: `1px solid ${r.isAutomatic ? "#93c5fd" : "#ddd6fe"}`, fontWeight: 700 }}>
                    {r.isAutomatic ? "AUTO" : "MANUAL"} RENEWAL
                  </span>
                </div>
              </div>
              <div style={{ color: C.faint, fontSize: 11 }}>{fmtDate(r.createdAt)}</div>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", background: rBg, color: rColor, border: `1px solid ${rBorder}` }}>
                  {rPaid ? "Paid" : "Pending"}
                </span>
              </div>
              <div style={{ fontWeight: 700, color: C.primary }}>
                {r.overrideCents
                  ? <><span style={{ color: "#d97706" }}>{(r.overrideCents / 100).toFixed(2)}</span><span style={{ fontSize: 9, color: C.faint }}> override</span></>
                  : `${(r.totalCents / 100).toFixed(2)}`}
                <span style={{ fontSize: 10, color: C.faint, marginLeft: 3 }}>{r.currency}</span>
              </div>
              <div style={{ color: C.faint, fontFamily: "monospace", fontSize: 10 }}>—</div>
              <div style={{ color: C.faint, fontSize: 11 }}>{r.notes ?? "—"}</div>
            </div>
          );
        })}

        {currentRow && (
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 90px 80px 110px 120px 120px", padding: "10px 14px", fontSize: 12, alignItems: "center" }}>
            <div>
              <div style={{ color: C.text }}>{currentRow.period}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 10, color: C.faint }}>{currentRow.bp}</span>
                <span style={{ fontSize: 9, padding: "1px 5px", background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", fontWeight: 700 }}>CURRENT</span>
              </div>
            </div>
            <div style={{ color: currentRow.paidOn ? C.text : C.faint, fontSize: 11 }}>{currentRow.paidOn ?? "—"}</div>
            <div>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: "2px 7px",
                background: currentRow.status === "PAID" ? "#f0fdf4" : currentRow.status === "PARTIAL" ? "#fff7ed" : "#fef9c3",
                color:      currentRow.status === "PAID" ? "#15803d" : currentRow.status === "PARTIAL" ? "#c2410c" : "#92400e",
                border:     `1px solid ${currentRow.status === "PAID" ? "#86efac" : currentRow.status === "PARTIAL" ? "#fdba74" : "#fde047"}`,
              }}>
                {currentRow.status === "PAID" ? "Paid" : currentRow.status === "PARTIAL" ? "Partial" : "Unpaid"}
              </span>
            </div>
            <div style={{ fontWeight: 600, color: isPaid ? "#15803d" : isPartial ? "#c2410c" : "#92400e" }}>{currentRow.amount}</div>
            <div style={{ color: C.muted, fontFamily: "monospace", fontSize: 11 }}>{currentRow.invoice}</div>
            <div style={{ color: C.muted, fontSize: 11 }}>{currentRow.reference}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Billing tab ────────────────────────────────────────────────────────────────
function BillingTab({ sub, addons, currency, renewalData, invoicesData, manualInvoice: initManualInvoice, selectedLineIds: initSelectedLineIds, onChanged }: {
  sub: SubRow; addons: SubRow[]; currency: string; renewalData: any;
  invoicesData: any[];
  manualInvoice: any | null;
  selectedLineIds: string[];
  onChanged: () => void;
}) {
  const [invoicingMode, setInvoicingModeState] = useState<"AUTO" | "MANUAL">((sub as any).invoicingMode ?? "AUTO");
  const [switchingMode,  setSwitchingMode]      = useState(false);
  const isManualMode  = invoicingMode === "MANUAL";
  const hasAutoInvoice = invoicesData.length > 0;

  async function switchInvoicingMode(next: "AUTO" | "MANUAL") {
    if (next === invoicingMode) return;
    setSwitchingMode(true);
    try {
      const r = await fetch("/api/admin/subscriptions/update-invoicing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: sub.id, invoicingMode: next }),
      });
      const j = await r.json().catch(() => null) as any;
      if (!r.ok || !j?.ok) return;
      setInvoicingModeState(next);
      onChanged();
    } finally { setSwitchingMode(false); }
  }

  // Manual invoice link state
  const [docNumInput,     setDocNumInput]     = useState("");
  const [lookupLoading,   setLookupLoading]   = useState(false);
  const [lookupError,     setLookupError]     = useState<string | null>(null);
  const [lookedUpInvoice, setLookedUpInvoice] = useState<any | null>(initManualInvoice);
  const [selectedLines,   setSelectedLines]   = useState<string[]>(initSelectedLineIds);
  const [savingLink,      setSavingLink]       = useState(false);
  const [linkSaved,       setLinkSaved]       = useState(false);

  async function lookupInvoice() {
    if (!docNumInput.trim()) return;
    setLookupLoading(true); setLookupError(null); setLookedUpInvoice(null); setSelectedLines([]);
    try {
      const r = await fetch(`/api/admin/subscriptions/${sub.id}/invoices`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docNum: docNumInput.trim().toUpperCase() }),
      });
      const j = await r.json().catch(() => null) as any;
      if (!r.ok || !j?.ok) { setLookupError(j?.error === "INVOICE_NOT_FOUND" ? "Invoice not found" : j?.error ?? "Lookup failed"); return; }
      setLookedUpInvoice(j.invoice);
    } catch { setLookupError("Network error"); }
    finally { setLookupLoading(false); }
  }

  async function saveLink() {
    if (!lookedUpInvoice) return;
    setSavingLink(true);
    try {
      const r = await fetch("/api/admin/subscriptions/update-invoicing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: sub.id, linkedDocNum: lookedUpInvoice.docNum, selectedLineIds: selectedLines }),
      });
      const j = await r.json().catch(() => null) as any;
      if (!r.ok || !j?.ok) return;
      setLinkSaved(true); setTimeout(() => setLinkSaved(false), 2500); onChanged();
    } finally { setSavingLink(false); }
  }

  const selectedLinesTotal = lookedUpInvoice
    ? lookedUpInvoice.lines.filter((l: any) => selectedLines.includes(l.id)).reduce((acc: number, l: any) => acc + l.lineTotal, 0)
    : 0;

  const [billingPeriod, setBillingPeriod] = useState(sub.billingPeriod ?? "YEARLY");
  const [start,    setStart]    = useState(fmtDateInput(sub.currentPeriodStart));
  const [end,      setEnd]      = useState(fmtDateInput(sub.currentPeriodEnd));
  const [payDate,  setPayDate]  = useState(fmtDateInput(sub.paymentStatus === "PAID" ? sub.currentPeriodStart : null));
  const [invNum,   setInvNum]   = useState(sub.invoiceNumber ?? "");
  const [ref,      setRef]      = useState(sub.manualPaymentReference ?? "");
  const [useOverride, setUseOverride] = useState(false);
  const [overrideAmt, setOverrideAmt] = useState("");
  const [busy,  setBusy]  = useState(false);
  const [msg,   setMsg]   = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const d      = daysUntil(sub.currentPeriodEnd);
  const urgent = sub.status === "ACTIVE" && d !== null && d <= 30;

  const allPrices     = (sub as any).allPrices as Record<string, number> ?? {};
  const planCents     = allPrices[billingPeriod] ?? sub.resolvedPriceCents ?? 0;
  const planAvailable = planCents > 0;

  const availablePeriods = (sub.product.billingPeriods ?? []).filter(
    (bp: string) => bp in allPrices || bp === sub.billingPeriod
  );
  const hasOtherPeriods = availablePeriods.length > 1;

  const addonTotalCents = addons.reduce((acc, a) => {
    if (a.product.addonPricingType === "percentage") {
      return acc + Math.round(planCents * (Number(a.product.addonPercentage ?? 0) / 100));
    }
    return acc + ((a.resolvedPriceCents ?? 0) * (a.quantity ?? 1));
  }, 0);
  const grandTotalCents = planCents + addonTotalCents;
  const grandTotal      = grandTotalCents / 100;

  const pct = (() => {
    if (!sub.currentPeriodStart || !sub.currentPeriodEnd) return 0;
    const tot  = new Date(sub.currentPeriodEnd).getTime() - new Date(sub.currentPeriodStart).getTime();
    const elap = Date.now() - new Date(sub.currentPeriodStart).getTime();
    return Math.min(100, Math.max(0, (elap / tot) * 100));
  })();

  async function save() {
    setBusy(true); setMsg(null);
    const startIso = isoFromDateInput(start);
    const endIso   = isoFromDateInput(end);
    if (!startIso || !endIso) { setMsg("Start and End dates are required."); setBusy(false); return; }
    try {
      const r = await fetch("/api/admin/subscriptions/approve-manual", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:                     sub.id,
          currentPeriodStart:     startIso,
          currentPeriodEnd:       endIso,
          paymentDate:            isoFromDateInput(payDate),
          invoiceNumber:          invoicesData.length === 0 ? (invNum.trim() || null) : null,
          manualPaymentReference: invoicesData.length === 0 ? (ref.trim() || null) : null,
          billingPeriod:          billingPeriod || undefined,
        }),
      });
      const j = await r.json().catch(() => null) as unknown;
      if (!r.ok || !isRecord(j) || !readBoolean(j, "ok")) {
        setMsg(isRecord(j) ? (readString(j, "error") ?? "Save failed") : "Save failed"); return;
      }
      setSaved(true); setTimeout(() => setSaved(false), 2500); onChanged();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── Invoice Section ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="receipt" size={13} color={C.primary} />
          Invoice
          <div style={{ marginLeft: "auto", display: "flex", gap: 4, alignItems: "center" }}>
            <button
              onClick={() => void switchInvoicingMode("AUTO")}
              disabled={switchingMode}
              style={{ fontSize: 9, fontWeight: 700, padding: "3px 9px", cursor: switchingMode ? "wait" : "pointer", fontFamily: "inherit",
                background: !isManualMode ? C.primary : "#fff",
                color:      !isManualMode ? "#fff" : C.muted,
                border:     `1px solid ${!isManualMode ? C.primary : C.border}` }}>
              AUTO
            </button>
            <button
              onClick={() => void switchInvoicingMode("MANUAL")}
              disabled={switchingMode}
              style={{ fontSize: 9, fontWeight: 700, padding: "3px 9px", cursor: switchingMode ? "wait" : "pointer", fontFamily: "inherit",
                background: isManualMode ? "#f59e0b" : "#fff",
                color:      isManualMode ? "#fff" : C.muted,
                border:     `1px solid ${isManualMode ? "#f59e0b" : C.border}` }}>
              MANUAL
            </button>
          </div>
        </div>

        {/* AUTO mode — show auto-generated invoices */}
        {!isManualMode && hasAutoInvoice && (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
            {invoicesData.map((inv: any) => (
              <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "#f8fafc", border: `1px solid ${C.border}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: C.text }}>{inv.docNum}</span>
                    <InvoiceStatusBadge status={inv.status} />
                  </div>
                  {inv.subject && <div style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>{inv.subject}</div>}
                  <div style={{ fontSize: 11, color: C.faint }}>
                    {new Date(inv.issueDate).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
                    {" · "}
                    <span style={{ fontWeight: 600, color: C.text }}>{(inv.total / 100).toFixed(2)} {inv.currency}</span>
                  </div>
                </div>
                <a href={`/admin/sales/${inv.id}`} target="_blank" rel="noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", fontSize: 11, fontWeight: 600, color: C.primary, textDecoration: "none", border: `1px solid ${C.primaryMid}`, background: C.primaryBg, flexShrink: 0 }}>
                  <Icon name="externalLink" size={11} color={C.primary} />
                  Open
                </a>
              </div>
            ))}
            <div style={{ fontSize: 10, color: C.faint, paddingLeft: 2 }}>Auto-generated — manage from the Sales module</div>
          </div>
        )}

        {/* AUTO mode — no invoice yet, show manual fields */}
        {!isManualMode && !hasAutoInvoice && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <span style={LBL}>Invoice / Reference No.</span>
              <input value={invNum} onChange={e => setInvNum(e.target.value)} style={INP} placeholder="e.g. CY-INV-5250" />
            </div>
            <div>
              <span style={LBL}>Payment Reference</span>
              <input value={ref} onChange={e => setRef(e.target.value)} style={INP} placeholder="Bank transfer ref, cheque no…" />
            </div>
          </div>
        )}

        {/* MANUAL mode — invoice lookup + line selection */}
        {isManualMode && (
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>

            {/* Lookup input */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={docNumInput} onChange={e => setDocNumInput(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === "Enter") void lookupInvoice(); }}
                style={{ ...INP, flex: 1 }} placeholder="Enter invoice number e.g. CY-INV-5250"
              />
              <button onClick={() => void lookupInvoice()} disabled={lookupLoading || !docNumInput.trim()}
                style={{ padding: "7px 16px", fontSize: 12, fontWeight: 700, fontFamily: "inherit", background: C.primary, color: "#fff", border: "none", cursor: lookupLoading ? "wait" : "pointer", flexShrink: 0 }}>
                {lookupLoading ? "Looking up…" : "Look up"}
              </button>
            </div>

            {lookupError && (
              <div style={{ fontSize: 12, color: "#dc2626", padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", display: "flex", alignItems: "center", gap: 6 }}>
                <Icon name="alertCircle" size={13} color="#dc2626" /> {lookupError}
              </div>
            )}

            {/* Already linked invoice */}
            {!lookedUpInvoice && initManualInvoice && (
              <div style={{ padding: "10px 14px", background: "#f8fafc", border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Currently Linked</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: C.text }}>{initManualInvoice.docNum}</span>
                  <InvoiceStatusBadge status={initManualInvoice.status} />
                  <span style={{ fontSize: 11, color: C.faint, marginLeft: 4 }}>{(initManualInvoice.total / 100).toFixed(2)} {initManualInvoice.currency}</span>
                  <a href={`/admin/sales/${initManualInvoice.id}`} target="_blank" rel="noreferrer"
                    style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: C.primary, textDecoration: "none" }}>
                    <Icon name="externalLink" size={11} color={C.primary} /> Open
                  </a>
                </div>
                {initSelectedLineIds.length > 0 && (
                  <div style={{ marginTop: 8, fontSize: 11, color: C.muted }}>
                    {initSelectedLineIds.length} line{initSelectedLineIds.length !== 1 ? "s" : ""} selected from this invoice
                  </div>
                )}
              </div>
            )}

            {/* Looked up invoice — line selection */}
            {lookedUpInvoice && (
              <div style={{ border: `1px solid ${C.border}` }}>
                {/* Invoice header */}
                <div style={{ padding: "10px 14px", background: C.primaryBg, borderBottom: `1px solid ${C.primaryMid}`, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700, color: C.text }}>{lookedUpInvoice.docNum}</span>
                  <InvoiceStatusBadge status={lookedUpInvoice.status} />
                  <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>Total: {(lookedUpInvoice.total / 100).toFixed(2)} {lookedUpInvoice.currency}</span>
                  <a href={`/admin/sales/${lookedUpInvoice.id}`} target="_blank" rel="noreferrer"
                    style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: C.primary, textDecoration: "none" }}>
                    <Icon name="externalLink" size={11} color={C.primary} /> Open
                  </a>
                </div>

                {/* Line items */}
                <div style={{ padding: "8px 0" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, padding: "4px 14px 8px", textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
                    Select lines that belong to this subscription
                  </div>
                  {lookedUpInvoice.lines.map((line: any) => {
                    const checked = selectedLines.includes(line.id);
                    return (
                      <label key={line.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", cursor: "pointer", background: checked ? C.primaryBg : "#fff", borderBottom: `1px solid ${C.borderL}`, transition: "background 0.1s" }}>
                        <input type="checkbox" checked={checked} onChange={e => setSelectedLines(prev => e.target.checked ? [...prev, line.id] : prev.filter(x => x !== line.id))} style={{ accentColor: C.primary, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12, color: C.text }}>{line.description}</span>
                        <span style={{ fontSize: 11, color: C.faint }}>×{Number(line.quantity)}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.primary, flexShrink: 0 }}>{(line.lineTotal / 100).toFixed(2)}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Totals */}
                {selectedLines.length > 0 && (
                  <div style={{ padding: "10px 14px", background: "#f8fafc", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: 11, color: C.muted }}>{selectedLines.length} line{selectedLines.length !== 1 ? "s" : ""} selected</div>
                    <div style={{ display: "flex", gap: 20 }}>
                      <div style={{ textAlign: "right" as const }}>
                        <div style={{ fontSize: 9, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>This subscription</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.primary }}>{(selectedLinesTotal / 100).toFixed(2)} {lookedUpInvoice.currency}</div>
                      </div>
                      <div style={{ textAlign: "right" as const }}>
                        <div style={{ fontSize: 9, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Invoice total</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{(lookedUpInvoice.total / 100).toFixed(2)} {lookedUpInvoice.currency}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Save link button */}
                <div style={{ padding: "10px 14px", borderTop: `1px solid ${C.border}`, display: "flex", justifyContent: "flex-end" }}>
                  <button onClick={() => void saveLink()} disabled={savingLink || selectedLines.length === 0}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 12, fontWeight: 700, fontFamily: "inherit", background: linkSaved ? "#f0fdf4" : C.primary, color: linkSaved ? "#15803d" : "#fff", border: `1px solid ${linkSaved ? "#86efac" : C.primary}`, cursor: savingLink ? "wait" : "pointer" }}>
                    <Icon name={linkSaved ? "check" : "save"} size={12} color={linkSaved ? "#15803d" : "#fff"} />
                    {savingLink ? "Saving…" : linkSaved ? "Linked!" : "Link Invoice"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Billing Period + Payment Status ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ padding: "10px 14px", background: C.primaryBg, border: `1px solid ${C.primaryMid}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Billing Period</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{PERIOD_LABELS[sub.billingPeriod] ?? sub.billingPeriod}</div>
          <div style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>chosen at creation</div>
        </div>
        {(() => {
          // Payment status always comes from the linked invoice — auto or manual
          const linkedInvoice = invoicesData[0] ?? lookedUpInvoice ?? initManualInvoice ?? null;

          if (linkedInvoice) {
            const invStatus = linkedInvoice.status as string;
            const map: Record<string, { bg: string; border: string; color: string; label: string }> = {
              DRAFT:          { bg: "#f8fafc", border: "#cbd5e1", color: "#64748b", label: "Draft — not yet issued" },
              ISSUED:         { bg: "#eff6ff", border: "#93c5fd", color: "#1d4ed8", label: "Issued — awaiting payment" },
              SENT:           { bg: "#eff6ff", border: "#93c5fd", color: "#1d4ed8", label: "Sent — awaiting payment" },
              PARTIALLY_PAID: { bg: "#fff7ed", border: "#fdba74", color: "#c2410c", label: "Partially Paid" },
              PAID:           { bg: "#f0fdf4", border: "#86efac", color: "#15803d", label: "✓ Paid" },
              OVERDUE:        { bg: "#fef2f2", border: "#fca5a5", color: "#dc2626", label: "Overdue" },
              VOID:           { bg: "#f8fafc", border: "#e2e8f0", color: "#94a3b8", label: "Void" },
            };
            const m = map[invStatus] ?? map.DRAFT;
            return (
              <div style={{ padding: "10px 14px", background: m.bg, border: `1px solid ${m.border}` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Payment Status</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.label}</div>
                <div style={{ fontSize: 11, color: m.color, marginTop: 4, lineHeight: 1.6 }}>
                  <div>Invoice total: {(linkedInvoice.total / 100).toFixed(2)} {linkedInvoice.currency}</div>
                </div>
              </div>
            );
          }

          // No invoice linked yet — neutral placeholder
          return (
            <div style={{ padding: "10px 14px", background: "#f8fafc", border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Payment Status</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.muted }}>No invoice linked yet</div>
              <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>
                {grandTotalCents > 0 && <div>Estimated total: {grandTotal.toFixed(2)} {currency}</div>}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ── Metered upgrade ── */}
      {sub.product.tags?.some((t: any) => t.key === "metered") && sub.status === "ACTIVE" && (
        <MeteredUpgradePanel sub={sub} currency={currency} onChanged={onChanged} />
      )}

      {/* ── Pre-activation Settings ── */}
      {sub.status !== "ACTIVE" && hasOtherPeriods && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "12px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="settings" size={13} color="#d97706" />
            Pre-activation Settings — editable before approving
          </div>
          <div>
            <span style={LBL}>Billing Period</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" as const }}>
              <select value={billingPeriod} onChange={e => setBillingPeriod(e.target.value)} style={{ ...INP, maxWidth: 200 }}>
                {availablePeriods.map((bp: string) => (
                  <option key={bp} value={bp}>{PERIOD_LABELS[bp] ?? bp}</option>
                ))}
              </select>
              {billingPeriod !== sub.billingPeriod && (
                !planAvailable
                  ? <span style={{ fontSize: 11, color: "#dc2626", display: "flex", alignItems: "center", gap: 4 }}><Icon name="alertCircle" size={12} color="#dc2626" />No pricing for this period</span>
                  : <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><Icon name="check" size={12} color="#15803d" />New total: {grandTotal.toFixed(2)} {currency}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Current period progress bar ── */}
      {sub.currentPeriodStart && sub.currentPeriodEnd && (
        <div style={{ background: "#f8fafc", border: `1px solid ${C.border}`, padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Current Period</span>
            {d !== null && sub.status === "ACTIVE" && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", background: d<=7?"#fef2f2":d<=30?"#fffbeb":"#f0fdf4", color: d<=7?"#dc2626":d<=30?"#d97706":"#15803d", border: `1px solid ${d<=7?"#fca5a5":d<=30?"#fde68a":"#86efac"}` }}>
                {d <= 0 ? "Expired" : `${d} days remaining`}
              </span>
            )}
          </div>
          <div style={{ height: 8, background: "#e2e8f0", overflow: "hidden", marginBottom: 6 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: pct>90?"#ef4444":pct>70?"#f59e0b":C.primary, transition: "width 0.4s" }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.faint }}>
            <span>Start: {fmtDate(sub.currentPeriodStart)}</span>
            <span>End: {fmtDate(sub.currentPeriodEnd)}</span>
          </div>
        </div>
      )}

      {/* ── Urgent renewal banner ── */}
      {urgent && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#fffbeb", border: "1px solid #fde68a" }}>
          <Icon name="alertTriangle" size={14} color="#d97706" />
          <div>
            <span style={{ fontSize: 12, color: "#92400e", fontWeight: 700 }}>Renewal due in {d} day{d !== 1 ? "s" : ""}</span>
            <span style={{ fontSize: 11, color: "#b45309", marginLeft: 8 }}>Set new start/end dates below and save to renew.</span>
          </div>
        </div>
      )}

      {/* ── Activation / period dates ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="calendar" size={13} color={C.primary} />
          Subscription Period & Activation
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <span style={LBL}>Period Start</span>
            <input type="date" value={start} onChange={e => setStart(e.target.value)} style={INP} />
          </div>
          <div>
            <span style={LBL}>Period End</span>
            <input type="date" value={end} onChange={e => setEnd(e.target.value)} style={INP} />
          </div>
          <div>
            <span style={LBL}>Payment / Activation Date</span>
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={INP} />
          </div>
        </div>
      </div>

      {/* ── Price override ── */}
      <div style={{ background: "#f8fafc", border: `1px solid ${C.border}`, padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: useOverride ? 12 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="dollarSign" size={13} color={C.muted} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>Price Override</span>
            <span style={{ fontSize: 11, color: C.faint }}>Override catalog price for this subscription only</span>
          </div>
          <div onClick={() => setUseOverride(v => !v)} style={{ width: 36, height: 20, borderRadius: 10, background: useOverride ? C.primary : "#cbd5e1", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
            <div style={{ position: "absolute", top: 2, left: useOverride ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </div>
        </div>
        {useOverride && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{sub.market.name.includes("SAR") ? "SAR" : "USD"}</span>
            <input type="number" value={overrideAmt} onChange={e => setOverrideAmt(e.target.value)} style={{ ...INP, width: 180 }} placeholder="0.00" step="0.01" min="0" />
            <span style={{ fontSize: 11, color: C.faint }}>This will override catalog pricing for billing records.</span>
          </div>
        )}
      </div>

      {/* ── Billing summary ── */}
      {sub.resolvedPriceCents != null && (
        <div style={{ background: "#f8fafc", border: `1px solid ${C.border}`, padding: "12px 14px" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 10 }}>Billing Summary</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ color: C.muted }}>{sub.product.name}</span>
              <span style={{ fontWeight: 600, color: C.text }}>{(sub.resolvedPriceCents / 100).toFixed(2)} {currency}</span>
            </div>
            {addons.map(a => {
              const isPct    = a.product.addonPricingType === "percentage";
              const pct      = Number(a.product.addonPercentage ?? 0);
              const qty      = a.quantity ?? 1;
              const addonCents = isPct ? Math.round((sub.resolvedPriceCents ?? 0) * (pct / 100)) : (a.resolvedPriceCents ?? 0) * qty;
              return (
                <div key={a.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: C.muted }}>↳ {a.product.name}{isPct ? ` (${pct}%)` : qty > 1 ? ` ×${qty}` : ""}</span>
                  <span style={{ fontWeight: 600, color: C.text }}>{(addonCents / 100).toFixed(2)} {currency}</span>
                </div>
              );
            })}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
              <span style={{ color: C.text }}>Total</span>
              <span style={{ color: C.primary }}>
                {(() => {
                  const pc = sub.resolvedPriceCents ?? 0;
                  const at = addons.reduce((acc, a) => {
                    const isPct = a.product.addonPricingType === "percentage";
                    const pct   = Number(a.product.addonPercentage ?? 0);
                    const qty   = a.quantity ?? 1;
                    return acc + (isPct ? Math.round(pc * (pct / 100)) : (a.resolvedPriceCents ?? 0) * qty);
                  }, 0);
                  return ((pc + at) / 100).toFixed(2);
                })()} {currency}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Pro-rate notice ── */}
      {sub.productNote && sub.productNote.startsWith("Pro-rated") && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 14px", background: "#eff6ff", border: "1px solid #93c5fd" }}>
          <span style={{ marginTop: 1, flexShrink: 0 }}><Icon name="info" size={13} color="#2563eb" /></span>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", marginBottom: 2 }}>Mid-subscription — Pro-rated Pricing</div>
            <div style={{ fontSize: 11, color: "#1e40af" }}>{sub.productNote}</div>
          </div>
        </div>
      )}

      {/* ── Billing history ── */}
      <BillingHistoryTable sub={sub} grandTotal={grandTotal} currency={currency} linkedInvoice={invoicesData[0] ?? lookedUpInvoice ?? initManualInvoice ?? null} renewalData={renewalData} />

      {msg && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", fontSize: 12, color: "#dc2626" }}>
          <Icon name="alertCircle" size={13} color="#dc2626" /> {msg}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
        <SaveBtn busy={busy} saved={saved} activeLabel={sub.status === "ACTIVE" ? "Update Billing" : "Approve & Activate"} onClick={save} />
      </div>
    </div>
  );
}

// ─── Details tab ────────────────────────────────────────────────────────────────
function DetailsTab({ sub, onChanged }: { sub: SubRow; onChanged: () => void }) {
  const [details,      setDetails]      = useState(sub.productDetails ?? "");
  const [note,         setNote]         = useState(sub.productNote    ?? "");
  const [locationCode, setLocationCode] = useState(sub.locationCode   ?? "");
  const [templateSlug, setTemplateSlug] = useState((sub as any).templateSlug ?? "");
  const [busy,         setBusy]         = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [msg,          setMsg]          = useState<string | null>(null);

  const isPlan = sub.product.type === "plan";

  function getName() { return details.split("\n")[0] ?? ""; }
  function setName(v: string) { const lines = details.split("\n"); lines[0] = v; setDetails(lines.join("\n")); }
  function getDetails() { if (!isPlan) return details; return details.split("\n").slice(1).join("\n"); }
  function setDetailsOnly(v: string) { if (!isPlan) { setDetails(v); return; } const name = details.split("\n")[0] ?? ""; setDetails([name, v].join("\n")); }

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const trimmedCode = locationCode.trim().toUpperCase();
      if (trimmedCode && trimmedCode !== (sub.locationCode ?? "").toUpperCase()) {
        const locResp = await fetch(`/api/admin/catalog/locations`, { cache: "no-store" });
        const locData = await locResp.json().catch(() => null);
        const locations: { code: string }[] = locData?.data ?? [];
        const valid = locations.some(l => l.code.toUpperCase() === trimmedCode);
        if (!valid) { setMsg(`Location code "${trimmedCode}" not found. Check admin catalog locations.`); setBusy(false); return; }
      }

      const r = await fetch("/api/admin/subscriptions/update-details", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId: sub.id,
          productDetails: details,
          productNote:    note,
          locationCode:   trimmedCode || null,
          templateSlug:   templateSlug.trim() || null,
        }),
      });
      const j = await r.json().catch(() => null) as unknown;
      if (!r.ok || !isRecord(j) || !readBoolean(j, "ok")) {
        setMsg(isRecord(j) ? (readString(j, "error") ?? "Save failed") : "Save failed"); return;
      }
      setSaved(true); setTimeout(() => setSaved(false), 2000); onChanged();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {isPlan && (
        <div>
          <span style={LBL}>Server / Subscription Name</span>
          <input value={getName()} onChange={e => setName(e.target.value)} style={INP} placeholder="e.g. Production Server, Dev Server…" />
          <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>Shown in customer portal as the server name</div>
        </div>
      )}

      <div>
        <span style={LBL}>Location Code</span>
        <input value={locationCode} onChange={e => setLocationCode(e.target.value.toUpperCase())} style={INP} placeholder="e.g. JED, RUH, EUR" maxLength={20} />
        <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>Must match an existing location code — validated on save</div>
      </div>

      <div>
        <span style={LBL}>OS Template</span>
        <input value={templateSlug} onChange={e => setTemplateSlug(e.target.value.trim())} style={INP} placeholder="e.g. ubuntu-22-04, windows-2022" />
        <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>Template slug assigned at subscription creation</div>
      </div>

      <div>
        <span style={LBL}>Customer-visible Details</span>
        <textarea rows={3} value={getDetails()} onChange={e => setDetailsOnly(e.target.value)} style={{ ...INP, resize: "vertical" as const }} placeholder="e.g. domain, username…" />
      </div>
      <div>
        <span style={LBL}>Note</span>
        <textarea rows={3} value={note} onChange={e => setNote(e.target.value)} style={{ ...INP, resize: "vertical" as const }} placeholder="Extra instructions…" />
      </div>
      {msg && <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#dc2626" }}><Icon name="alertCircle" size={13} color="#dc2626" />{msg}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SaveBtn busy={busy} saved={saved} activeLabel="Save Details" onClick={save} />
      </div>
    </div>
  );
}

// ─── VPS tab ────────────────────────────────────────────────────────────────────
function detectVpsProvider(sub: SubRow): "ORACLE" | "HETZNER" | null {
  const catKey = sub.product.category?.key;
  if (catKey !== "server") return null;
  const tags = (sub.product as any).tags as { key: string }[] | undefined ?? [];
  const tagKeys = tags.map(t => t.key.toLowerCase());
  if (tagKeys.includes("or")) return "ORACLE";
  if (tagKeys.includes("hz")) return "HETZNER";
  if (sub.servers.some(s => s.oracleInstanceId)) return "ORACLE";
  if (sub.servers.some(s => s.hetznerServerId))  return "HETZNER";
  return "ORACLE";
}

function VpsTab({ sub, vpsData, onChanged }: { sub: SubRow; vpsData: any; onChanged: () => void }) {
  const provider = detectVpsProvider(sub);
  const [instanceId,  setInstanceId]  = useState("");
  const [region,      setRegion]      = useState("");
  const [compartment, setCompartment] = useState("");
  const [serverId,    setServerId]    = useState("");
  const [projectKey,  setProjectKey]  = useState("");
  const [loaded,  setLoaded]  = useState(false);
  const [busy,    setBusy]    = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [msg,     setMsg]     = useState<string | null>(null);

  useEffect(() => {
    if (!vpsData) return;
    if (provider === "ORACLE") {
      setInstanceId(vpsData.oracleInstanceId ?? "");
      setRegion(vpsData.oracleInstanceRegion ?? "");
      setCompartment(vpsData.oracleCompartmentOcid ?? "");
    } else if (provider === "HETZNER") {
      setServerId(vpsData.hetznerServerId ?? "");
      setProjectKey("");
    }
    setLoaded(true);
  }, [vpsData, provider]);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      let body: Record<string, string> = { provider: provider ?? "" };
      if (provider === "ORACLE") {
        if (!instanceId.trim())  { setMsg("Instance OCID is required.");     setBusy(false); return; }
        if (!region.trim())      { setMsg("Instance Region is required.");   setBusy(false); return; }
        if (!compartment.trim()) { setMsg("Compartment OCID is required."); setBusy(false); return; }
        body = { provider: "ORACLE", oracleInstanceId: instanceId.trim(), oracleInstanceRegion: region.trim(), oracleCompartmentOcid: compartment.trim() };
      } else if (provider === "HETZNER") {
        if (!serverId.trim()) { setMsg("Server ID is required."); setBusy(false); return; }
        body = { provider: "HETZNER", hetznerServerId: serverId.trim() };
        if (projectKey.trim()) body["hetznerApiToken"] = projectKey.trim();
      } else {
        setMsg("Cannot determine VPS provider from product tags."); setBusy(false); return;
      }
      const r = await fetch(`/api/admin/subscriptions/${sub.id}/vps`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null) as any;
      if (!r.ok || !j?.ok) {
        const errMap: Record<string, string> = {
          ORACLE_INSTANCE_ID_REQUIRED:         "Instance OCID is required.",
          ORACLE_INSTANCE_REGION_REQUIRED:     "Instance Region is required.",
          ORACLE_COMPARTMENT_OCID_REQUIRED:    "Compartment OCID is required.",
          ORACLE_INSTANCE_ID_ALREADY_ASSIGNED: "This Instance OCID is already assigned to another subscription.",
          HETZNER_SERVER_ID_REQUIRED:          "Server ID is required.",
          HETZNER_SERVER_ID_MUST_BE_NUMERIC:   "Server ID must be a number.",
          HETZNER_SERVER_ID_ALREADY_ASSIGNED:  "This Server ID is already assigned to another subscription.",
        };
        setMsg(errMap[j?.error] ?? j?.error ?? "Save failed"); return;
      }
      setSaved(true); setProjectKey("");
      setTimeout(() => setSaved(false), 2500);
      onChanged();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  if (!provider) {
    return (
      <div style={{ padding: "20px 14px", background: "#fef9c3", border: "1px solid #fde047", display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="alertCircle" size={14} color="#92400e" />
        <span style={{ fontSize: 12, color: "#92400e" }}>No VPS provider detected. Add a <strong>server</strong> or <strong>vps</strong> tag to the product, plus <strong>or</strong> (Oracle) or <strong>hz</strong> (Hetzner) tag.</span>
      </div>
    );
  }

  if (!loaded) return <div style={{ padding: "20px 0", textAlign: "center" as const, color: C.faint, fontSize: 12 }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: provider === "ORACLE" ? "#eff6ff" : "#f0fdf4", border: `1px solid ${provider === "ORACLE" ? "#93c5fd" : "#86efac"}` }}>
        <Icon name="server" size={13} color={provider === "ORACLE" ? "#2563eb" : "#15803d"} />
        <span style={{ fontSize: 12, fontWeight: 700, color: provider === "ORACLE" ? "#1d4ed8" : "#15803d" }}>
          {provider === "ORACLE" ? "Oracle Cloud Infrastructure" : "Hetzner Cloud"}
        </span>
        {(provider === "ORACLE" ? instanceId : serverId) && (
          <span style={{ fontFamily: "monospace", fontSize: 11, color: C.muted, marginLeft: 4 }}>
            {provider === "ORACLE" ? instanceId : serverId}
          </span>
        )}
      </div>

      {provider === "ORACLE" && (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
          <div>
            <span style={LBL}>Instance OCID <span style={{ color: "#dc2626" }}>*</span></span>
            <input value={instanceId} onChange={e => setInstanceId(e.target.value)} style={INP} placeholder="ocid1.instance.oc1.xxx…" />
            <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>Unique — cannot be assigned to another subscription</div>
          </div>
          <div>
            <span style={LBL}>Instance Region <span style={{ color: "#dc2626" }}>*</span></span>
            <input value={region} onChange={e => setRegion(e.target.value)} style={INP} placeholder="e.g. me-jeddah-1, ap-sydney-1" />
          </div>
          <div>
            <span style={LBL}>Compartment OCID <span style={{ color: "#dc2626" }}>*</span></span>
            <input value={compartment} onChange={e => setCompartment(e.target.value)} style={INP} placeholder="ocid1.compartment.oc1.xxx…" />
          </div>
        </div>
      )}

      {provider === "HETZNER" && (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
          <div>
            <span style={LBL}>Server ID <span style={{ color: "#dc2626" }}>*</span></span>
            <input value={serverId} onChange={e => setServerId(e.target.value)} style={INP} placeholder="e.g. 12345678" />
            <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>Numeric Hetzner server ID — unique across subscriptions</div>
          </div>
          <div>
            <span style={LBL}>Project Key (API Token)</span>
            <input value={projectKey} onChange={e => setProjectKey(e.target.value)} style={INP} placeholder="Leave blank to keep existing key" type="password" />
            <div style={{ fontSize: 10, color: C.faint, marginTop: 3 }}>Always shown blank for security. Leave empty to keep existing value.</div>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", fontSize: 12, color: "#dc2626" }}>
          <Icon name="alertCircle" size={13} color="#dc2626" /> {msg}
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SaveBtn busy={busy} saved={saved} activeLabel="Update VPS" onClick={save} />
      </div>
    </div>
  );
}

// ─── Addons tab ─────────────────────────────────────────────────────────────────
type AvailableAddon = {
  id: string; key: string; name: string;
  addonPricingType: string | null; addonBehavior: string | null;
  addonPercentage: number | null; addonUnitLabel: string | null;
  addonMinUnits: number | null; addonMaxUnits: number | null;
  billingPeriods: string[]; priceCents: number | null;
  subscriptionId: string | null; status: string | null;
  paymentStatus: string | null; quantity: number | null;
  productNote: string | null; isSubscribed: boolean;
};

function AddonsTab({ sub, addons, currency, planPriceCents, planEndDate, addonsData, onChanged, onRefresh }: {
  sub: SubRow; addons: SubRow[]; currency: string;
  planPriceCents: number | null; planEndDate: string | null;
  addonsData: any; onChanged: () => void; onRefresh: () => void;
}) {
  const [available,  setAvailable]  = useState<AvailableAddon[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [adding,     setAdding]     = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  useEffect(() => {
    if (addonsData?.addons) { setAvailable(addonsData.addons); setLoading(false); }
  }, [addonsData]);

  async function addAddon(addonId: string) {
    setAdding(addonId);
    try {
      const qty = quantities[addonId] ?? 1;
      const r = await fetch("/api/admin/subscriptions/create", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: sub.user.id, productId: addonId, billingPeriod: sub.billingPeriod, quantity: qty, parentSubscriptionId: sub.id }),
      });
      const j = await r.json().catch(() => null) as unknown;
      if (!r.ok || !(j as any)?.ok) return;
      onChanged(); onRefresh();
    } finally { setAdding(null); }
  }

  if (loading) return <div style={{ padding: "20px 0", textAlign: "center" as const, color: C.faint, fontSize: 12 }}>Loading addons…</div>;
  if (available.length === 0) return <div style={{ padding: "20px 0", textAlign: "center" as const, color: C.faint, fontSize: 12 }}>No addons available for this plan.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {available.map(addon => {
        const pricingType = addon.addonPricingType;
        const qty         = addon.quantity ?? quantities[addon.id] ?? (addon.addonMinUnits ?? 1);
        const subscribed  = addon.isSubscribed;

        let displayPrice: string;
        let rawCents: number | null = null;
        if (pricingType === "percentage") {
          const pct = addon.addonPercentage ?? 0;
          rawCents  = planPriceCents != null ? Math.round(planPriceCents * (pct / 100)) : null;
          displayPrice = rawCents != null ? `${(rawCents / 100).toFixed(2)} ${currency}` : `${pct}% of plan`;
        } else if (pricingType === "per_unit") {
          rawCents     = addon.priceCents;
          displayPrice = rawCents != null ? `${((rawCents * qty) / 100).toFixed(2)} ${currency}` : "—";
        } else {
          rawCents     = addon.priceCents;
          displayPrice = rawCents != null ? `${(rawCents / 100).toFixed(2)} ${currency}` : "—";
        }

        const ps = addon.paymentStatus;
        const psBg    = ps === "PAID" ? "#f0fdf4" : ps === "PARTIAL" ? "#fff7ed" : "#fef9c3";
        const psColor = ps === "PAID" ? "#15803d" : ps === "PARTIAL" ? "#c2410c" : "#92400e";
        const psBorder= ps === "PAID" ? "#86efac" : ps === "PARTIAL" ? "#fdba74" : "#fde047";
        const psLabel = ps === "PAID" ? "Paid"    : ps === "PARTIAL" ? "Partial" : "Unpaid";

        return (
          <div key={addon.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: subscribed ? "#f8fafc" : "#fff", border: `1px solid ${subscribed ? C.border : C.borderL}`, opacity: subscribed ? 1 : 0.9 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: subscribed ? (ps === "PAID" ? "#22c55e" : ps === "PARTIAL" ? "#f97316" : "#f59e0b") : "#cbd5e1" }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{addon.name}</span>
                {addon.addonBehavior === "required" && <span style={{ fontSize: 9, padding: "1px 5px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", fontWeight: 700 }}>REQUIRED</span>}
              </div>
              {addon.productNote && addon.productNote.startsWith("Pro-rated") && <div style={{ fontSize: 10, color: "#2563eb", marginBottom: 2 }}>{addon.productNote}</div>}
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "monospace", fontSize: 10, color: C.faint }}>{addon.key}</span>
                {pricingType === "percentage" && <span style={{ fontSize: 10, padding: "1px 5px", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", fontWeight: 700 }}>{addon.addonPercentage}% of plan</span>}
                {pricingType === "per_unit" && addon.addonUnitLabel && <span style={{ fontSize: 10, color: C.faint }}>per {addon.addonUnitLabel}</span>}
              </div>
            </div>
            {!subscribed && pricingType === "per_unit" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11, color: C.muted }}>Qty</span>
                <input type="number" min={addon.addonMinUnits ?? 1} max={addon.addonMaxUnits ?? 9999}
                  value={quantities[addon.id] ?? (addon.addonMinUnits ?? 1)}
                  onChange={e => setQuantities(q => ({ ...q, [addon.id]: parseInt(e.target.value) || 1 }))}
                  style={{ ...INP, width: 70 }} />
              </div>
            )}
            {subscribed && pricingType === "per_unit" && qty > 1 && (
              <span style={{ fontSize: 10, padding: "1px 6px", background: "#fff7ed", color: "#c2410c", border: "1px solid #fdba74", fontWeight: 700, flexShrink: 0 }}>×{qty}</span>
            )}
            <div style={{ textAlign: "right" as const, flexShrink: 0, minWidth: 80 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: subscribed ? C.primary : C.muted }}>{displayPrice}</div>
              {pricingType === "per_unit" && !subscribed && rawCents != null && <div style={{ fontSize: 10, color: C.faint }}>{(rawCents / 100).toFixed(2)} each</div>}
            </div>
            {subscribed ? (
              <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", background: psBg, color: psColor, border: `1px solid ${psBorder}`, flexShrink: 0 }}>{psLabel}</span>
            ) : (
              <button onClick={() => void addAddon(addon.id)} disabled={adding === addon.id}
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", fontSize: 11, fontWeight: 700, fontFamily: "inherit", background: C.primary, color: "#fff", border: `1px solid ${C.primary}`, cursor: adding === addon.id ? "wait" : "pointer", flexShrink: 0 }}>
                <Icon name="plus" size={11} color="#fff" />
                {adding === addon.id ? "Adding…" : "Add"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Renewal tab ────────────────────────────────────────────────────────────────
type AddonPrice   = { id: string; name: string; key: string; priceCents: number | null; qty: number };
type RenewalEntry = {
  id: string; periodStart: string; periodEnd: string; billingPeriod: string;
  priceCents: number; addonsCents: number; totalCents: number; currency: string;
  overrideCents: number | null; overrideNote: string | null;
  isAutomatic: boolean; notes: string | null; createdAt: string;
  renewedAddonIds: string;
  renewedBy: { id: string; fullName: string | null; email: string } | null;
};
type RenewalData = {
  currentPeriodStart: string | null; currentPeriodEnd: string | null;
  autoRenew: boolean; billingPeriod: string; renewalBillingPeriod: string;
  renewalPriceCents: number | null; nextPeriodStart: string; nextPeriodEnd: string;
  planPriceCents: number | null; addonPrices: AddonPrice[];
  addonTotalCents: number; grandTotalCents: number | null; currency: string;
  availablePeriods: { billingPeriod: string; priceCents: number }[];
  addons: { id: string; product: { name: string; key: string } }[];
  renewals: RenewalEntry[];
};

function RenewalTab({ sub, renewalData: initialData, onChanged, onRefresh }: { sub: SubRow; renewalData: any; onChanged: () => void; onRefresh: () => void }) {
  const [data,          setData]          = useState<RenewalData | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [autoRenew,     setAutoRenew]     = useState(false);
  const [renewBp,       setRenewBp]       = useState("");
  const [overrideAmt,   setOverrideAmt]   = useState("");
  const [manualBp,      setManualBp]      = useState("");
  const [manualOverride,setManualOverride]= useState("");
  const [overrideNote,  setOverrideNote]  = useState("");
  const [selectedAddons,setSelectedAddons]= useState<string[]>([]);
  const [renewNotes,    setRenewNotes]    = useState("");
  const [showManual,    setShowManual]    = useState(false);
  const [autoInvoice,   setAutoInvoice]   = useState(true);
  const [busy,  setBusy]  = useState(false);
  const [saved, setSaved] = useState(false);
  const [msg,   setMsg]   = useState<string | null>(null);

  function load() { onRefresh(); }

  useEffect(() => {
    if (!initialData) return;
    const d = initialData as RenewalData;
    setData(d); setLoading(false);
    setAutoRenew(d.autoRenew); setRenewBp(d.renewalBillingPeriod);
    setOverrideAmt(d.renewalPriceCents ? (d.renewalPriceCents / 100).toFixed(2) : "");
    setManualBp(d.renewalBillingPeriod);
    setSelectedAddons(d.addons.map((a: any) => a.id));
  }, [initialData]);

  async function saveSettings() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/admin/subscriptions/${sub.id}/renewal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update-settings", autoRenew, renewalBillingPeriod: renewBp || undefined, renewalPriceCents: overrideAmt.trim() ? Math.round(parseFloat(overrideAmt) * 100) : 0 }),
      });
      const j = await r.json().catch(() => null) as any;
      if (!r.ok || !j?.ok) { setMsg(j?.error ?? "Failed"); return; }
      setSaved(true); setTimeout(() => setSaved(false), 2000); load();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  async function renew() {
    if (!manualBp) { setMsg("Select billing period."); return; }
    setBusy(true); setMsg(null);
    try {
      const r = await fetch(`/api/admin/subscriptions/${sub.id}/renewal`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "renew", billingPeriod: manualBp,
          overridePriceCents:  manualOverride.trim() ? Math.round(parseFloat(manualOverride) * 100) : undefined,
          overrideNote:        overrideNote.trim() || undefined,
          renewAddonIds:       selectedAddons,
          notes:               renewNotes.trim() || undefined,
          isAutomatic:         false,
          autoInvoice,
        }),
      });
      const j = await r.json().catch(() => null) as any;
      if (!r.ok || !j?.ok) { setMsg(j?.error ?? "Failed"); return; }
      setShowManual(false); setManualOverride(""); setRenewNotes(""); setOverrideNote("");
      setSaved(true); setTimeout(() => setSaved(false), 2000);
      onChanged(); load();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  if (loading) return <div style={{ padding: "20px 0", textAlign: "center" as const, color: C.faint, fontSize: 12 }}>Loading…</div>;
  if (!data)   return <div style={{ padding: "20px 0", textAlign: "center" as const, color: C.faint, fontSize: 12 }}>Failed to load renewal data.</div>;

  const currency  = data.currency;
  const canRenew  = sub.status !== "CANCELED";

  const manualBpPrice   = data.availablePeriods.find(p => p.billingPeriod === manualBp)?.priceCents ?? null;
  const manualPlanCents = manualOverride.trim() ? Math.round(parseFloat(manualOverride) * 100) : (manualBpPrice ?? 0);
  const manualAddonTotal= data.addonPrices.filter(a => selectedAddons.includes(a.id)).reduce((acc, a) => acc + (a.priceCents ?? 0), 0);
  const manualGrandTotal= manualPlanCents + manualAddonTotal;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* Current period */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div style={{ padding: "10px 14px", background: C.primaryBg, border: `1px solid ${C.primaryMid}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Current Period</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.primary }}>{data.currentPeriodStart ? fmtDate(data.currentPeriodStart) : "—"} → {data.currentPeriodEnd ? fmtDate(data.currentPeriodEnd) : "—"}</div>
          <div style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>{PERIOD_LABELS[data.billingPeriod] ?? data.billingPeriod}</div>
        </div>
        <div style={{ padding: "10px 14px", background: "#f8fafc", border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Next Renewal Period</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{fmtDate(data.nextPeriodStart)} → {fmtDate(data.nextPeriodEnd)}</div>
          <div style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>{PERIOD_LABELS[data.renewalBillingPeriod] ?? data.renewalBillingPeriod}</div>
        </div>
        <div style={{ padding: "10px 14px", background: data.grandTotalCents ? "#f0fdf4" : "#f8fafc", border: `1px solid ${data.grandTotalCents ? "#86efac" : C.border}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Renewal Amount</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: data.grandTotalCents ? C.primary : C.muted }}>{data.grandTotalCents ? `${(data.grandTotalCents / 100).toFixed(2)} ${currency}` : "—"}</div>
          {data.renewalPriceCents && <div style={{ fontSize: 10, color: "#d97706", marginTop: 2 }}>Price override active</div>}
        </div>
      </div>

      {/* Auto-renewal settings */}
      <div style={{ background: "#f8fafc", border: `1px solid ${C.border}`, padding: "14px 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="settings" size={13} color={C.primary} />
          Auto-Renewal Settings
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 16, alignItems: "end" }}>
          <div>
            <span style={LBL}>Auto Renew</span>
            {(() => {
              const manualInvoicing = ((sub as any).invoicingMode ?? "AUTO") === "MANUAL";
              return (<>
                <div
                  onClick={() => { if (!manualInvoicing) setAutoRenew(v => !v); }}
                  style={{ width: 44, height: 24, borderRadius: 12, background: autoRenew && !manualInvoicing ? C.primary : "#cbd5e1", position: "relative", cursor: manualInvoicing ? "not-allowed" : "pointer", transition: "background 0.2s", opacity: manualInvoicing ? 0.5 : 1 }}>
                  <div style={{ position: "absolute" as const, top: 3, left: autoRenew && !manualInvoicing ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                </div>
                <div style={{ fontSize: 10, color: manualInvoicing ? "#dc2626" : C.faint, marginTop: 4 }}>
                  {manualInvoicing ? "Locked — Manual invoicing mode" : autoRenew ? "Will auto-renew on expiry" : "Manual renewal only"}
                </div>
                {manualInvoicing && <div style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>Switch to Auto in Billing tab to enable</div>}
              </>);
            })()}
          </div>
          <div>
            <span style={LBL}>Renewal Billing Period</span>
            <select value={renewBp} onChange={e => setRenewBp(e.target.value)} style={INP}>
              {data.availablePeriods.map(p => (
                <option key={p.billingPeriod} value={p.billingPeriod}>{PERIOD_LABELS[p.billingPeriod] ?? p.billingPeriod} — {(p.priceCents / 100).toFixed(2)} {currency}</option>
              ))}
            </select>
          </div>
          <div>
            <span style={LBL}>Price Override ({currency}) <span style={{ fontWeight: 400, color: C.faint }}>— leave blank to use catalog</span></span>
            <input type="number" step="0.01" min="0" value={overrideAmt} onChange={e => setOverrideAmt(e.target.value)} style={INP} placeholder={data.planPriceCents ? `Catalog: ${(data.planPriceCents / 100).toFixed(2)}` : "e.g. 100.00"} />
          </div>
        </div>
        {msg && <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#dc2626" }}><Icon name="alertCircle" size={13} color="#dc2626" />{msg}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
          <SaveBtn busy={busy} saved={saved} activeLabel="Save Settings" onClick={saveSettings} />
        </div>
      </div>

      {/* Manual renewal */}
      {canRenew && (
        <div style={{ border: `1px solid ${C.border}` }}>
          <div onClick={() => setShowManual(v => !v)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", cursor: "pointer", background: showManual ? "#f0fdf4" : "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="refresh" size={14} color={C.primary} />
              <span style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Manual Renewal</span>
              <span style={{ fontSize: 11, color: C.faint }}>Renew now with custom options</span>
            </div>
            <span style={{ transition: "transform 0.2s", transform: showManual ? "rotate(180deg)" : "rotate(0deg)", display: "flex" }}>
              <Icon name="chevronDown" size={14} color={C.faint} />
            </span>
          </div>

          {showManual && (
            <div style={{ padding: "16px", borderTop: `1px solid ${C.border}`, display: "flex", flexDirection: "column" as const, gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <span style={LBL}>Billing Period</span>
                  <select value={manualBp} onChange={e => setManualBp(e.target.value)} style={INP}>
                    {data.availablePeriods.map(p => (
                      <option key={p.billingPeriod} value={p.billingPeriod}>{PERIOD_LABELS[p.billingPeriod] ?? p.billingPeriod} — {(p.priceCents / 100).toFixed(2)} {currency}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span style={LBL}>Price Override ({currency}) <span style={{ fontWeight: 400, color: C.faint }}>— optional</span></span>
                  <input type="number" step="0.01" min="0" value={manualOverride} onChange={e => setManualOverride(e.target.value)} style={INP} placeholder={manualBpPrice ? `Catalog: ${(manualBpPrice / 100).toFixed(2)}` : "e.g. 100.00"} />
                </div>
                {manualOverride.trim() && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <span style={LBL}>Override Reason</span>
                    <input value={overrideNote} onChange={e => setOverrideNote(e.target.value)} style={INP} placeholder="e.g. Loyalty discount applied" />
                  </div>
                )}
              </div>

              {data.addonPrices.length > 0 && (
                <div>
                  <span style={LBL}>Addons to Renew</span>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, marginTop: 6 }}>
                    {data.addonPrices.map(a => {
                      const checked = selectedAddons.includes(a.id);
                      return (
                        <label key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: checked ? C.primaryBg : "#f8fafc", border: `1px solid ${checked ? C.primaryMid : C.border}`, cursor: "pointer" }}>
                          <input type="checkbox" checked={checked} onChange={e => setSelectedAddons(prev => e.target.checked ? [...prev, a.id] : prev.filter(x => x !== a.id))} style={{ accentColor: C.primary }} />
                          <span style={{ flex: 1, fontSize: 12, fontWeight: 500, color: C.text }}>{a.name}</span>
                          <span style={{ fontFamily: "monospace", fontSize: 10, color: C.faint }}>{a.key}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>{a.priceCents != null ? `${(a.priceCents / 100).toFixed(2)} ${currency}` : "—"}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#f0fdf4", border: "1px solid #86efac" }}>
                <span style={{ fontSize: 12, color: C.muted }}>Plan + {selectedAddons.length} addon{selectedAddons.length !== 1 ? "s" : ""}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.primary }}>{(manualGrandTotal / 100).toFixed(2)} {currency}</span>
              </div>

              {/* Auto-invoice toggle */}
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 12px", background: autoInvoice ? C.primaryBg : "#f8fafc", border: `1px solid ${autoInvoice ? C.primaryMid : C.border}` }}>
                <div onClick={() => setAutoInvoice(v => !v)} style={{ width: 36, height: 20, borderRadius: 10, background: autoInvoice ? C.primary : "#cbd5e1", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
                  <div style={{ position: "absolute", top: 2, left: autoInvoice ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>Auto-generate invoice</div>
                  <div style={{ fontSize: 10, color: C.faint, marginTop: 1 }}>{autoInvoice ? "Invoice will be created automatically" : "No invoice — create manually from Sales module"}</div>
                </div>
              </label>

              <div>
                <span style={LBL}>Notes <span style={{ fontWeight: 400, color: C.faint }}>— optional</span></span>
                <textarea rows={2} value={renewNotes} onChange={e => setRenewNotes(e.target.value)} style={{ ...INP, resize: "vertical" as const }} placeholder="e.g. Renewed after payment confirmation…" />
              </div>

              {msg && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", fontSize: 12, color: "#dc2626" }}>
                  <Icon name="alertCircle" size={13} color="#dc2626" /> {msg}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <SaveBtn busy={busy} saved={saved} activeLabel="Confirm Renewal" onClick={renew} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Renewal history */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="clock" size={13} color={C.primary} />
          Renewal History
        </div>
        {data.renewals.length === 0 ? (
          <div style={{ padding: "16px 0", textAlign: "center" as const, color: C.faint, fontSize: 12 }}>No renewals yet.</div>
        ) : (
          <div style={{ border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 90px 100px 100px 120px 100px", background: "#f8fafc", borderBottom: `1px solid ${C.border}`, padding: "7px 14px", fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
              <div>Period</div><div>Type</div><div>Plan</div><div>Addons</div><div>Total</div><div>Date</div>
            </div>
            {data.renewals.map(r => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 90px 100px 100px 120px 100px", padding: "10px 14px", fontSize: 12, alignItems: "center", borderBottom: `1px solid ${C.borderL}` }}>
                <div>
                  <div style={{ color: C.text, fontWeight: 500 }}>{fmtDate(r.periodStart)} → {fmtDate(r.periodEnd)}</div>
                  <div style={{ fontSize: 10, color: C.faint, marginTop: 1 }}>{PERIOD_LABELS[r.billingPeriod] ?? r.billingPeriod}</div>
                </div>
                <div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", background: r.isAutomatic ? "#eff6ff" : "#f0fdf4", color: r.isAutomatic ? "#2563eb" : "#15803d", border: `1px solid ${r.isAutomatic ? "#93c5fd" : "#86efac"}` }}>
                    {r.isAutomatic ? "AUTO" : "MANUAL"}
                  </span>
                </div>
                <div style={{ fontWeight: 600, color: C.text }}>
                  {r.overrideCents ? (
                    <><span style={{ color: "#d97706" }}>{(r.overrideCents / 100).toFixed(2)}</span><span style={{ fontSize: 9, color: C.faint, marginLeft: 3 }}>override</span></>
                  ) : `${(r.priceCents / 100).toFixed(2)}`}
                  <span style={{ fontSize: 10, color: C.faint, marginLeft: 3 }}>{r.currency}</span>
                </div>
                <div style={{ color: C.muted }}>{r.addonsCents > 0 ? `${(r.addonsCents / 100).toFixed(2)} ${r.currency}` : "—"}</div>
                <div style={{ fontWeight: 700, color: C.primary }}>{(r.totalCents / 100).toFixed(2)} {r.currency}</div>
                <div style={{ fontSize: 11, color: C.faint }}>{fmtDate(r.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Status tab ─────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; bg: string; color: string; border: string; dot: string }> = {
  PENDING_PAYMENT: { label: "Pending Payment", bg: "#fffbeb", color: "#92400e", border: "#fcd34d", dot: "#f59e0b" },
  PROCESSING:      { label: "Processing",      bg: "#eff6ff", color: "#1e40af", border: "#93c5fd", dot: "#3b82f6" },
  ACTIVE:          { label: "Active",          bg: "#f0fdf4", color: "#15803d", border: "#86efac", dot: "#22c55e" },
  SUSPENDED:       { label: "Suspended",       bg: "#fff7ed", color: "#c2410c", border: "#fdba74", dot: "#f97316" },
  EXPIRED:         { label: "Expired",         bg: "#f8fafc", color: "#64748b", border: "#cbd5e1", dot: "#94a3b8" },
  CANCELED:        { label: "Canceled",        bg: "#fef2f2", color: "#dc2626", border: "#fca5a5", dot: "#ef4444" },
};

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING_PAYMENT: ["PROCESSING", "ACTIVE", "SUSPENDED", "CANCELED"],
  PROCESSING:      ["ACTIVE", "PENDING_PAYMENT", "SUSPENDED", "CANCELED"],
  ACTIVE:          ["SUSPENDED", "EXPIRED", "CANCELED"],
  SUSPENDED:       ["ACTIVE", "PENDING_PAYMENT", "CANCELED"],
  EXPIRED:         ["ACTIVE", "CANCELED"],
  CANCELED:        ["PENDING_PAYMENT", "ACTIVE"],
};

type StatusLogEntry = {
  id: string; status: string; comment: string;
  isAutomatic: boolean; createdAt: string;
  changedBy: { id: string; fullName: string | null; email: string } | null;
};

function StatusTab({ sub, statusData, onChanged }: { sub: SubRow; statusData: any; onChanged: () => void }) {
  const [logs,        setLogs]        = useState<StatusLogEntry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [newStatus,   setNewStatus]   = useState("");
  const [comment,     setComment]     = useState("");
  const [periodStart, setPeriodStart] = useState(fmtDateInput(sub.currentPeriodStart));
  const [periodEnd,   setPeriodEnd]   = useState(fmtDateInput(sub.currentPeriodEnd));
  const [busy,        setBusy]        = useState(false);
  const [msg,         setMsg]         = useState<string | null>(null);
  const [saved,       setSaved]       = useState(false);

  const allowedNext = ALLOWED_TRANSITIONS[sub.status] ?? [];

  useEffect(() => {
    if (statusData) { setLogs(statusData.statusLogs ?? []); setLoading(false); }
  }, [statusData, saved]);

  async function changeStatus() {
    if (!newStatus) { setMsg("Select a status."); return; }
    if (!comment.trim()) { setMsg("Comment is required."); return; }
    setBusy(true); setMsg(null);
    try {
      const body: Record<string, string> = { status: newStatus, comment: comment.trim() };
      if (newStatus === "ACTIVE") {
        if (periodStart) body["currentPeriodStart"] = isoFromDateInput(periodStart) ?? "";
        if (periodEnd)   body["currentPeriodEnd"]   = isoFromDateInput(periodEnd)   ?? "";
      }
      const r = await fetch(`/api/admin/subscriptions/${sub.id}/status`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null) as any;
      if (!r.ok || !j?.ok) { setMsg(j?.error ?? "Failed"); return; }
      setSaved(true); setComment(""); setNewStatus("");
      setTimeout(() => setSaved(false), 2500); onChanged();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  const curMeta = STATUS_META[sub.status] ?? STATUS_META.EXPIRED;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", background: curMeta.bg, border: `1px solid ${curMeta.border}` }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: curMeta.dot, flexShrink: 0 }} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: curMeta.color, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 2 }}>Current Status</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: curMeta.color }}>{curMeta.label}</div>
        </div>
      </div>

      {allowedNext.length > 0 && (
        <div style={{ background: "#f8fafc", border: `1px solid ${C.border}`, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="settings" size={13} color={C.primary} />
            Change Status
          </div>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 8, marginBottom: 14 }}>
            {allowedNext.map(s => {
              const m = STATUS_META[s] ?? STATUS_META.EXPIRED;
              const isSelected = newStatus === s;
              return (
                <button key={s} onClick={() => setNewStatus(isSelected ? "" : s)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", fontSize: 12, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", background: isSelected ? m.bg : "#fff", color: isSelected ? m.color : C.muted, border: `2px solid ${isSelected ? m.border : C.border}`, transition: "all 0.15s" }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: isSelected ? m.dot : "#cbd5e1" }} />
                  {m.label}
                </button>
              );
            })}
          </div>

          {newStatus === "ACTIVE" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12, padding: "10px 12px", background: "#f0fdf4", border: "1px solid #86efac" }}>
              <div><span style={LBL}>Period Start</span><input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={INP} /></div>
              <div><span style={LBL}>Period End</span><input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={INP} /></div>
            </div>
          )}

          {newStatus && (
            <div style={{ marginBottom: 12 }}>
              <span style={LBL}>Reason / Comment <span style={{ color: "#dc2626" }}>*</span></span>
              <textarea rows={2} value={comment} onChange={e => setComment(e.target.value)} style={{ ...INP, resize: "vertical" as const }}
                placeholder={newStatus === "SUSPENDED" ? "e.g. Payment overdue…" : newStatus === "CANCELED" ? "e.g. Customer requested cancellation…" : newStatus === "ACTIVE" ? "e.g. Payment received, activating…" : "Reason for status change…"} />
            </div>
          )}

          {msg && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fca5a5", fontSize: 12, color: "#dc2626", marginBottom: 10 }}>
              <Icon name="alertCircle" size={13} color="#dc2626" /> {msg}
            </div>
          )}
          {newStatus && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <SaveBtn busy={busy} saved={saved} activeLabel={`Set ${STATUS_META[newStatus]?.label ?? newStatus}`} onClick={changeStatus} />
            </div>
          )}
        </div>
      )}

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="clock" size={13} color={C.primary} />
          Status History
        </div>
        {loading ? (
          <div style={{ padding: "16px 0", textAlign: "center" as const, color: C.faint, fontSize: 12 }}>Loading…</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: "16px 0", textAlign: "center" as const, color: C.faint, fontSize: 12 }}>No status changes recorded yet.</div>
        ) : (
          <div style={{ position: "relative" as const }}>
            <div style={{ position: "absolute" as const, left: 7, top: 8, bottom: 8, width: 2, background: C.borderL }} />
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
              {logs.map((log, i) => {
                const m = STATUS_META[log.status] ?? STATUS_META.EXPIRED;
                return (
                  <div key={log.id} style={{ display: "flex", gap: 16, paddingBottom: i < logs.length - 1 ? 16 : 0 }}>
                    <div style={{ flexShrink: 0, marginTop: 2, zIndex: 1 }}>
                      <div style={{ width: 16, height: 16, borderRadius: "50%", background: m.bg, border: `2px solid ${m.dot}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot }} />
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.label}</span>
                        {log.isAutomatic && <span style={{ fontSize: 9, padding: "1px 6px", background: "#f1f5f9", color: C.muted, border: `1px solid ${C.border}`, fontWeight: 700 }}>AUTO</span>}
                        <span style={{ fontSize: 10, color: C.faint, marginLeft: "auto" }}>{fmtDate(log.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: C.text, marginBottom: 2 }}>{log.comment}</div>
                      {log.changedBy && <div style={{ fontSize: 10, color: C.faint }}>by {log.changedBy.fullName ?? log.changedBy.email}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Expanded panel ─────────────────────────────────────────────────────────────
type TabKey = "billing" | "details" | "addons" | "vps" | "status" | "renewal";

function ExpandedPanel({ sub, addons, onChanged }: { sub: SubRow; addons: SubRow[]; onChanged: () => void }) {
  const [tab, setTab] = useState<TabKey>("billing");
  const isServer = detectVpsProvider(sub) !== null;
  const currency  = sub.currency ?? (sub.market.name.includes("SAR") ? "SAR" : "USD");

  const [vpsData,         setVpsData]         = useState<any>(null);
  const [addonsData,      setAddonsData]      = useState<any>(null);
  const [renewalData,     setRenewalData]     = useState<any>(null);
  const [statusData,      setStatusData]      = useState<any>(null);
  const [invoicesData,    setInvoicesData]    = useState<any[]>([]);
  const [manualInvoice,   setManualInvoice]   = useState<any | null>(null);
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [panelLoading,    setPanelLoading]    = useState(true);

  function refreshAll() {
    setPanelLoading(true);
    Promise.all([
      fetch(`/api/admin/subscriptions/${sub.id}/vps`,             { cache: "no-store" }).then(r => r.json()).catch(() => null),
      fetch(`/api/admin/subscriptions/available-addons?subscriptionId=${sub.id}`, { cache: "no-store" }).then(r => r.json()).catch(() => null),
      fetch(`/api/admin/subscriptions/${sub.id}/renewal`,         { cache: "no-store" }).then(r => r.json()).catch(() => null),
      fetch(`/api/admin/subscriptions/${sub.id}/status`,          { cache: "no-store" }).then(r => r.json()).catch(() => null),
      fetch(`/api/admin/subscriptions/${sub.id}/invoices`,        { cache: "no-store" }).then(r => r.json()).catch(() => null),
    ]).then(([vps, avail, renewal, status, invoices]) => {
      if (vps?.ok)      setVpsData(vps);
      if (avail?.ok)    setAddonsData(avail);
      if (renewal?.ok)  setRenewalData(renewal.data);
      if (status?.ok)   setStatusData(status.data);
      if (invoices?.ok) {
        setInvoicesData(invoices.invoices ?? []);
        setManualInvoice(invoices.manualInvoice ?? null);
        setSelectedLineIds(invoices.selectedLineIds ?? []);
      }
    }).finally(() => setPanelLoading(false));
  }

  useEffect(() => { refreshAll(); }, [sub.id]);

  function handleChanged() { onChanged(); refreshAll(); }

  const tabs: { key: TabKey; label: string; icon: string; desc: string }[] = [
    { key: "billing", label: "Billing",     icon: "receipt",     desc: "Period, payment & history"  },
    ...(isServer ? [{ key: "vps" as TabKey, label: "Server/VPS", icon: "server",      desc: "Server assignment"           }] : []),
    { key: "addons",  label: "Addons",      icon: "puzzle",      desc: `${addons.length > 0 ? addons.length + " subscribed" : "Available addons"}` },
    { key: "details", label: "Details",     icon: "fileText",    desc: "Notes & details"             },
    { key: "renewal", label: "Renewal",     icon: "refresh",     desc: "Auto-renew & history"        },
    { key: "status",  label: "Status",      icon: "alertCircle", desc: "History & change status"     },
  ];

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, display: "flex", minHeight: 200 }}>
      <div style={{ width: 160, flexShrink: 0, borderRight: `1px solid ${C.border}`, background: "#f8fafc", padding: "8px 0" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", padding: "10px 14px", fontFamily: "inherit", cursor: "pointer", border: "none", background: tab === t.key ? "#fff" : "none", borderLeft: `3px solid ${tab === t.key ? C.primary : "transparent"}`, textAlign: "left" as const, transition: "all 0.1s" }}>
            <span style={{ marginTop: 1, flexShrink: 0 }}><Icon name={t.icon} size={14} color={tab === t.key ? C.primary : C.faint} /></span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: tab === t.key ? C.primary : C.text, lineHeight: 1.3 }}>{t.label}</div>
              <div style={{ fontSize: 10, color: C.faint, marginTop: 2, lineHeight: 1.3 }}>{t.desc}</div>
            </div>
          </button>
        ))}
      </div>

      <div style={{ flex: 1, padding: "20px 24px", overflowX: "auto" }}>
        {tab === "billing" && <BillingTab sub={sub} addons={addons} currency={currency} renewalData={renewalData} invoicesData={invoicesData} manualInvoice={manualInvoice} selectedLineIds={selectedLineIds} onChanged={handleChanged} />}
        {tab === "details" && <DetailsTab sub={sub} onChanged={handleChanged} />}
        {tab === "status"  && <StatusTab  sub={sub} statusData={statusData}   onChanged={handleChanged} />}
        {tab === "renewal" && <RenewalTab sub={sub} renewalData={renewalData} onChanged={handleChanged} onRefresh={refreshAll} />}
        {tab === "addons"  && <AddonsTab  sub={sub} addons={addons} currency={currency} planPriceCents={sub.resolvedPriceCents} planEndDate={sub.currentPeriodEnd} addonsData={addonsData} onChanged={handleChanged} onRefresh={refreshAll} />}
        {tab === "vps"     && <VpsTab     sub={sub} vpsData={vpsData}         onChanged={handleChanged} />}
      </div>
    </div>
  );
}

// ─── Table row ──────────────────────────────────────────────────────────────────
const COLS = "2.2fr 1.8fr 110px 110px 130px 130px 32px";

function SubRowItem({ sub, addons, isOpen, onToggle, onChanged }: {
  sub: SubRow; addons: SubRow[]; isOpen: boolean;
  onToggle: () => void; onChanged: () => void;
}) {
  const hasServer = sub.servers.some(x => x.hetznerServerId) || sub.servers.some(x => x.oracleInstanceId);
  const isOneTime = !sub.currentPeriodEnd && sub.product.type === "service";

  return (
    <div style={{ borderBottom: `1px solid ${C.borderL}` }}>
      <div onClick={onToggle} style={{ display:"grid", gridTemplateColumns:COLS, gap:12, alignItems:"center", padding:"12px 20px", cursor:"pointer", background:isOpen?"#f0fdf4":"#fff", borderLeft:`3px solid ${isOpen?C.primary:"transparent"}`, transition:"background 0.12s" }}>
        <div>
          <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:1 }}>{(sub.user as any).fullName ?? sub.user.email.split("@")[0]}</div>
          <div style={{ fontSize:11, color:C.faint }}>{sub.user.email}</div>
          {addons.length > 0 && <div style={{ fontSize:10, color:C.primary, marginTop:2, fontWeight:600 }}>{addons.length} addon{addons.length>1?"s":""}</div>}
        </div>
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
            <span style={{ fontSize:13, fontWeight:500, color:C.text }}>{sub.product.name}</span>
            {hasServer && <Icon name="server" size={11} color={C.primary} />}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ fontFamily:"monospace", fontSize:10, color:C.faint }}>{sub.product.key}</span>
            <TypeBadge type={sub.product.type} />
          </div>
          <div style={{ fontFamily:"monospace", fontSize:10, color:C.faint, marginTop:2 }}>{sub.id}</div>
        </div>
        <div><StatusBadge status={sub.status} /></div>
        <div><PayBadge paymentStatus={sub.paymentStatus} /></div>
        <div>
          {isOneTime
            ? <span style={{ fontSize:11, padding:"2px 7px", background:"#f1f5f9", color:C.muted, border:`1px solid ${C.border}` }}>One-time</span>
            : <ExpiryDisplay endIso={sub.currentPeriodEnd} status={sub.status} />
          }
        </div>
        <div style={{ fontSize:11, color:C.muted }}>{sub.market.name}</div>
        <div style={{ display:"flex", justifyContent:"center" }}>
          <span style={{ transition:"transform 0.2s", transform:isOpen?"rotate(180deg)":"rotate(0deg)", display:"flex" }}>
            <Icon name="chevronDown" size={14} color={isOpen?C.primary:C.faint} />
          </span>
        </div>
      </div>
      {isOpen && <ExpandedPanel sub={sub} addons={addons} onChanged={onChanged} />}
    </div>
  );
}

// ─── Column header ──────────────────────────────────────────────────────────────
function ColHeader() {
  return (
    <div style={{ display:"grid", gridTemplateColumns:COLS, gap:12, padding:"9px 20px", background:"#f8fafc", borderBottom:`1px solid ${C.border}`, fontSize:10, fontWeight:700, color:C.faint, textTransform:"uppercase" as const, letterSpacing:"0.07em" }}>
      <div>Customer</div><div>Product</div><div>Status</div><div>Payment</div><div>Expiry</div><div>Market</div><div />
    </div>
  );
}

// ─── Main export ────────────────────────────────────────────────────────────────
export function SubscriptionsDataTable({ rows, loading, onChanged }: { rows: SubRow[]; loading: boolean; onChanged: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addonsByParent = new Map<string, SubRow[]>();
  const unlinkedAddons: SubRow[] = [];
  for (const r of rows) {
    if (r.product.type === "addon") {
      const pid = (r as any).parentSubscriptionId;
      if (pid) {
        if (!addonsByParent.has(pid)) addonsByParent.set(pid, []);
        addonsByParent.get(pid)!.push(r);
      } else { unlinkedAddons.push(r); }
    }
  }
  const ordered = [
    ...rows.filter(r => r.product.type !== "addon"),
    ...unlinkedAddons,
  ].map(sub => ({ sub, addons: addonsByParent.get(sub.id) ?? [] }));

  if (loading) {
    return (
      <div style={{ background:"#fff", padding:"60px 20px", textAlign:"center" }}>
        <div style={{ display:"inline-flex", flexDirection:"column", alignItems:"center", gap:10, color:C.faint }}>
          <Icon name="loader" size={22} color={C.primaryMid} />
          <span style={{ fontSize:13 }}>Loading subscriptions…</span>
        </div>
      </div>
    );
  }

  if (ordered.length === 0) {
    return (
      <div style={{ background:"#fff", padding:"60px 20px", textAlign:"center" }}>
        <div style={{ display:"inline-flex", flexDirection:"column", alignItems:"center", gap:8, color:C.faint }}>
          <Icon name="layers" size={28} color="#cbd5e1" />
          <span style={{ fontSize:14, fontWeight:500, color:C.muted }}>No subscriptions found</span>
          <span style={{ fontSize:12 }}>Try adjusting the filters</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background:"#fff" }}>
      <ColHeader />
      {ordered.map(({ sub, addons }) => (
        <SubRowItem key={sub.id} sub={sub} addons={addons}
          isOpen={expandedId === sub.id}
          onToggle={() => setExpandedId(prev => prev === sub.id ? null : sub.id)}
          onChanged={onChanged} />
      ))}
    </div>
  );
}