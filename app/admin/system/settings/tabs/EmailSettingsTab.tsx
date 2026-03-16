// app/admin/system/settings/tabs/EmailSettingsTab.tsx
"use client";
import React, { useEffect, useState } from "react";
import { inp, card, sectionTitle, Field, Row, SaveBar, TabHeader } from "./settings-ui";
import { CLR } from "@/components/ui/admin-ui";

// Email settings stored in PortalSetting
const KEYS = {
  fromName:     "email.fromName",       // Display name for outgoing emails
  replyTo:      "email.replyTo",        // Reply-to address (optional)
  invoiceCC:    "email.invoiceCC",      // BCC on all invoice emails
};

export default function EmailSettingsTab() {
  const [vals, setVals]           = useState<Record<string, string>>({});
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState("");
  const [testing, setTesting]     = useState(false);
  const [testMsg, setTestMsg]     = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(d => { if (d.settings) setVals(d.settings); })
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch("/api/admin/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmail }),
      });
      const data = await res.json();
      setTestMsg(data.ok ? "✓ Test email sent successfully!" : `✗ ${data.error}`);
    } catch { setTestMsg("✗ Request failed."); }
    setTesting(false);
  }

  const v = (k: string) => vals[k] ?? "";

  if (loading) return <div style={{ padding: 40, fontSize: 13, color: "#9ca3af" }}>Loading…</div>;

  return (
    <div>
      <TabHeader
        title="Email Settings"
        description="Configure outgoing email behaviour. This project uses Resend for all transactional emails."
      />

      {/* Resend status card */}
      <div style={{ ...card, background: CLR.primaryBg, border: `1px solid ${CLR.primary}44`, marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: CLR.primary, marginBottom: 6 }}>
          📬 Email Provider: Resend
        </p>
        <p style={{ fontSize: 12, color: CLR.muted, lineHeight: 1.6 }}>
          All emails (OTP codes, invoices, notifications) are sent via{" "}
          <strong>Resend API</strong>. The API key and sender address are configured
          as environment variables on your server — not stored in the database.
        </p>
        <div style={{
          marginTop: 12, padding: "10px 14px",
          background: "#fff", border: "1px solid #e5e7eb",
          fontSize: 12, fontFamily: "monospace", color: CLR.muted,
        }}>
          <div><span style={{ color: CLR.primary }}>RESEND_API_KEY</span>=re_xxxxxxxxxxxxxxxxxxxx</div>
          <div><span style={{ color: CLR.primary }}>EMAIL_FROM</span>=noreply@yourdomain.com</div>
        </div>
        <p style={{ fontSize: 11, color: CLR.faint, marginTop: 8 }}>
          Set these in your <code>.env.local</code> or hosting environment (e.g. Vercel → Project Settings → Environment Variables).
        </p>
      </div>

      {/* Configurable email settings */}
      <div style={card}>
        <p style={sectionTitle}>✉️ Email Display Settings</p>
        <p style={{ fontSize: 12, color: CLR.muted, marginBottom: 14 }}>
          These settings control how outgoing emails appear to recipients. The actual sending
          address comes from the <code>EMAIL_FROM</code> environment variable.
        </p>
        <Field label="From Name" hint="Displayed as the sender name in the recipient's inbox. e.g. 'Cybrosoft Cloud Console'">
          <input style={inp} value={v(KEYS.fromName)}
            onChange={e => set(KEYS.fromName, e.target.value)}
            placeholder="Cybrosoft Cloud Console" />
        </Field>
        <Row>
          <Field label="Reply-To Address (optional)" half hint="If set, replies will go to this address instead of the FROM address.">
            <input style={inp} type="email" value={v(KEYS.replyTo)}
              onChange={e => set(KEYS.replyTo, e.target.value)}
              placeholder="accounts@yourcompany.com" />
          </Field>
          <Field label="Invoice BCC (optional)" half hint="A copy of every invoice email will be sent to this address.">
            <input style={inp} type="email" value={v(KEYS.invoiceCC)}
              onChange={e => set(KEYS.invoiceCC, e.target.value)}
              placeholder="accounts@yourcompany.com" />
          </Field>
        </Row>
      </div>

      {/* Email types reference */}
      <div style={card}>
        <p style={sectionTitle}>📋 Automated Email Types</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {[
            ["OTP Login Code",          "Sent on login — uses existing send-otp.ts"],
            ["Invoice Issued",          "Sent to customer when invoice is created"],
            ["Quotation Sent",          "Sent when admin marks quotation as Sent"],
            ["Subscription Approved",   "Sent when admin activates a subscription"],
            ["Subscription Expiring",   "Sent X days before expiry (configurable in Notifications tab)"],
            ["Payment Overdue",         "Sent when invoice passes due date grace period"],
          ].map(([title, desc]) => (
            <div key={title} style={{ padding: "9px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 12 }}>
              <p style={{ fontWeight: 600, color: CLR.text, marginBottom: 2 }}>{title}</p>
              <p style={{ color: CLR.faint }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Test */}
      <div style={card}>
        <p style={sectionTitle}>🧪 Send Test Email</p>
        <p style={{ fontSize: 12, color: CLR.muted, marginBottom: 12 }}>
          Sends a test email via Resend to verify your <code>RESEND_API_KEY</code> and <code>EMAIL_FROM</code> are configured correctly.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em", marginBottom: 4, display: "block", textTransform: "uppercase" as const }}>
              Test Recipient Address
            </label>
            <input style={inp} type="email" value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="your@email.com" />
          </div>
          <button
            onClick={sendTest}
            disabled={testing || !testEmail}
            style={{
              padding: "9px 20px", fontSize: 13, fontWeight: 600,
              background: testing || !testEmail ? "#9ca3af" : "#374151",
              color: "#fff", border: "none",
              cursor: testing || !testEmail ? "not-allowed" : "pointer",
              fontFamily: "inherit", whiteSpace: "nowrap" as const,
            }}>
            {testing ? "Sending…" : "Send Test"}
          </button>
        </div>
        {testMsg && (
          <p style={{ fontSize: 12, marginTop: 8, fontWeight: 600, color: testMsg.startsWith("✓") ? "#15803d" : "#dc2626" }}>
            {testMsg}
          </p>
        )}
      </div>

      <SaveBar saving={saving} saved={saved} error={error} onSave={save} />
    </div>
  );
}
