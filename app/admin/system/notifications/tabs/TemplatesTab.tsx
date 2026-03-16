// app/admin/system/notifications/tabs/TemplatesTab.tsx
"use client";
import React, { useEffect, useState } from "react";
import { CLR } from "@/components/ui/admin-ui";

interface Template {
  id: string; eventType: string; name: string;
  emailSubject: string; emailBody: string; smsBody: string | null;
  defaultEmail: boolean; defaultSms: boolean; defaultInapp: boolean;
  lockChannels: boolean; isActive: boolean;
}

const VARIABLES_HELP = [
  "{customerName}", "{customerEmail}", "{portalName}",
  "{docNum}", "{amount}", "{dueDate}", "{expiryDate}",
  "{days}", "{productName}", "{link}",
];

const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const };

export default function TemplatesTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [active, setActive]       = useState<string | null>(null);
  const [draft, setDraft]         = useState<Template | null>(null);
  const [saving, setSaving]       = useState(false);
  const [saved,  setSaved]        = useState(false);
  const [error,  setError]        = useState("");
  const [loading, setLoading]     = useState(true);
  const [preview, setPreview]     = useState<"email" | "sms">("email");

  useEffect(() => {
    fetch("/api/admin/notifications/templates")
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setTemplates(d.templates);
          if (d.templates.length > 0) {
            setActive(d.templates[0].id);
            setDraft({ ...d.templates[0] });
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function selectTemplate(id: string) {
    const t = templates.find(t => t.id === id);
    if (t) { setActive(id); setDraft({ ...t }); setSaved(false); setError(""); }
  }

  function patch(key: keyof Template, val: unknown) {
    setDraft(d => d ? { ...d, [key]: val } : d);
    setSaved(false);
  }

  async function save() {
    if (!draft) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      const res  = await fetch("/api/admin/notifications/templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id:           draft.id,
          emailSubject: draft.emailSubject,
          emailBody:    draft.emailBody,
          smsBody:      draft.smsBody,
          defaultEmail: draft.defaultEmail,
          defaultSms:   draft.defaultSms,
          defaultInapp: draft.defaultInapp,
          lockChannels: draft.lockChannels,
          isActive:     draft.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setTemplates(prev => prev.map(t => t.id === draft.id ? { ...t, ...data.template } : t));
      setSaved(true);
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  function renderPreview(template: string): string {
    const demo: Record<string, string> = {
      customerName: "Ahmed Al-Rashidi", customerEmail: "ahmed@company.sa",
      portalName: "Cybrosoft Cloud Console", docNum: "CY-INV-5250",
      amount: "SAR 1,500.00", dueDate: "30 Apr 2026", expiryDate: "15 May 2026",
      days: "7", productName: "Cloud Server Standard", link: "https://console.cybrosoft.com",
    };
    let result = template;
    for (const [k, v] of Object.entries(demo)) result = result.replaceAll(`{${k}}`, v);
    return result;
  }

  if (loading) return <div style={{ padding: 40, fontSize: 13, color: CLR.faint }}>Loading templates…</div>;
  if (!draft)  return <div style={{ padding: 40, fontSize: 13, color: CLR.faint }}>No templates found. Run migration.sql first.</div>;

  return (
    <div style={{ display: "flex", gap: 0, alignItems: "flex-start" }}>

      {/* Template list sidebar */}
      <div style={{ width: 220, flexShrink: 0, border: "1px solid #e5e7eb", background: "#fff", marginRight: 20 }}>
        {templates.map(t => (
          <button key={t.id} onClick={() => selectTemplate(t.id)} style={{
            display: "block", width: "100%", padding: "11px 14px", textAlign: "left" as const,
            background: active === t.id ? CLR.primaryBg : "none",
            borderLeft: active === t.id ? `3px solid ${CLR.primary}` : "3px solid transparent",
            border: "none", borderBottom: "1px solid #f3f4f6",
            cursor: "pointer", fontFamily: "inherit",
          }}>
            <p style={{ fontSize: 12, fontWeight: active === t.id ? 700 : 500, color: active === t.id ? CLR.primary : CLR.text, margin: 0 }}>{t.name}</p>
            <p style={{ fontSize: 10, color: CLR.faint, margin: "2px 0 0", fontFamily: "monospace" }}>{t.eventType}</p>
            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" as const }}>
              {t.defaultInapp && <span style={{ fontSize: 9, padding: "1px 5px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>APP</span>}
              {t.defaultEmail && <span style={{ fontSize: 9, padding: "1px 5px", background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac" }}>EMAIL</span>}
              {t.defaultSms   && <span style={{ fontSize: 9, padding: "1px 5px", background: "#fef3c7", color: "#92400e", border: "1px solid #fcd34d" }}>SMS</span>}
              {t.lockChannels && <span style={{ fontSize: 9, padding: "1px 5px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>LOCKED</span>}
            </div>
          </button>
        ))}
      </div>

      {/* Editor */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{draft.name}</h3>
            <code style={{ fontSize: 11, color: CLR.muted }}>{draft.eventType}</code>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={draft.isActive} onChange={e => patch("isActive", e.target.checked)} style={{ accentColor: CLR.primary }} />
              Active
            </label>
          </div>
        </div>

        {/* Variables reference */}
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: "8px 12px", marginBottom: 14 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: CLR.muted, letterSpacing: "0.04em", marginBottom: 6, textTransform: "uppercase" as const }}>Available Variables</p>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
            {VARIABLES_HELP.map(v => (
              <code key={v} style={{ fontSize: 10, padding: "1px 6px", background: "#fff", border: "1px solid #e5e7eb", color: CLR.primary, cursor: "pointer" }}
                onClick={() => navigator.clipboard?.writeText(v)}>
                {v}
              </code>
            ))}
          </div>
        </div>

        {/* Email section */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: 0 }}>Email</p>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={draft.defaultEmail} onChange={e => patch("defaultEmail", e.target.checked)} style={{ accentColor: CLR.primary }} />
              Send by default
            </label>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em", display: "block", marginBottom: 3, textTransform: "uppercase" as const }}>Subject</label>
            <input style={inp} value={draft.emailSubject} onChange={e => patch("emailSubject", e.target.value)} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em", display: "block", marginBottom: 3, textTransform: "uppercase" as const }}>Body (HTML)</label>
            <textarea style={{ ...inp, resize: "vertical" as const, fontFamily: "monospace", fontSize: 11 }} rows={6}
              value={draft.emailBody} onChange={e => patch("emailBody", e.target.value)} />
          </div>
          {/* Preview */}
          {draft.emailBody && (
            <details style={{ marginTop: 8 }}>
              <summary style={{ fontSize: 11, color: CLR.primary, cursor: "pointer", fontWeight: 600 }}>Preview with sample data</summary>
              <div style={{ marginTop: 8, padding: 12, background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 12 }}
                dangerouslySetInnerHTML={{ __html: renderPreview(draft.emailBody) }} />
            </details>
          )}
        </div>

        {/* SMS section */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "16px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: 0 }}>SMS</p>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={draft.defaultSms} onChange={e => patch("defaultSms", e.target.checked)} style={{ accentColor: CLR.primary }} />
              Send by default
            </label>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em", display: "block", marginBottom: 3, textTransform: "uppercase" as const }}>SMS Body (plain text, max 160 chars per segment)</label>
            <textarea style={{ ...inp, resize: "vertical" as const }} rows={3}
              value={draft.smsBody ?? ""} onChange={e => patch("smsBody", e.target.value)} />
            <p style={{ fontSize: 10, color: (draft.smsBody?.length ?? 0) > 160 ? "#b45309" : CLR.faint, marginTop: 3 }}>
              {draft.smsBody?.length ?? 0} chars
              {(draft.smsBody?.length ?? 0) > 160 && ` · ${Math.ceil((draft.smsBody?.length ?? 0) / 160)} segments`}
            </p>
          </div>
          {draft.smsBody && (
            <div style={{ marginTop: 8, padding: "8px 10px", background: "#fffbeb", border: "1px solid #fcd34d", fontSize: 12, color: "#92400e" }}>
              Preview: {renderPreview(draft.smsBody)}
            </div>
          )}
        </div>

        {/* Channel settings */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "16px 18px", marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 12 }}>Channel Settings</p>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" as const }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={draft.defaultInapp} onChange={e => patch("defaultInapp", e.target.checked)} style={{ accentColor: CLR.primary }} />
              In-app by default
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
              <input type="checkbox" checked={draft.lockChannels} onChange={e => patch("lockChannels", e.target.checked)} style={{ accentColor: "#dc2626" }} />
              <span>Lock channels <span style={{ fontSize: 11, color: CLR.faint }}>(customers cannot override)</span></span>
            </label>
          </div>
          {draft.lockChannels && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", fontSize: 12, color: "#dc2626" }}>
              Channels are locked — customers cannot change their preferences for this event type. Use only for critical notifications (payment overdue, suspension).
            </div>
          )}
        </div>

        {/* Save bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={save} disabled={saving}
            style={{ padding: "9px 22px", fontSize: 13, fontWeight: 600, background: saving ? "#9ca3af" : CLR.primary, color: "#fff", border: "none", cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {saving ? "Saving…" : "Save Template"}
          </button>
          {saved  && <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>✓ Saved</span>}
          {error  && <span style={{ fontSize: 12, color: "#dc2626" }}>{error}</span>}
        </div>
      </div>
    </div>
  );
}