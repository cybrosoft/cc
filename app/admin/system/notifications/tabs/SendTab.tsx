// app/admin/system/notifications/tabs/SendTab.tsx
"use client";
import React, { useEffect, useState } from "react";
import { CLR } from "@/components/ui/admin-ui";

interface Market { id: string; key: string; name: string; }
interface Group  { id: string; key: string; name: string; }
interface Customer { id: string; fullName: string | null; email: string; customerNumber: number; }
interface Tag     { id: string; key: string; name: string; }

const CHANNEL_OPTIONS = [
  { id: "inapp", label: "In-App",  hint: "Bell icon in customer portal"   },
  { id: "email", label: "Email",   hint: "Via Resend to customer email"    },
  { id: "sms",   label: "SMS",     hint: "Via AWS SNS to mobile number"    },
];

const TARGET_TYPES = [
  { id: "all",      label: "All Customers"  },
  { id: "market",   label: "By Market"      },
  { id: "group",    label: "By Group"       },
  { id: "tag",      label: "By Tag"         },
  { id: "customer", label: "Single Customer"},
];

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", fontSize: 13,
  border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none",
  boxSizing: "border-box" as const,
};
const lbl: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em",
  marginBottom: 4, display: "block", textTransform: "uppercase" as const,
};

export default function SendTab() {
  const [markets,   setMarkets]   = useState<Market[]>([]);
  const [groups,    setGroups]    = useState<Group[]>([]);
  const [tags,      setTags]      = useState<Tag[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custSearch, setCustSearch] = useState("");

  const [targetType,   setTargetType]   = useState("all");
  const [targetId,     setTargetId]     = useState("");
  const [channels,     setChannels]     = useState<string[]>(["inapp", "email"]);
  const [title,        setTitle]        = useState("");
  const [body,         setBody]         = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [smsBody,      setSmsBody]      = useState("");
  const [scheduledAt,  setScheduledAt]  = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [broadcastType, setBroadcastType] = useState<"ESSENTIAL" | "MARKETING">("ESSENTIAL");
  const [sending,  setSending]  = useState(false);
  const [result,   setResult]   = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/settings/markets").then(r => r.json()),
      fetch("/api/admin/catalog/pricing/meta").then(r => r.json()),
      fetch("/api/admin/catalog/tags").then(r => r.json()),
    ]).then(([m, meta, t]) => {
      if (m.ok)    setMarkets(m.markets ?? []);
      if (meta.ok) setGroups(meta.data?.groups ?? []);
      if (t.ok)    setTags(t.data ?? []);
    });
  }, []);

  useEffect(() => {
    if (targetType !== "customer") return;
    const timer = setTimeout(() => {
      fetch(`/api/admin/users?pageSize=20${custSearch ? `&search=${custSearch}` : ""}`)
        .then(r => r.json())
        .then(d => setCustomers(d.data ?? []));
    }, 300);
    return () => clearTimeout(timer);
  }, [custSearch, targetType]);

  function toggleChannel(id: string) {
    setChannels(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  }

  function estimateSmsLength() {
    const text = smsBody || body;
    const len  = text.length;
    const segments = Math.ceil(len / 160);
    return { len, segments };
  }

  async function send() {
    if (!title.trim() || !body.trim()) { setResult({ ok: false, message: "Title and body are required" }); return; }
    if (!channels.length) { setResult({ ok: false, message: "Select at least one channel" }); return; }
    if (targetType !== "all" && !targetId) { setResult({ ok: false, message: "Select a target" }); return; }

    setSending(true); setResult(null);
    try {
      const res  = await fetch("/api/admin/notifications/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, body, emailSubject: emailSubject || title, broadcastType,
          smsBody: smsBody || undefined,
          channels, targetType, targetId: targetId || undefined,
          scheduledAt: scheduledAt || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult({
        ok: true,
        message: data.scheduled
          ? `Scheduled for ${new Date(scheduledAt).toLocaleString()} — ${data.totalCount} recipients`
          : `Sent to ${data.totalCount} recipient${data.totalCount !== 1 ? "s" : ""}`,
      });
      if (!data.scheduled) {
        setTitle(""); setBody(""); setEmailSubject(""); setSmsBody(""); setScheduledAt("");
      }
    } catch (e: any) { setResult({ ok: false, message: e.message }); }
    setSending(false);
  }

  const smsStats = estimateSmsLength();

  return (
    <div style={{ maxWidth: 720 }}>
      <p style={{ fontSize: 13, color: CLR.muted, marginBottom: 20 }}>
        Send a notification to customers. Choose channels, target audience, and compose your message.
      </p>

      {/* Broadcast Type */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "18px 20px", marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 14 }}>Broadcast Type</p>
        <div style={{ display: "flex", gap: 12 }}>
          {([
            {
              id: "ESSENTIAL" as const,
              label: "Essential",
              desc: "Always delivered. Cannot be opted out. Use for maintenance, security alerts, policy changes.",
              border: CLR.primary,
              bg: CLR.primaryBg,
            },
            {
              id: "MARKETING" as const,
              label: "Marketing",
              desc: "Customers can opt out per channel. Use for promotions, new features, announcements.",
              border: "#7c3aed",
              bg: "#f5f3ff",
            },
          ] as const).map(t => (
            <label key={t.id} style={{
              flex: 1, display: "flex", alignItems: "flex-start", gap: 10,
              padding: "12px 16px", cursor: "pointer",
              border: `1px solid ${broadcastType === t.id ? t.border : "#e5e7eb"}`,
              background: broadcastType === t.id ? t.bg : "#fff",
            }}>
              <input type="radio" name="broadcastType" value={t.id}
                checked={broadcastType === t.id}
                onChange={() => setBroadcastType(t.id)}
                style={{ accentColor: t.border, marginTop: 2, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, margin: "0 0 3px", color: broadcastType === t.id ? t.border : CLR.text }}>
                  {t.label}
                </p>
                <p style={{ fontSize: 12, color: CLR.muted, margin: 0, lineHeight: 1.5 }}>{t.desc}</p>
              </div>
            </label>
          ))}
        </div>
        {broadcastType === "MARKETING" && (
          <div style={{ marginTop: 10, padding: "8px 12px", background: "#fffbeb", border: "1px solid #fcd34d", fontSize: 12, color: "#92400e" }}>
            Customers who opted out of marketing on the selected channel(s) will be excluded automatically.
          </div>
        )}
      </div>

      {/* Target */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "18px 20px", marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 14 }}>Target Audience</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {TARGET_TYPES.map(t => (
            <button key={t.id} onClick={() => { setTargetType(t.id); setTargetId(""); }} style={{
              padding: "7px 16px", fontSize: 12, fontWeight: targetType === t.id ? 700 : 400,
              background: targetType === t.id ? CLR.primaryBg : "#f9fafb",
              color: targetType === t.id ? CLR.primary : CLR.muted,
              border: `1px solid ${targetType === t.id ? CLR.primary : "#e5e7eb"}`,
              cursor: "pointer", fontFamily: "inherit",
            }}>{t.label}</button>
          ))}
        </div>
        {targetType === "market" && (
          <div>
            <label style={lbl}>Select Market</label>
            <select value={targetId} onChange={e => setTargetId(e.target.value)} style={inp}>
              <option value="">— Choose market —</option>
              {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        )}
        {targetType === "group" && (
          <div>
            <label style={lbl}>Select Group</label>
            <select value={targetId} onChange={e => setTargetId(e.target.value)} style={inp}>
              <option value="">— Choose group —</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
        )}
        {targetType === "tag" && (
          <div>
            <label style={lbl}>Select Tag</label>
            <select value={targetId} onChange={e => setTargetId(e.target.value)} style={inp}>
              <option value="">— Choose tag —</option>
              {tags.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} <span style={{ fontFamily: "monospace" }}>({t.key})</span>
                </option>
              ))}
            </select>
            {targetId && (
              <p style={{ fontSize: 11, color: CLR.muted, marginTop: 6 }}>
                Will send to all customers who have the <code style={{ background: "#f3f4f6", padding: "1px 5px" }}>{tags.find(t => t.id === targetId)?.key}</code> tag assigned.
              </p>
            )}
          </div>
        )}
        {targetType === "customer" && (
          <div>
            <label style={lbl}>Search Customer</label>
            <input style={inp} value={custSearch} onChange={e => setCustSearch(e.target.value)} placeholder="Name or email…" />
            {customers.length > 0 && (
              <div style={{ marginTop: 6, border: "1px solid #e5e7eb", maxHeight: 180, overflowY: "auto" as const }}>
                {customers.map(c => (
                  <div key={c.id} onClick={() => { setTargetId(c.id); setCustSearch(c.fullName ?? c.email); }}
                    style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13, background: targetId === c.id ? CLR.primaryBg : "#fff", borderBottom: "1px solid #f3f4f6" }}
                    onMouseEnter={e => { if (targetId !== c.id) e.currentTarget.style.background = "#f9fafb"; }}
                    onMouseLeave={e => { if (targetId !== c.id) e.currentTarget.style.background = "#fff"; }}>
                    <span style={{ fontWeight: 500 }}>{c.fullName ?? c.email}</span>
                    <span style={{ fontSize: 11, color: CLR.faint, marginLeft: 8 }}>{c.email}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {targetType === "all" && (
          <p style={{ fontSize: 12, color: "#b45309", background: "#fffbeb", border: "1px solid #fcd34d", padding: "8px 12px" }}>
            This will send to ALL customers across all markets.
          </p>
        )}
      </div>

      {/* Channels */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "18px 20px", marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 14 }}>Channels</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const }}>
          {CHANNEL_OPTIONS.map(ch => {
            const active = channels.includes(ch.id);
            return (
              <label key={ch.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "10px 16px", border: `1px solid ${active ? CLR.primary : "#d1d5db"}`, background: active ? CLR.primaryBg : "#fff", flex: 1, minWidth: 140 }}>
                <input type="checkbox" checked={active} onChange={() => toggleChannel(ch.id)} style={{ accentColor: CLR.primary, marginTop: 2 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{ch.label}</p>
                  <p style={{ fontSize: 11, color: CLR.faint, margin: "2px 0 0" }}>{ch.hint}</p>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Message */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "18px 20px", marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 14 }}>Message</p>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Title / Subject</label>
          <input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="Maintenance window scheduled…" />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Body (in-app + email)</label>
          <textarea style={{ ...inp, resize: "vertical" as const }} rows={4} value={body} onChange={e => setBody(e.target.value)} placeholder="Your service will be temporarily unavailable…" />
        </div>

        {/* Advanced overrides */}
        <button onClick={() => setShowAdvanced(v => !v)} style={{ fontSize: 12, color: CLR.primary, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, marginBottom: showAdvanced ? 12 : 0 }}>
          {showAdvanced ? "▲ Hide" : "▼ Show"} channel-specific overrides
        </button>

        {showAdvanced && (
          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
            {channels.includes("email") && (
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Email Subject Override (optional)</label>
                <input style={inp} value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder={title || "Uses title if blank"} />
              </div>
            )}
            {channels.includes("sms") && (
              <div>
                <label style={lbl}>SMS Body Override (optional)</label>
                <textarea style={{ ...inp, resize: "vertical" as const }} rows={2} value={smsBody} onChange={e => setSmsBody(e.target.value)} placeholder={body.slice(0, 160) || "Uses body (truncated) if blank"} />
                <p style={{ fontSize: 11, color: smsStats.len > 160 ? "#dc2626" : CLR.faint, marginTop: 4 }}>
                  {smsStats.len} chars · {smsStats.segments} SMS segment{smsStats.segments !== 1 ? "s" : ""} per recipient
                  {smsStats.len > 160 && " — exceeds 1 segment, costs multiply"}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Schedule */}
      <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "18px 20px", marginBottom: 20 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 14 }}>Schedule (optional)</p>
        <div style={{ maxWidth: 320 }}>
          <label style={lbl}>Send at (leave blank to send now)</label>
          <input type="datetime-local" style={inp} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
        </div>
      </div>

      {result && (
        <div style={{ padding: "10px 14px", marginBottom: 14, background: result.ok ? "#f0fdf4" : "#fef2f2", border: `1px solid ${result.ok ? "#86efac" : "#fecaca"}`, color: result.ok ? "#15803d" : "#dc2626", fontSize: 13, fontWeight: 600 }}>
          {result.ok ? "✓ " : "✗ "}{result.message}
        </div>
      )}

      <button onClick={send} disabled={sending || !title || !body || !channels.length}
        style={{ padding: "10px 28px", fontSize: 13, fontWeight: 700, background: sending || !title || !body ? "#9ca3af" : CLR.primary, color: "#fff", border: "none", cursor: sending ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
        {sending ? "Sending…" : scheduledAt ? "Schedule Notification" : "Send Now"}
      </button>
    </div>
  );
}