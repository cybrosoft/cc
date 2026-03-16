// app/admin/system/notifications/tabs/SettingsTab.tsx
// Combined: notification thresholds + email delivery settings + cron config
"use client";
import React, { useEffect, useState } from "react";
import { CLR } from "@/components/ui/admin-ui";

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", fontSize: 13,
  border: "1px solid #d1d5db", fontFamily: "inherit",
  outline: "none", boxSizing: "border-box" as const,
};
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: CLR.muted,
  letterSpacing: "0.04em", marginBottom: 4,
  display: "block", textTransform: "uppercase" as const,
};
const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e7eb",
  padding: "18px 20px", marginBottom: 14,
};
const secTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: CLR.text,
  marginBottom: 16, paddingBottom: 10,
  borderBottom: "1px solid #f3f4f6",
};

function Field({ label: l, hint, children, half }: {
  label: string; hint?: string; children: React.ReactNode; half?: boolean;
}) {
  return (
    <div style={{ marginBottom: 14, width: half ? "calc(50% - 8px)" : "100%" }}>
      <label style={lbl}>{l}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: CLR.faint, marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 16, flexWrap: "wrap" as const }}>{children}</div>;
}

const KEYS = {
  expiryDays:  "notif.expiryDays",
  paymentDays: "notif.paymentDays",
  fromName:    "email.fromName",
  replyTo:     "email.replyTo",
  invoiceCC:   "email.invoiceCC",
};

