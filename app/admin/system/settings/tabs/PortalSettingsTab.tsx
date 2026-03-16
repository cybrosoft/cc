// app/admin/system/settings/tabs/PortalSettingsTab.tsx
"use client";
import React, { useEffect, useState } from "react";
import { inp, card, sectionTitle, Field, Row, SaveBar, TabHeader } from "./settings-ui";

const KEYS = {
  name:         "portal.name",
  logoUrl:      "portal.logoUrl",
  faviconUrl:   "portal.faviconUrl",
  supportEmail: "portal.supportEmail",
  supportPhone: "portal.supportPhone",
  website:      "portal.website",
};

export default function PortalSettingsTab() {
  const [vals, setVals]       = useState<Record<string, string>>({});
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then(r => r.json())
      .then(d => {
        if (d.settings) setVals(d.settings);
      })
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
        body: JSON.stringify({ settings: Object.fromEntries(Object.values(KEYS).map(k => [k, vals[k] ?? ""])) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  const v = (k: string) => vals[k] ?? "";

  if (loading) return <div style={{ padding: 40, fontSize: 13, color: "#9ca3af" }}>Loading…</div>;

  return (
    <div>
      <TabHeader title="Portal Settings" description="Branding and contact information shown throughout the admin and customer portal." />

      <div style={card}>
        <p style={sectionTitle}>Portal Identity</p>
        <Field label="Portal Name" hint="Shown in browser tab, emails, and document footers.">
          <input style={inp} value={v(KEYS.name)} onChange={e => set(KEYS.name, e.target.value)} placeholder="Cybrosoft Cloud Console" />
        </Field>
        <Row>
          <Field label="Logo URL" half hint="Displayed in admin nav header. Recommended: 180×40px PNG.">
            <input style={inp} value={v(KEYS.logoUrl)} onChange={e => set(KEYS.logoUrl, e.target.value)} placeholder="https://cdn.yourcompany.com/logo.png" />
          </Field>
          <Field label="Favicon URL" half hint="16×16 or 32×32 .ico or .png">
            <input style={inp} value={v(KEYS.faviconUrl)} onChange={e => set(KEYS.faviconUrl, e.target.value)} placeholder="https://cdn.yourcompany.com/favicon.ico" />
          </Field>
        </Row>
        {v(KEYS.logoUrl) && (
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6 }}>LOGO PREVIEW</p>
            <div style={{ padding: "12px 16px", background: "#222222", display: "inline-block" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v(KEYS.logoUrl)} alt="Portal logo preview" style={{ maxHeight: 40, maxWidth: 200 }} />
            </div>
          </div>
        )}
      </div>

      <div style={card}>
        <p style={sectionTitle}>Support Contact</p>
        <Row>
          <Field label="Support Email" half hint="Shown to customers for help requests.">
            <input style={inp} type="email" value={v(KEYS.supportEmail)} onChange={e => set(KEYS.supportEmail, e.target.value)} placeholder="support@yourcompany.com" />
          </Field>
          <Field label="Support Phone" half>
            <input style={inp} value={v(KEYS.supportPhone)} onChange={e => set(KEYS.supportPhone, e.target.value)} placeholder="+966 11 000 0000" />
          </Field>
        </Row>
        <Field label="Company Website">
          <input style={inp} value={v(KEYS.website)} onChange={e => set(KEYS.website, e.target.value)} placeholder="https://www.yourcompany.com" />
        </Field>
      </div>

      <SaveBar saving={saving} saved={saved} error={error} onSave={save} />
    </div>
  );
}
