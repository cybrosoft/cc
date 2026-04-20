"use client";
// app/admin/system/settings/tabs/EmailSettingsTab.tsx

import React, { useEffect, useState } from "react";
import { inp, card, sectionTitle, Field, Row, SaveBar, TabHeader } from "./settings-ui";
import { CLR } from "@/components/ui/admin-ui";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Market { id: string; key: string; name: string; }

const EMAIL_TYPES = [
  { key: "auth",          label: "Authentication", usedFor: "OTP codes, 2FA setup, login verification",                                         color: "#6b7280" },
  { key: "support",       label: "Support",        usedFor: "Account approval, rejection, suspension, info required, reactivation, onboarding",  color: "#1e40af" },
  { key: "sales",         label: "Sales",          usedFor: "Quotations, RFQ responses, delivery notes, purchase orders",                        color: "#92400e" },
  { key: "billing",       label: "Billing",        usedFor: "Invoices, payment confirmations, reminders, subscription expiring, renewal, cancellation", color: "#166534" },
  { key: "notifications", label: "Notifications",  usedFor: "General system alerts, read-only notifications",                                   color: "#6b7280" },
] as const;
type EmailTypeKey = typeof EMAIL_TYPES[number]["key"];

// ── Setting key helpers ───────────────────────────────────────────────────────
const fromNameKey  = (mKey: string, type: string) => `email.fromName.${mKey.toLowerCase()}.${type}`;
const fromAddrKey  = (type: string)                => `email.${type}`;
const replyToKey   = (type: string)                => `email.${type}.replyTo`;
const bccKey       = (type: string)                => `email.${type}.bcc`;

