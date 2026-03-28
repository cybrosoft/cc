// app/dashboard/notifications/settings/page.tsx
// Notification preferences — marketing opt-out, DND hours, timezone.
// Reached via "Notification Settings" button on the Notifications page.
// Not in nav — accessible only through that button.
"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";

const P = "#318774";
const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", fontSize: 13,
  border: "1px solid #d1d5db", fontFamily: "inherit",
  outline: "none", boxSizing: "border-box" as const,
};
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: "#6b7280",
  letterSpacing: "0.04em", marginBottom: 4,
  display: "block", textTransform: "uppercase" as const,
};
const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e7eb",
  padding: "20px 22px", marginBottom: 14,
};
const secTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: "#111827",
  marginBottom: 14, paddingBottom: 10,
  borderBottom: "1px solid #f3f4f6",
};

const CHANNELS = [
  { id: "inapp", label: "In-App", hint: "Bell notifications inside the portal" },
  { id: "email", label: "Email",  hint: "Sent to your registered email address" },
  { id: "sms",   label: "SMS",    hint: "Sent to your registered mobile number" },
];

const TIMEZONES = [
  "Asia/Riyadh", "Asia/Dubai", "Africa/Cairo", "Europe/London",
  "Europe/Paris", "America/New_York", "America/Los_Angeles",
  "Asia/Karachi", "Asia/Kolkata", "Australia/Sydney",
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, "0")}:00 (${i === 0 ? "midnight" : i < 12 ? `${i}am` : i === 12 ? "noon" : `${i - 12}pm`})`,
}));

interface Prefs {
  marketingPrefs: Record<string, boolean>;
  timezone:       string | null;
  dndStart:       number | null;
  dndEnd:         number | null;
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs]     = useState<Prefs>({
    marketingPrefs: { "marketing.inapp": true, "marketing.email": true, "marketing.sms": true },
    timezone: "Asia/Riyadh", dndStart: null, dndEnd: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    fetch("/api/customer/profile/settings")
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setPrefs({
            marketingPrefs: d.marketingPrefs ?? { "marketing.inapp": true, "marketing.email": true, "marketing.sms": true },
            timezone:       d.timezone  ?? "Asia/Riyadh",
            dndStart:       d.dndStart  ?? null,
            dndEnd:         d.dndEnd    ?? null,
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function toggleMarketing(channel: string) {
    setPrefs(p => ({
      ...p,
      marketingPrefs: {
        ...p.marketingPrefs,
        [`marketing.${channel}`]: !p.marketingPrefs[`marketing.${channel}`],
      },
    }));
    setSaved(false);
  }

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch("/api/customer/profile/settings", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefs:    prefs.marketingPrefs,
          timezone: prefs.timezone,
          dndStart: prefs.dndStart,
          dndEnd:   prefs.dndEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  }

  if (loading) return (
    <div style={{ padding: 48, textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
      Loading preferences…
    </div>
  );

  return (
    <div style={{
      maxWidth: 600, margin: "0 auto", padding: "32px 20px",
      fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>

      {/* Back link */}
      <Link href="/dashboard/notifications"
        style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, color: "#6b7280", textDecoration: "none", marginBottom: 20 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back to Notifications
      </Link>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
          Notification Settings
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280" }}>
          Control which notifications you receive and how they are delivered.
          Essential notifications (invoices, subscription alerts, security) cannot be disabled.
        </p>
      </div>

      {/* Essential notifications info */}
      <div style={{ ...card, background: "#f0fdf4", border: "1px solid #86efac", marginBottom: 14 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#15803d", marginBottom: 6 }}>
          Essential Notifications — Always On
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {[
            "Invoice issued", "Payment overdue",
            "Subscription expiring", "Subscription suspended",
            "Subscription activated", "Quotation received",
          ].map(item => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#374151" }}>
              <span style={{ color: "#15803d", fontWeight: 700 }}>✓</span> {item}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#15803d", marginTop: 10 }}>
          These cannot be disabled as they relate to your account and billing.
        </p>
      </div>

      {/* Marketing opt-out */}
      <div style={card}>
        <p style={secTitle}>Marketing Notifications</p>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, lineHeight: 1.6 }}>
          Choose how you want to receive promotional messages, new feature announcements,
          and service updates from us.
        </p>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
          {CHANNELS.map(ch => {
            const isOn = prefs.marketingPrefs[`marketing.${ch.id}`] !== false;
            return (
              <label key={ch.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", cursor: "pointer",
                border: `1px solid ${isOn ? P : "#e5e7eb"}`,
                background: isOn ? "#f0fdf9" : "#f9fafb",
              }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0, color: "#111827" }}>{ch.label}</p>
                  <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>{ch.hint}</p>
                </div>
                {/* Toggle switch */}
                <div
                  onClick={() => toggleMarketing(ch.id)}
                  style={{
                    width: 44, height: 24, position: "relative" as const, flexShrink: 0,
                    background: isOn ? P : "#d1d5db",
                    transition: "background 0.2s", cursor: "pointer",
                  }}>
                  <div style={{
                    position: "absolute" as const, top: 3,
                    left: isOn ? 23 : 3,
                    width: 18, height: 18,
                    background: "#fff",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                  }} />
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* DND for SMS */}
      <div style={card}>
        <p style={secTitle}>SMS Do Not Disturb</p>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, lineHeight: 1.6 }}>
          Set hours during which you do not want to receive SMS messages.
          In-app and email notifications are not affected.
        </p>
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Your Timezone</label>
          <select
            value={prefs.timezone ?? "Asia/Riyadh"}
            onChange={e => setPrefs(p => ({ ...p, timezone: e.target.value }))}
            style={inp}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <label style={lbl}>DND Start</label>
            <select
              value={prefs.dndStart ?? ""}
              onChange={e => setPrefs(p => ({ ...p, dndStart: e.target.value === "" ? null : Number(e.target.value) }))}
              style={inp}>
              <option value="">No DND</option>
              {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>DND End</label>
            <select
              value={prefs.dndEnd ?? ""}
              onChange={e => setPrefs(p => ({ ...p, dndEnd: e.target.value === "" ? null : Number(e.target.value) }))}
              style={inp}
              disabled={prefs.dndStart === null}>
              <option value="">No DND</option>
              {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
        </div>
        {prefs.dndStart !== null && prefs.dndEnd !== null && (
          <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
            SMS blocked between {HOURS[prefs.dndStart].label.split(" ")[0]} and {HOURS[prefs.dndEnd].label.split(" ")[0]} ({prefs.timezone ?? "Asia/Riyadh"}).
          </p>
        )}
      </div>

      {/* Unsubscribe info */}
      <div style={{ ...card, background: "#f9fafb" }}>
        <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
          To unsubscribe from all marketing communications, turn off all channels above.
          You can re-enable them at any time. For account-related emails, please contact{" "}
          <a href="mailto:support@cybrosoft.com" style={{ color: P }}>support@cybrosoft.com</a>.
        </p>
      </div>

      {/* Save */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
        <button onClick={save} disabled={saving}
          style={{
            padding: "10px 24px", fontSize: 13, fontWeight: 600,
            background: saving ? "#9ca3af" : P,
            color: "#fff", border: "none",
            cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "inherit",
          }}>
          {saving ? "Saving…" : "Save Preferences"}
        </button>
        {saved && <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>Preferences saved</span>}
        {error && <span style={{ fontSize: 12, color: "#dc2626" }}>{error}</span>}
      </div>
    </div>
  );
}
