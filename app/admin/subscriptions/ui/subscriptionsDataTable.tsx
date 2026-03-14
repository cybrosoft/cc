"use client";
// app/admin/subscriptions/ui/subscriptionsDataTable.tsx

import { useRef, useState } from "react";
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
  PENDING_EXTERNAL: { label: "Pending External", bg: "#eff6ff", color: "#1e40af", border: "#93c5fd", dot: "#3b82f6"  },
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
  const paid = paymentStatus === "PAID";
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:11, fontWeight:600, padding:"3px 8px", background:paid?"#f0fdf4":"#fef9c3", color:paid?"#15803d":"#92400e", border:`1px solid ${paid?"#86efac":"#fde047"}` }}>
      <Icon name={paid?"check":"clock"} size={10} color={paid?"#15803d":"#92400e"} />
      {paid ? "Paid" : "Unpaid"}
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

// ─── Billing tab — full featured ────────────────────────────────────────────────
function BillingTab({ sub, onChanged }: { sub: SubRow; onChanged: () => void }) {
  // Pre-activation editable fields
  const [billingPeriod, setBillingPeriod] = useState(sub.billingPeriod ?? "YEARLY");
  const [location,      setLocation]      = useState(sub.locationCode ?? "");
  // Activation fields
  const [start,    setStart]    = useState(fmtDateInput(sub.currentPeriodStart));
  const [end,      setEnd]      = useState(fmtDateInput(sub.currentPeriodEnd));
  const [payDate,  setPayDate]  = useState(fmtDateInput(sub.paymentStatus === "PAID" ? sub.currentPeriodStart : null));
  // Payment record fields
  const [amount,   setAmount]   = useState("");
  const [note,     setNote]     = useState("");
  const [invNum,   setInvNum]   = useState(sub.invoiceNumber ?? "");
  const [ref,      setRef]      = useState(sub.manualPaymentReference ?? "");
  // Price override
  const [useOverride, setUseOverride] = useState(false);
  const [overrideAmt, setOverrideAmt] = useState("");
  // Receipt
  const [uploading,   setUploading]   = useState(false);
  const [uploadMsg,   setUploadMsg]   = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Save state
  const [busy,  setBusy]  = useState(false);
  const [msg,   setMsg]   = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isPaid   = sub.paymentStatus === "PAID";
  const currency = sub.currency ?? (sub.market.name.includes("SAR") ? "SAR" : "USD");
  const d        = daysUntil(sub.currentPeriodEnd);
  const urgent   = sub.status === "ACTIVE" && d !== null && d <= 30;

  // Derived totals from entered amount
  const amountNum    = parseFloat(amount) || 0;
  const resolvedPrice = sub.resolvedPriceCents ? sub.resolvedPriceCents / 100 : 0;
  const pendingAmt    = !isPaid && resolvedPrice > 0 ? resolvedPrice : 0;
  const totalLabel    = resolvedPrice > 0 ? `${resolvedPrice.toFixed(2)} ${currency}` : "—";
  const pct    = (() => {
    if (!sub.currentPeriodStart || !sub.currentPeriodEnd) return 0;
    const tot  = new Date(sub.currentPeriodEnd).getTime() - new Date(sub.currentPeriodStart).getTime();
    const elap = Date.now() - new Date(sub.currentPeriodStart).getTime();
    return Math.min(100, Math.max(0, (elap / tot) * 100));
  })();

  async function uploadReceipt(file: File) {
    setUploading(true); setUploadMsg(null);
    try {
      const fd = new FormData();
      fd.append("subscriptionId", sub.id);
      fd.append("file", file);
      const r = await fetch("/api/admin/subscriptions/upload-receipt", { method: "POST", body: fd });
      const j = await r.json().catch(() => null) as unknown;
      if (!r.ok || !isRecord(j) || !readBoolean(j, "ok")) { setUploadMsg("Upload failed"); return; }
      setUploadMsg("✓ Uploaded");
      onChanged();
    } catch { setUploadMsg("Network error"); }
    finally { setUploading(false); }
  }

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
          invoiceNumber:          invNum.trim() || null,
          manualPaymentReference: ref.trim() || null,
          billingPeriod:          billingPeriod || undefined,
          locationCode:           location.trim() || null,

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

      {/* ── Summary cards: total amount + pending ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div style={{ padding: "10px 14px", background: C.primaryBg, border: `1px solid ${C.primaryMid}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Billing Period</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.primary }}>{PERIOD_LABELS[sub.billingPeriod] ?? sub.billingPeriod}</div>
          <div style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>chosen at creation</div>
        </div>
        <div style={{ padding: "10px 14px", background: isPaid ? "#f0fdf4" : "#fef9c3", border: `1px solid ${isPaid ? "#86efac" : "#fde047"}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Payment Status</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: isPaid ? "#15803d" : "#92400e" }}>{isPaid ? "✓ Paid" : "Unpaid"}</div>
          <div style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>
            {sub.resolvedPriceCents ? `${(sub.resolvedPriceCents / 100).toFixed(2)} ${currency}` : "—"}
          </div>
        </div>
        {sub.resolvedPriceCents && (
          <div style={{ padding: "10px 14px", background: "#f8fafc", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Subscription Price</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{(sub.resolvedPriceCents / 100).toFixed(2)} {currency}</div>
            <div style={{ fontSize: 10, color: C.faint, marginTop: 2 }}>{PERIOD_LABELS[sub.billingPeriod] ?? sub.billingPeriod}</div>
          </div>
        )}
        {pendingAmt > 0 && (
          <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fca5a5" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em", marginBottom: 4 }}>Pending Amount</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#dc2626" }}>{resolvedPrice.toFixed(2)} {currency}</div>
            <div style={{ fontSize: 10, color: "#dc2626", marginTop: 2 }}>awaiting payment</div>
          </div>
        )}
      </div>

      {/* ── Pre-activation fields: billing period + location ── */}
      {sub.status !== "ACTIVE" && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "12px 14px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="settings" size={13} color="#d97706" />
            Pre-activation Settings — editable before approving
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <span style={LBL}>Billing Period</span>
              <select value={billingPeriod} onChange={e => setBillingPeriod(e.target.value)} style={{ ...INP }}>
                <option value="MONTHLY">Monthly</option>
                <option value="SIX_MONTHS">6 Months</option>
                <option value="YEARLY">Yearly</option>
                <option value="ONE_TIME">One-time</option>
              </select>
            </div>
            <div>
              <span style={LBL}>Location Code</span>
              <input value={location} onChange={e => setLocation(e.target.value)} style={INP} placeholder="e.g. JED, RUH, FRA" />
            </div>
          </div>
        </div>
      )}

      {/* ── Current period progress bar ── */}
      {sub.currentPeriodStart && sub.currentPeriodEnd && (
        <div style={{ background: "#f8fafc", border: `1px solid ${C.border}`, padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>Current Period</span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {d !== null && sub.status === "ACTIVE" && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", background: d<=7?"#fef2f2":d<=30?"#fffbeb":"#f0fdf4", color: d<=7?"#dc2626":d<=30?"#d97706":"#15803d", border: `1px solid ${d<=7?"#fca5a5":d<=30?"#fde68a":"#86efac"}` }}>
                  {d <= 0 ? "Expired" : `${d} days remaining`}
                </span>
              )}
            </div>
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

      {/* ── Payment record ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="receipt" size={13} color={C.primary} />
          Payment Record
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <span style={LBL}>Invoice / Reference No.</span>
            <input value={invNum} onChange={e => setInvNum(e.target.value)} style={INP} placeholder="e.g. CY-INV-5250" />
          </div>
          <div>
            <span style={LBL}>Payment Reference</span>
            <input value={ref} onChange={e => setRef(e.target.value)} style={INP} placeholder="Bank transfer ref, cheque no…" />
          </div>
          <div>
            <span style={LBL}>Amount Paid ({currency})</span>
            <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} style={INP} placeholder={`e.g. 1200.00`} />
          </div>
          <div>
            <span style={LBL}>Note</span>
            <input value={note} onChange={e => setNote(e.target.value)} style={INP} placeholder="e.g. Annual renewal, bank transfer" />
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
          <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
            <span style={{ fontSize: 11, color: C.muted }}>Enable</span>
            <div onClick={() => setUseOverride(v => !v)} style={{ width: 36, height: 20, borderRadius: 10, background: useOverride ? C.primary : "#cbd5e1", position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 2, left: useOverride ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
            </div>
          </label>
        </div>
        {useOverride && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 12, color: C.muted, flexShrink: 0 }}>{sub.market.name.includes("SAR") ? "SAR" : "USD"}</span>
            <input type="number" value={overrideAmt} onChange={e => setOverrideAmt(e.target.value)} style={{ ...INP, width: 180 }} placeholder="0.00" step="0.01" min="0" />
            <span style={{ fontSize: 11, color: C.faint }}>This will override catalog pricing for billing records.</span>
          </div>
        )}
      </div>

      {/* ── Receipt ── */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <Icon name="upload" size={13} color={C.primary} />
          Receipt
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: uploading ? "wait" : "pointer", fontFamily: "inherit", background: "#fff", color: C.text, border: `1px solid ${C.border}` }}>
            <Icon name="upload" size={13} color={C.muted} />
            {uploading ? "Uploading…" : sub.receiptUrl ? "Re-upload Receipt" : "Upload Receipt"}
            <input ref={fileRef} type="file" style={{ display: "none" }} accept=".pdf,.png,.jpg,.jpeg"
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadReceipt(f); }} />
          </label>
          {sub.receiptUrl && (
            <>
              <a href={sub.receiptUrl} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", fontSize: 12, fontWeight: 600, color: C.primary, textDecoration: "none", border: `1px solid ${C.primaryMid}`, background: C.primaryBg }}>
                <Icon name="externalLink" size={12} color={C.primary} /> View
              </a>
              <a href={sub.receiptUrl} download style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 14px", fontSize: 12, fontWeight: 600, color: C.muted, textDecoration: "none", border: `1px solid ${C.border}`, background: "#fff" }}>
                <Icon name="download" size={12} color={C.muted} /> Download
              </a>
              {sub.receiptUploadedAt && (
                <span style={{ fontSize: 11, color: C.faint }}>Uploaded {fmtDate(sub.receiptUploadedAt)}</span>
              )}
            </>
          )}
          {uploadMsg && (
            <span style={{ fontSize: 11, color: uploadMsg.startsWith("✓") ? "#15803d" : "#dc2626" }}>{uploadMsg}</span>
          )}
          {!sub.receiptUrl && !uploadMsg && (
            <span style={{ fontSize: 11, color: C.faint }}>No receipt uploaded — PDF, PNG or JPG</span>
          )}
        </div>
      </div>

      {/* ── Billing history (single record from DB) ── */}
      {(isPaid || sub.currentPeriodStart) && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.text, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Icon name="clock" size={13} color={C.primary} />
            Billing History
          </div>
          <div style={{ border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 90px 90px 110px 120px 120px", gap: 0, background: "#f8fafc", borderBottom: `1px solid ${C.border}`, padding: "7px 14px", fontSize: 10, fontWeight: 700, color: C.faint, textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>
              <div>Period</div><div>Paid On</div><div>Status</div><div>Amount</div><div>Invoice #</div><div>Reference</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 90px 90px 110px 120px 120px", gap: 0, padding: "10px 14px", fontSize: 12, alignItems: "center" }}>
              <div style={{ color: C.text }}>
                {sub.currentPeriodStart && sub.currentPeriodEnd
                  ? `${fmtDate(sub.currentPeriodStart)} → ${fmtDate(sub.currentPeriodEnd)}`
                  : "One-time / Pending"}
                <div style={{ fontSize: 10, color: C.faint, marginTop: 1 }}>{PERIOD_LABELS[sub.billingPeriod] ?? sub.billingPeriod}</div>
              </div>
              <div style={{ color: isPaid ? C.text : C.faint }}>
                {isPaid ? fmtDate(sub.currentPeriodStart) : "—"}
              </div>
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", background: isPaid ? "#f0fdf4" : "#fef9c3", color: isPaid ? "#15803d" : "#92400e", border: `1px solid ${isPaid ? "#86efac" : "#fde047"}` }}>
                  {isPaid ? "Paid" : "Unpaid"}
                </span>
              </div>
              <div style={{ fontWeight: 600, color: isPaid ? "#15803d" : "#92400e" }}>
                {sub.resolvedPriceCents
                  ? `${(sub.resolvedPriceCents / 100).toFixed(2)} ${currency}`
                  : amountNum > 0 ? `${amountNum.toFixed(2)} ${currency}` : "—"}
              </div>
              <div style={{ color: C.muted, fontFamily: "monospace", fontSize: 11 }}>{sub.invoiceNumber ?? "—"}</div>
              <div style={{ color: C.muted, fontSize: 11 }}>{sub.manualPaymentReference ?? "—"}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Error + Save ── */}
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
  const [details, setDetails] = useState(sub.productDetails ?? "");
  const [note,    setNote]    = useState(sub.productNote    ?? "");
  const [busy,    setBusy]    = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [msg,     setMsg]     = useState<string | null>(null);

  async function save() {
    setBusy(true); setMsg(null);
    try {
      const r = await fetch("/api/admin/subscriptions/update-details", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscriptionId: sub.id, productDetails: details, productNote: note }),
      });
      const j = await r.json().catch(() => null) as unknown;
      if (!r.ok || !isRecord(j) || !readBoolean(j, "ok")) { setMsg(isRecord(j)?(readString(j,"error")??"Save failed"):"Save failed"); return; }
      setSaved(true); setTimeout(() => setSaved(false), 2000); onChanged();
    } catch { setMsg("Network error"); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div><span style={LBL}>Customer-visible Details</span><textarea rows={3} value={details} onChange={e => setDetails(e.target.value)} style={{ ...INP, resize: "vertical" as const }} placeholder="e.g. domain, username…" /></div>
      <div><span style={LBL}>Note</span><textarea rows={3} value={note} onChange={e => setNote(e.target.value)} style={{ ...INP, resize: "vertical" as const }} placeholder="Extra instructions…" /></div>
      {msg && <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#dc2626" }}><Icon name="alertCircle" size={13} color="#dc2626" />{msg}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <SaveBtn busy={busy} saved={saved} activeLabel="Save Details" onClick={save} />
      </div>
    </div>
  );
}