export default function EmailSettingsTab() {
  const [markets,  setMarkets]  = useState<Market[]>([]);
  const [vals,     setVals]     = useState<Record<string, string>>({});
  const [saving,   setSaving]   = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [testing,  setTesting]  = useState<string | null>(null);
  const [testTo,   setTestTo]   = useState("");
  const [testMsg,  setTestMsg]  = useState<Record<string, { ok: boolean; msg: string }>>({});

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/settings/markets").then(r => r.json()),
      fetch("/api/admin/settings").then(r => r.json()),
    ]).then(([mData, sData]) => {
      if (mData.ok)       setMarkets(mData.markets ?? []);
      if (sData.settings) setVals(sData.settings);
    }).finally(() => setLoading(false));
  }, []);

  function set(key: string, val: string) {
    setVals(v => ({ ...v, [key]: val }));
    setSaved(false);
  }

  const v = (key: string) => vals[key] ?? "";

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try {
      // Collect all email.* keys
      const settings: Record<string, string> = {};

      // Per-type address, reply-to, bcc
      for (const et of EMAIL_TYPES) {
        settings[fromAddrKey(et.key)] = v(fromAddrKey(et.key));
        settings[replyToKey(et.key)]  = v(replyToKey(et.key));
        settings[bccKey(et.key)]      = v(bccKey(et.key));
      }

      // Per-market per-type from name
      for (const m of markets) {
        for (const et of EMAIL_TYPES) {
          const k = fromNameKey(m.key, et.key);
          settings[k] = v(k);
        }
      }

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  async function sendTest(emailType: string) {
    if (!testTo.trim()) {
      setTestMsg(p => ({ ...p, [emailType]: { ok: false, msg: "Enter a recipient email address first." } }));
      return;
    }
    setTesting(emailType);
    setTestMsg(p => ({ ...p, [emailType]: { ok: false, msg: "" } }));
    try {
      const res = await fetch("/api/admin/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo.trim(), emailType }),
      });
      const d = await res.json();
      setTestMsg(p => ({
        ...p,
        [emailType]: d.ok
          ? { ok: true,  msg: `Test sent to ${testTo}` }
          : { ok: false, msg: d.error ?? "Failed to send." },
      }));
    } catch {
      setTestMsg(p => ({ ...p, [emailType]: { ok: false, msg: "Network error." } }));
    }
    setTesting(null);
  }

  if (loading) return <div style={{ padding: 40, fontSize: 13, color: "#9ca3af" }}>Loading…</div>;

  return (
    <div>
      <TabHeader
        title="Email Settings"
        description="Configure from addresses, reply-to, BCC, and sender names per email type. Sender name can be set per market."
      />

      {/* ── Test recipient ───────────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>Test Email Recipient</p>
        <Row>
          <Field label="Send test emails to" half hint="Used by the Send Test buttons below.">
            <input style={inp} type="email" value={testTo}
              onChange={e => setTestTo(e.target.value)}
              placeholder="you@yourdomain.com" />
          </Field>
        </Row>
      </div>

      {/* ── Per email type ───────────────────────────────────────────────────── */}
      {EMAIL_TYPES.map(et => {
        const msg = testMsg[et.key];
        return (
          <div key={et.key} style={card}>

            {/* Header row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: et.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#111827" }}>{et.label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#6b7280" }}>{et.usedFor}</p>
              </div>
              <button
                onClick={() => sendTest(et.key)}
                disabled={testing === et.key}
                style={{
                  flexShrink: 0, padding: "5px 14px", fontSize: 12, fontWeight: 500,
                  background: "#fff", border: `1px solid ${et.color}55`,
                  color: et.color, cursor: testing === et.key ? "not-allowed" : "pointer",
                  fontFamily: "inherit", opacity: testing === et.key ? 0.6 : 1,
                }}>
                {testing === et.key ? "Sending…" : "Send Test"}
              </button>
            </div>

            {/* Test result */}
            {msg?.msg && (
              <div style={{
                padding: "7px 12px", marginBottom: 14, fontSize: 12,
                background: msg.ok ? "#e8f5f0" : "#fdf0ef",
                border: `1px solid ${msg.ok ? "#a7d9d1" : "#fca5a5"}`,
                color: msg.ok ? "#166534" : "#991b1b",
              }}>{msg.msg}</div>
            )}

            {/* From address, Reply-To, BCC */}
            <Row>
              <Field label="From Address" half hint="Must be on your verified Resend domain.">
                <input style={inp} type="email"
                  value={v(fromAddrKey(et.key))}
                  onChange={e => set(fromAddrKey(et.key), e.target.value)}
                  placeholder={`${et.key === "notifications" ? "noreply" : et.key}@yourdomain.com`} />
              </Field>
              <Field label="Reply-To" half hint={
                et.key === "auth" || et.key === "notifications"
                  ? "Leave blank — customers should not reply."
                  : `e.g. ${et.key}@yourdomain.com`
              }>
                <input style={inp} type="email"
                  value={v(replyToKey(et.key))}
                  onChange={e => set(replyToKey(et.key), e.target.value)}
                  placeholder={et.key === "auth" || et.key === "notifications" ? "Leave blank" : `${et.key}@yourdomain.com`} />
              </Field>
            </Row>
            <Field label="BCC (optional)" hint={
              et.key === "support" || et.key === "billing"
                ? "Recommended — BCC your internal mailbox to track these emails."
                : "Optional."
            }>
              <input style={inp} type="email"
                value={v(bccKey(et.key))}
                onChange={e => set(bccKey(et.key), e.target.value)}
                placeholder="internal@yourdomain.com" />
            </Field>

            {/* Per-market sender names */}
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #f3f4f6" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, textTransform: "uppercase" as const, letterSpacing: "0.05em", margin: "0 0 12px" }}>
                Sender Name per Market
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" as const }}>
                {markets.map(m => {
                  const k = fromNameKey(m.key, et.key);
                  return (
                    <div key={m.id} style={{ flex: 1, minWidth: 200 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: CLR.muted, display: "block", marginBottom: 4 }}>
                        {m.name}
                      </label>
                      <input style={inp}
                        value={v(k)}
                        onChange={e => set(k, e.target.value)}
                        placeholder={`e.g. Cybrosoft ${et.label} ${m.key.toUpperCase()}`} />
                      {v(k) && (
                        <p style={{ fontSize: 11, color: CLR.faint, marginTop: 3 }}>
                          Preview: <span style={{ fontFamily: "monospace", color: et.color }}>{v(k)} &lt;{v(fromAddrKey(et.key)) || `${et.key}@yourdomain.com`}&gt;</span>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        );
      })}

      <SaveBar saving={saving} saved={saved} error={error} onSave={save} />
    </div>
  );
}
