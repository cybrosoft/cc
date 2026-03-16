// app/admin/system/settings/tabs/TagBehavioursTab.tsx
"use client";
import React, { useEffect, useState } from "react";
import { CLR } from "@/components/ui/admin-ui";
import { card, sectionTitle, Field, SaveBar, TabHeader } from "./settings-ui";

interface Tag { id: string; key: string; name: string; }

const KEYS = {
  hidePrice:  "tag.hidePrice",
  exclude2fa: "tag.exclude2fa",
};

export default function TagBehavioursTab() {
  const [tags, setTags]         = useState<Tag[]>([]);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/catalog/tags").then(r => r.json()),
      fetch("/api/admin/settings").then(r => r.json()),
    ]).then(([tagsData, settingsData]) => {
      if (tagsData.ok)      setTags(tagsData.data ?? []);
      if (settingsData.settings) setSettings(settingsData.settings);
    }).finally(() => setLoading(false));
  }, []);

  function set(key: string, val: string) {
    setSettings(s => ({ ...s, [key]: val }));
    setSaved(false);
  }

  async function save() {
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            [KEYS.hidePrice]:  settings[KEYS.hidePrice]  ?? "",
            [KEYS.exclude2fa]: settings[KEYS.exclude2fa] ?? "",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSaved(true);
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  const TagSelect = ({ settingKey, current }: { settingKey: string; current: string }) => (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "6px 12px", border: `1px solid ${!current ? CLR.primary : "#d1d5db"}`, background: !current ? CLR.primaryBg : "#fff", fontSize: 13 }}>
          <input type="radio" name={settingKey} value="" checked={!current} onChange={() => set(settingKey, "")} style={{ accentColor: CLR.primary }} />
          None (disabled)
        </label>
        {tags.map(tag => (
          <label key={tag.id} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "6px 12px", border: `1px solid ${current === tag.key ? CLR.primary : "#d1d5db"}`, background: current === tag.key ? CLR.primaryBg : "#fff", fontSize: 13 }}>
            <input type="radio" name={settingKey} value={tag.key} checked={current === tag.key} onChange={() => set(settingKey, tag.key)} style={{ accentColor: CLR.primary }} />
            <code style={{ fontSize: 11, fontFamily: "monospace", color: CLR.primary }}>{tag.key}</code>
            <span>{tag.name}</span>
          </label>
        ))}
      </div>
    </div>
  );

  if (loading) return <div style={{ padding: 40, fontSize: 13, color: "#9ca3af" }}>Loading…</div>;

  return (
    <div>
      <TabHeader
        title="Tag Behaviours"
        description="Assign tags to enable special behaviours for customers who have that tag applied to their account."
      />

      <div style={card}>
        <p style={sectionTitle}>💲 Hide Prices Tag</p>
        <p style={{ fontSize: 13, color: CLR.muted, marginBottom: 14 }}>
          Customers with this tag will <strong>not see prices</strong> in the catalogue or subscribe flow.
          Instead, they will see an RFQ / inquiry button. Used for enterprise or custom-pricing customers.
        </p>
        <Field label="Tag that hides prices">
          <TagSelect settingKey={KEYS.hidePrice} current={settings[KEYS.hidePrice] ?? ""} />
        </Field>
      </div>

      <div style={card}>
        <p style={sectionTitle}>🔐 Exclude from 2FA Tag</p>
        <p style={{ fontSize: 13, color: CLR.muted, marginBottom: 14 }}>
          Customers with this tag will <strong>skip two-factor authentication</strong> (OTP) during login.
          Useful for service accounts or customers using SSO.
        </p>
        <Field label="Tag that bypasses 2FA">
          <TagSelect settingKey={KEYS.exclude2fa} current={settings[KEYS.exclude2fa] ?? ""} />
        </Field>
      </div>

      {tags.length === 0 && (
        <div style={{ ...card, background: "#fffbeb", border: "1px solid #fcd34d" }}>
          <p style={{ fontSize: 13, color: "#92400e" }}>
            No tags found. Create tags in <a href="/admin/catalog/tags" style={{ color: CLR.primary, fontWeight: 600 }}>Catalog → Tags</a> first, then return here to assign behaviours.
          </p>
        </div>
      )}

      <SaveBar saving={saving} saved={saved} error={error} onSave={save} />
    </div>
  );
}
