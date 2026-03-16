// app/admin/system/settings/tabs/NotificationsTab.tsx
"use client";
import React, { useEffect, useState } from "react";
import { inp, card, sectionTitle, Field, Row, SaveBar, TabHeader } from "./settings-ui";
import { CLR } from "@/components/ui/admin-ui";

const KEYS = {
  expiryDays:  "notif.expiryDays",
  paymentDays: "notif.paymentDays",
};

export default function NotificationsTab() {
  const [vals, setVals]       = useState<Record<string, string>>({ [KEYS.expiryDays]: "7", [KEYS.paymentDays]: "3" });
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);

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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { [KEYS.expiryDays]: vals[KEYS.expiryDays], [KEYS.paymentDays]: vals[KEYS.paymentDays] } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  if (loading) return <div style={{ padding: 40, fontSize: 13, color: "#9ca3af" }}>Loading…</div>;

  return (
    <div>
      <TabHeader
        title="Notification Settings"
        description="Configure thresholds for automated alerts sent to customers and admins."
      />

      <div style={card}>
        <p style={sectionTitle}>⏰ Subscription Expiry Alerts</p>
        <p style={{ fontSize: 13, color: CLR.muted, marginBottom: 14 }}>
          Customers will receive an email notification when their subscription is this many days away from expiry.
          Admin will also see expiring subscriptions flagged in the dashboard.
        </p>
        <Row>
          <Field label="Days before expiry to notify" half hint="Default: 7 days. Set to 0 to disable.">
            <input style={inp} type="number" min={0} max={90}
              value={vals[KEYS.expiryDays] ?? "7"}
              onChange={e => set(KEYS.expiryDays, e.target.value)} />
          </Field>
        </Row>
      </div>

      <div style={card}>
        <p style={sectionTitle}>💸 Overdue Payment Alerts</p>
        <p style={{ fontSize: 13, color: CLR.muted, marginBottom: 14 }}>
          Invoices that remain unpaid this many days after their due date will be flagged as overdue
          and trigger an alert notification to the customer and admin.
        </p>
        <Row>
          <Field label="Days after due date to flag as overdue" half hint="Default: 3 days. Set to 0 to flag immediately on due date.">
            <input style={inp} type="number" min={0} max={90}
              value={vals[KEYS.paymentDays] ?? "3"}
              onChange={e => set(KEYS.paymentDays, e.target.value)} />
          </Field>
        </Row>
      </div>

      <div style={{ ...card, background: "#f0fdf4", border: "1px solid #86efac" }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#15803d", marginBottom: 6 }}>📬 Notification Types</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12, color: CLR.muted }}>
          {[
            ["Invoice issued",      "Sent to customer when a new invoice is created"],
            ["Subscription expiring", "Sent X days before subscription ends"],
            ["Quote received",      "Sent to customer when admin creates a quotation"],
            ["Payment overdue",     "Sent when invoice passes due date + grace period"],
            ["Subscription activated", "Sent when admin approves a new subscription"],
            ["Server alert",        "Sent when server status changes (future)"],
          ].map(([title, desc]) => (
            <div key={title} style={{ padding: "8px 10px", background: "#fff", border: "1px solid #dcfce7" }}>
              <p style={{ fontWeight: 600, fontSize: 12, color: CLR.text, marginBottom: 2 }}>{title}</p>
              <p style={{ fontSize: 11, color: CLR.faint }}>{desc}</p>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: "#15803d", marginTop: 10 }}>
          Email notifications require SMTP to be configured in the Email / SMTP tab.
        </p>
      </div>

      <SaveBar saving={saving} saved={saved} error={error} onSave={save} />
    </div>
  );
}