export default function SettingsTab() {
  const [vals, setVals]               = useState<Record<string, string>>({
    [KEYS.expiryDays]: "7", [KEYS.paymentDays]: "3",
  });
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(true);
  const [testEmail, setTestEmail]     = useState("");
  const [testing, setTesting]         = useState(false);
  const [testMsg, setTestMsg]         = useState("");
  const [cronRunning, setCronRunning] = useState(false);
  const [cronResult, setCronResult]   = useState<string | null>(null);

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
        body: JSON.stringify({
          settings: Object.fromEntries(Object.values(KEYS).map(k => [k, vals[k] ?? ""])),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  async function sendTest() {
    if (!testEmail) { setTestMsg("Enter a test email address first."); return; }
    setTesting(true); setTestMsg("");
    try {
      const res  = await fetch("/api/admin/settings/test-email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json();
      setTestMsg(data.ok ? "Test email sent successfully." : `Failed: ${data.error}`);
    } catch { setTestMsg("Request failed."); }
    setTesting(false);
  }

  async function runCronNow() {
    setCronRunning(true); setCronResult(null);
    try {
      const res  = await fetch("/api/cron/daily");
      const data = await res.json();
      setCronResult(
        `Complete — ${data.expiryWarnings} expiry warnings, ${data.overdueInvoices} overdue alerts, ${data.scheduledBroadcasts} broadcasts.` +
        (data.errors?.length ? ` Errors: ${data.errors.join(", ")}` : "")
      );
    } catch (e: any) { setCronResult(`Failed: ${e.message}`); }
    setCronRunning(false);
  }

  const v = (k: string) => vals[k] ?? "";

  if (loading) return <div style={{ padding: 40, fontSize: 13, color: CLR.faint }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 680 }}>

      {/* Alert Thresholds */}
      <div style={card}>
        <p style={secTitle}>Alert Thresholds</p>
        <Row>
          <Field label="Days before expiry to warn" half hint="Default: 7. Set to 0 to disable.">
            <input type="number" min={0} max={90} style={inp}
              value={v(KEYS.expiryDays)} onChange={e => set(KEYS.expiryDays, e.target.value)} />
          </Field>
          <Field label="Grace days before overdue" half hint="Default: 3. Days after due date before invoice flagged.">
            <input type="number" min={0} max={30} style={inp}
              value={v(KEYS.paymentDays)} onChange={e => set(KEYS.paymentDays, e.target.value)} />
          </Field>
        </Row>
      </div>

      {/* Email Delivery */}
      <div style={card}>
        <p style={secTitle}>Email Delivery</p>
        <div style={{ background: CLR.primaryBg, border: `1px solid ${CLR.primary}44`, padding: "10px 14px", marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: CLR.primary, marginBottom: 4 }}>
            Provider: Resend
          </p>
          <p style={{ fontSize: 12, color: CLR.muted, lineHeight: 1.6, margin: 0 }}>
            All emails sent via Resend API. API key and sender address are environment variables — not stored in DB.
          </p>
          <div style={{ marginTop: 8, padding: "8px 10px", background: "#fff", border: "1px solid #e5e7eb", fontSize: 11, fontFamily: "monospace", color: CLR.muted }}>
            <div><span style={{ color: CLR.primary }}>RESEND_API_KEY</span>=re_xxxxxxxxxxxx</div>
            <div><span style={{ color: CLR.primary }}>EMAIL_FROM</span>=noreply@yourdomain.com</div>
          </div>
        </div>
        <Field label="From Name" hint="Displayed as sender name in recipient's inbox.">
          <input style={inp} value={v(KEYS.fromName)} onChange={e => set(KEYS.fromName, e.target.value)} placeholder="Cybrosoft Cloud Console" />
        </Field>
        <Row>
          <Field label="Reply-To Address" half hint="Optional. Replies go here instead of FROM.">
            <input style={inp} type="email" value={v(KEYS.replyTo)} onChange={e => set(KEYS.replyTo, e.target.value)} placeholder="accounts@yourcompany.com" />
          </Field>
          <Field label="Invoice BCC" half hint="Optional. All invoice emails BCC'd here.">
            <input style={inp} type="email" value={v(KEYS.invoiceCC)} onChange={e => set(KEYS.invoiceCC, e.target.value)} placeholder="accounts@yourcompany.com" />
          </Field>
        </Row>
        <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
          <label style={lbl}>Send Test Email</label>
          <div style={{ display: "flex", gap: 10 }}>
            <input style={{ ...inp, flex: 1 }} type="email" value={testEmail}
              onChange={e => setTestEmail(e.target.value)} placeholder="your@email.com" />
            <button onClick={sendTest} disabled={testing || !testEmail}
              style={{ padding: "9px 16px", fontSize: 12, fontWeight: 600, background: testing || !testEmail ? "#9ca3af" : "#374151", color: "#fff", border: "none", cursor: testing || !testEmail ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" as const }}>
              {testing ? "Sending…" : "Send Test"}
            </button>
          </div>
          {testMsg && (
            <p style={{ fontSize: 12, marginTop: 6, fontWeight: 600, color: testMsg.startsWith("Test") ? "#15803d" : "#dc2626" }}>
              {testMsg}
            </p>
          )}
        </div>
      </div>

      {/* SMS */}
      <div style={{ ...card, background: "#f5f3ff", border: "1px solid #ddd6fe" }}>
        <p style={secTitle}>SMS via AWS SNS</p>
        <p style={{ fontSize: 13, color: CLR.muted, lineHeight: 1.6, marginBottom: 10 }}>
          SMS is in stub mode — notifications are logged but not sent until credentials are set.
        </p>
        <div style={{ background: "#fff", border: "1px solid #ddd6fe", padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#7c3aed" }}>
          <div>AWS_SNS_ACCESS_KEY_ID=<span style={{ color: CLR.faint }}>your-key</span></div>
          <div>AWS_SNS_SECRET_ACCESS_KEY=<span style={{ color: CLR.faint }}>your-secret</span></div>
          <div>AWS_SNS_REGION=<span style={{ color: CLR.faint }}>me-south-1</span></div>
        </div>
        <p style={{ fontSize: 11, color: CLR.faint, marginTop: 8 }}>
          Also run: <code>npm install @aws-sdk/client-sns</code>
        </p>
      </div>

      {/* DND */}
      <div style={card}>
        <p style={secTitle}>Do Not Disturb (SMS)</p>
        <p style={{ fontSize: 13, color: CLR.muted, lineHeight: 1.6 }}>
          Customers can set DND hours in Profile → Notifications. SMS blocked during their window.
          In-app and email unaffected. Saudi CITC: promotional SMS blocked 9pm–8am.
          Critical transactional SMS (overdue, suspension) bypass DND.
        </p>
      </div>

      {/* Cron */}
      <div style={card}>
        <p style={secTitle}>Cron Job</p>
        <p style={{ fontSize: 13, color: CLR.muted, marginBottom: 12, lineHeight: 1.6 }}>
          Runs daily at midnight. Checks subscriptions and invoices then fires automatic notifications.
        </p>
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: "10px 14px", marginBottom: 12, fontFamily: "monospace", fontSize: 11, color: CLR.muted }}>
          <p style={{ fontWeight: 700, marginBottom: 4, fontFamily: "inherit", color: CLR.text, fontSize: 12 }}>vercel.json</p>
          <pre style={{ margin: 0 }}>{`{ "crons": [{ "path": "/api/cron/daily", "schedule": "0 0 * * *" }] }`}</pre>
        </div>
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "#92400e" }}>
          Required env var: <code>CRON_SECRET=your-random-secret</code>
        </div>
        <button onClick={runCronNow} disabled={cronRunning}
          style={{ padding: "8px 18px", fontSize: 12, fontWeight: 600, background: cronRunning ? "#9ca3af" : "#374151", color: "#fff", border: "none", cursor: cronRunning ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {cronRunning ? "Running…" : "Run Cron Now"}
        </button>
        {cronResult && (
          <p style={{ fontSize: 12, marginTop: 10, fontWeight: 600, color: cronResult.startsWith("Complete") ? "#15803d" : "#dc2626" }}>
            {cronResult}
          </p>
        )}
      </div>

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={save} disabled={saving}
          style={{ padding: "9px 22px", fontSize: 13, fontWeight: 600, background: saving ? "#9ca3af" : CLR.primary, color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {saving ? "Saving…" : "Save Settings"}
        </button>
        {saved && <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>Saved</span>}
        {error && <span style={{ fontSize: 12, color: "#dc2626" }}>{error}</span>}
      </div>
    </div>
  );
}