// ─── VPS tab ────────────────────────────────────────────────────────────────────
function VpsTab({ sub, onOpenVps }: { sub: SubRow; onOpenVps: (s: SubRow) => void }) {
  const hasServer = sub.servers.some(x => x.hetznerServerId) || sub.servers.some(x => x.oracleInstanceId);
  const isOracle  = sub.product.category?.key === "servers-o";
  const srv       = sub.servers[0];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
      <div style={{ flex: 1 }}>
        {hasServer ? (
          <div style={{ padding: "12px 14px", background: "#f0fdf4", border: "1px solid #86efac" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Icon name="server" size={14} color="#15803d" />
              <span style={{ fontSize: 12, fontWeight: 700, color: "#15803d" }}>{isOracle ? "Oracle Cloud" : "Hetzner"} — Assigned</span>
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#166534", background: "#dcfce7", padding: "4px 10px", display: "inline-block" }}>
              {isOracle ? srv?.oracleInstanceId ?? "—" : srv?.hetznerServerId ?? "—"}
            </div>
          </div>
        ) : (
          <div style={{ padding: "12px 14px", background: "#f8fafc", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
            <Icon name="server" size={14} color={C.faint} />
            <span style={{ fontSize: 12, color: C.muted }}>No server assigned yet</span>
          </div>
        )}
      </div>
      <button onClick={() => onOpenVps(sub)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", fontSize: 12, fontWeight: 700, fontFamily: "inherit", background: hasServer ? C.primaryBg : C.primary, color: hasServer ? C.primary : "#fff", border: `1px solid ${hasServer ? C.primaryMid : C.primary}`, cursor: "pointer" }}>
        <Icon name={hasServer ? "edit" : "plus"} size={13} color={hasServer ? C.primary : "#fff"} />
        {hasServer ? "Edit VPS" : "Assign VPS"}
      </button>
    </div>
  );
}

// ─── Expanded panel — VERTICAL sidebar tabs ─────────────────────────────────────
type TabKey = "billing" | "details" | "vps";

function ExpandedPanel({ sub, onChanged, onOpenVps }: { sub: SubRow; onChanged: () => void; onOpenVps: (s: SubRow) => void }) {
  const [tab, setTab] = useState<TabKey>("billing");
  const isServer = sub.product.category?.key === "servers-o" || sub.product.category?.key === "servers-g";

  const tabs: { key: TabKey; label: string; icon: string; desc: string }[] = [
    { key: "billing", label: "Billing",  icon: "receipt",  desc: "Period, payment & history" },
    { key: "details", label: "Details",  icon: "fileText", desc: "Notes & details"           },
    ...(isServer ? [{ key: "vps" as TabKey, label: "VPS", icon: "server", desc: "Server assignment" }] : []),
  ];

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, display: "flex", minHeight: 200 }}>
      {/* Vertical tab sidebar */}
      <div style={{ width: 160, flexShrink: 0, borderRight: `1px solid ${C.border}`, background: "#f8fafc", padding: "8px 0" }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              width: "100%", padding: "10px 14px",
              fontFamily: "inherit", cursor: "pointer", border: "none",
              background: tab === t.key ? "#fff" : "none",
              borderLeft: `3px solid ${tab === t.key ? C.primary : "transparent"}`,
              textAlign: "left" as const, transition: "all 0.1s",
            }}
          >
            <Icon name={t.icon} size={14} color={tab === t.key ? C.primary : C.faint} style={{ marginTop: 1, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: tab === t.key ? C.primary : C.text, lineHeight: 1.3 }}>{t.label}</div>
              <div style={{ fontSize: 10, color: C.faint, marginTop: 2, lineHeight: 1.3 }}>{t.desc}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, padding: "20px 24px", overflowX: "auto" }}>
        {tab === "billing" && <BillingTab sub={sub} onChanged={onChanged} />}
        {tab === "details" && <DetailsTab sub={sub} onChanged={onChanged} />}
        {tab === "vps"     && <VpsTab sub={sub} onOpenVps={onOpenVps} />}
      </div>
    </div>
  );
}

