// app/admin/system/notifications/tabs/SettingsTab.tsx
"use client";
import React, { useEffect, useState } from "react";
import { CLR } from "@/components/ui/admin-ui";

const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em", marginBottom: 4, display: "block", textTransform: "uppercase" as const };
const card: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", padding: "18px 20px", marginBottom: 14 };

const KEYS = {
  expiryDays:  "notif.expiryDays",
  paymentDays: "notif.paymentDays",
};

export default function SettingsTab() {
  const [vals, setVals]       = useState<Record<string, string>>({ [KEYS.expiryDays]: "7", [KEYS.paymentDays]: "3" });
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);
  const [cronResult, setCronResult] = useState<string | null>(null);
  const [cronRunning, setCronRunning] = useState(false);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(d => { if (d.settings) setVals(v => ({ ...v, ...d.settings })); })
      .finally(() => setLoading(false));
  }, []);

  function set(key: string, val: string) {
    setVals(v => ({ ...v, [key]: val }));
    setSaved(false);
  }

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { [KEYS.expiryDays]: vals[KEYS.expiryDays], [KEYS.paymentDays]: vals[KEYS.paymentDays] } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  async function runCronNow() {
    setCronRunning(true); setCronResult(null);
    try {
      const res  = await fetch("/api/cron/daily");
      const data = await res.json();
      setCronResult(
        `✓ Complete — ${data.expiryWarnings} expiry warnings, ${data.overdueInvoices} overdue alerts, ${data.scheduledBroadcasts} broadcasts sent.` +
        (data.errors?.length ? ` Errors: ${data.errors.join(", ")}` : "")
      );
    } catch (e: any) {
      setCronResult(`✗ Failed: ${e.message}`);
    }
    setCronRunning(false);
  }

  if (loading) return <div style={{ padding: 40, fontSize: 13, color: CLR.faint }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 680 }}>

      {/* Thresholds */}
      <div style={card}>
        <p style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 14 }}>⏰ Alert Thresholds</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={lbl}>Days before expiry to warn</label>
            <input type="number" min={0} max={90} style={inp}
              value={vals[KEYS.expiryDays] ?? "7"}
              onChange={e => set(KEYS.expiryDays, e.target.value)} />
            <p style={{ fontSize: 11, color: CLR.faint, marginTop: 4 }}>
              Customers notified when subscription expires within this many days. Default: 7
            </p>
          </div>
          <div>
            <label style={lbl}>Grace days before overdue alert</label>
            <input type="number" min={0} max={30} style={inp}
              value={vals[KEYS.paymentDays] ?? "3"}
              onChange={e => set(KEYS.paymentDays, e.target.value)} />
            <p style={{ fontSize: 11, color: CLR.faint, marginTop: 4 }}>
              Days after due date before invoice is flagged overdue and customer is alerted. Default: 3
            </p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <button onClick={save} disabled={saving}
            style={{ padding: "9px 22px", fontSize: 13, fontWeight: 600, background: saving ? "#9ca3af" : CLR.primary, color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {saving ? "Saving…" : "Save Thresholds"}
          </button>
          {saved && <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>✓ Saved</span>}
          {error && <span style={{ fontSize: 12, color: "#dc2626" }}>{error}</span>}
        </div>
      </div>

      {/* Cron job */}
      <div style={card}>
        <p style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 14 }}>🔄 Cron Job</p>
        <p style={{ fontSize: 13, color: CLR.muted, marginBottom: 14, lineHeight: 1.6 }}>
          The daily cron job checks subscriptions and invoices then fires automatic notifications.
          It runs automatically via Vercel cron at midnight, or you can trigger it manually below.
        </p>

        {/* Vercel config */}
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: "12px 14px", marginBottom: 14, fontFamily: "monospace", fontSize: 12, color: CLR.muted }}>
          <p style={{ fontWeight: 700, marginBottom: 6, fontFamily: "inherit", color: CLR.text }}>vercel.json cron config:</p>
          <pre style={{ margin: 0, fontSize: 11 }}>{`{
  "crons": [
    { "path": "/api/cron/daily", "schedule": "0 0 * * *" }
  ]
}`}</pre>
        </div>

        {/* Env var reminder */}
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", padding: "10px 12px", marginBottom: 14, fontSize: 12, color: "#92400e" }}>
          <strong>Required env var:</strong> <code>CRON_SECRET=your-random-secret</code>
          <p style={{ margin: "4px 0 0" }}>Vercel automatically passes this as the Authorization header when triggering crons.</p>
        </div>

        <button onClick={runCronNow} disabled={cronRunning}
          style={{ padding: "8px 18px", fontSize: 12, fontWeight: 600, background: cronRunning ? "#9ca3af" : "#374151", color: "#fff", border: "none", cursor: cronRunning ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {cronRunning ? "Running…" : "▶ Run Cron Now (manual trigger)"}
        </button>
        {cronResult && (
          <p style={{ fontSize: 12, marginTop: 10, fontWeight: 600, color: cronResult.startsWith("✓") ? "#15803d" : "#dc2626" }}>
            {cronResult}
          </p>
        )}
      </div>

      {/* SMS config reminder */}
      <div style={{ ...card, background: "#f5f3ff", border: "1px solid #ddd6fe" }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 10 }}>📱 SMS via AWS SNS</p>
        <p style={{ fontSize: 13, color: CLR.muted, lineHeight: 1.6, marginBottom: 10 }}>
          SMS is currently in stub mode — notifications are logged but not sent until AWS SNS credentials are configured.
        </p>
        <div style={{ background: "#fff", border: "1px solid #ddd6fe", padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#7c3aed" }}>
          <div>AWS_SNS_ACCESS_KEY_ID=<span style={{ color: CLR.faint }}>your-key</span></div>
          <div>AWS_SNS_SECRET_ACCESS_KEY=<span style={{ color: CLR.faint }}>your-secret</span></div>
          <div>AWS_SNS_REGION=<span style={{ color: CLR.faint }}>me-south-1</span></div>
        </div>
        <p style={{ fontSize: 11, color: CLR.faint, marginTop: 8 }}>
          Also install: <code>npm install @aws-sdk/client-sns</code>
        </p>
      </div>

      {/* DND info */}
      <div style={card}>
        <p style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 10 }}>🌙 Do Not Disturb (SMS)</p>
        <p style={{ fontSize: 13, color: CLR.muted, lineHeight: 1.6 }}>
          Customers can set their own DND hours in their Profile → Notifications preferences.
          SMS will not be sent during their DND window — in-app and email are unaffected.
        </p>
        <p style={{ fontSize: 12, color: CLR.faint, marginTop: 8 }}>
          Saudi CITC regulation: promotional SMS must not be sent between 9pm–8am.
          Critical transactional SMS (overdue invoices, suspensions) bypass DND.
        </p>
      </div>
    </div>
  );
}