// ─── Table row ──────────────────────────────────────────────────────────────────
const COLS = "2.2fr 1.8fr 110px 110px 130px 130px 32px";

function SubRowItem({ sub, isAddon, isOpen, onToggle, onChanged, onOpenVps }: {
  sub: SubRow; isAddon: boolean; isOpen: boolean;
  onToggle: () => void; onChanged: () => void; onOpenVps: (s: SubRow) => void;
}) {
  const hasServer = sub.servers.some(x => x.hetznerServerId) || sub.servers.some(x => x.oracleInstanceId);
  const isOneTime = !sub.currentPeriodEnd && sub.product.type === "service";

  return (
    <div style={{ borderBottom: `1px solid ${C.borderL}` }}>
      <div
        onClick={onToggle}
        style={{ display:"grid", gridTemplateColumns:COLS, gap:12, alignItems:"center", padding:isAddon?"10px 20px 10px 44px":"12px 20px", cursor:"pointer", background:isOpen?"#f0fdf4":isAddon?"#fafbfc":"#fff", borderLeft:`3px solid ${isAddon?C.primaryMid:isOpen?C.primary:"transparent"}`, transition:"background 0.12s" }}
      >
        <div>
          {!isAddon && <div style={{ fontSize:13, fontWeight:600, color:C.text, marginBottom:1 }}>{(sub.user as any).fullName ?? sub.user.email.split("@")[0]}</div>}
          <div style={{ fontSize:isAddon?12:11, color:isAddon?C.muted:C.faint }}>{sub.user.email}</div>
          {isAddon && <div style={{ fontSize:10, color:C.faint, marginTop:1 }}>↳ addon</div>}
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
      {isOpen && <ExpandedPanel sub={sub} onChanged={onChanged} onOpenVps={onOpenVps} />}
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
export function SubscriptionsDataTable({
  rows, loading, onOpenVps, onOpenBilling, onChanged,
}: {
  rows: SubRow[]; loading: boolean;
  onOpenVps: (s: SubRow) => void;
  onOpenBilling: (s: SubRow) => void;
  onChanged: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ordered = (() => {
    const plans  = rows.filter(r => r.product.type !== "addon");
    const addons = rows.filter(r => r.product.type === "addon");
    const result: { sub: SubRow; isAddon: boolean }[] = [];
    for (const plan of plans) {
      result.push({ sub: plan, isAddon: false });
      addons.filter(a => (a as any).parentSubscriptionId === plan.id).forEach(c => result.push({ sub: c, isAddon: true }));
    }
    const linked = new Set(addons.filter(a => (a as any).parentSubscriptionId).map(a => a.id));
    addons.filter(a => !linked.has(a.id)).forEach(a => result.push({ sub: a, isAddon: false }));
    return result;
  })();

  if (loading) {
    return (
      <div style={{ background:"#fff", border:`1px solid ${C.border}`, padding:"60px 20px", textAlign:"center" }}>
        <div style={{ display:"inline-flex", flexDirection:"column", alignItems:"center", gap:10, color:C.faint }}>
          <Icon name="loader" size={22} color={C.primaryMid} />
          <span style={{ fontSize:13 }}>Loading subscriptions…</span>
        </div>
      </div>
    );
  }

  if (ordered.length === 0) {
    return (
      <div style={{ background:"#fff", border:`1px solid ${C.border}`, padding:"60px 20px", textAlign:"center" }}>
        <div style={{ display:"inline-flex", flexDirection:"column", alignItems:"center", gap:8, color:C.faint }}>
          <Icon name="layers" size={28} color="#cbd5e1" />
          <span style={{ fontSize:14, fontWeight:500, color:C.muted }}>No subscriptions found</span>
          <span style={{ fontSize:12 }}>Try adjusting the filters</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background:"#fff", border:`1px solid ${C.border}` }}>
      <ColHeader />
      {ordered.map(({ sub, isAddon }) => (
        <SubRowItem
          key={sub.id} sub={sub} isAddon={isAddon}
          isOpen={expandedId === sub.id}
          onToggle={() => setExpandedId(prev => prev === sub.id ? null : sub.id)}
          onChanged={onChanged}
          onOpenVps={onOpenVps}
        />
      ))}
    </div>
  );
}