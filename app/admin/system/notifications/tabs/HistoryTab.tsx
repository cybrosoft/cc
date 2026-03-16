// app/admin/system/notifications/tabs/HistoryTab.tsx
"use client";
import React, { useEffect, useState, useCallback } from "react";
import { CLR } from "@/components/ui/admin-ui";

interface Notification {
  id: string; title: string; body: string; eventType: string | null;
  channel: string | null; isRead: boolean; emailSent: boolean;
  smsSent: boolean; failureReason: string | null; broadcastId: string | null;
  createdAt: string; sentAt: string | null;
  user: { id: string; fullName: string | null; email: string; customerNumber: number };
}

interface Broadcast {
  id: string; title: string; channels: string[]; targetType: string;
  totalCount: number; sentCount: number; failCount: number;
  sentAt: string | null; createdAt: string;
  createdBy: { fullName: string | null; email: string };
}

const inp: React.CSSProperties = { padding: "7px 10px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none", background: "#fff" };

export default function HistoryTab() {
  const [view, setView]               = useState<"notifications" | "broadcasts">("notifications");
  const [notifications, setNotifs]    = useState<Notification[]>([]);
  const [broadcasts, setBroadcasts]   = useState<Broadcast[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(false);
  const [filterEvent, setFilterEvent] = useState("");
  const [filterChan,  setFilterChan]  = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (view === "notifications") {
        const p = new URLSearchParams({ page: String(page) });
        if (filterEvent) p.set("eventType", filterEvent);
        if (filterChan)  p.set("channel",   filterChan);
        const d = await fetch(`/api/admin/notifications?${p}`).then(r => r.json());
        if (d.ok) { setNotifs(d.notifications ?? []); setTotal(d.total ?? 0); }
      } else {
        const d = await fetch(`/api/admin/notifications/send?page=${page}`).then(r => r.json());
        if (d.ok) { setBroadcasts(d.broadcasts ?? []); setTotal(d.total ?? 0); }
      }
    } catch { /**/ }
    setLoading(false);
  }, [view, page, filterEvent, filterChan]);

  useEffect(() => { load(); }, [load]);

  function ChannelBadge({ ch }: { ch: string }) {
    const map: Record<string, { bg: string; color: string }> = {
      inapp: { bg: "#eff6ff", color: "#1d4ed8" },
      email: { bg: "#f0fdf4", color: "#15803d" },
      sms:   { bg: "#fef3c7", color: "#92400e" },
    };
    const s = map[ch] ?? { bg: "#f3f4f6", color: CLR.muted };
    return <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", background: s.bg, color: s.color, border: `1px solid ${s.color}33` }}>{ch.toUpperCase()}</span>;
  }

  function DeliveryStatus({ n }: { n: Notification }) {
    if (n.failureReason) return <span style={{ fontSize: 11, color: "#dc2626" }}>✗ Failed</span>;
    const checks = [
      n.channel === "inapp"  ? "✓ In-app"  : null,
      n.emailSent            ? "✓ Email"   : null,
      n.smsSent              ? "✓ SMS"     : null,
    ].filter(Boolean);
    if (!checks.length) return <span style={{ fontSize: 11, color: CLR.faint }}>Pending</span>;
    return <span style={{ fontSize: 11, color: "#15803d" }}>{checks.join(" · ")}</span>;
  }

  return (
    <div>
      {/* View toggle */}
      <div style={{ display: "flex", gap: 0, marginBottom: 16, border: "1px solid #e5e7eb", background: "#fff", width: "fit-content" }}>
        {[["notifications", "Individual Notifications"], ["broadcasts", "Broadcasts"]].map(([id, label]) => (
          <button key={id} onClick={() => { setView(id as any); setPage(1); }}
            style={{ padding: "8px 18px", fontSize: 12, fontWeight: view === id ? 700 : 400, background: view === id ? CLR.primaryBg : "none", color: view === id ? CLR.primary : CLR.muted, border: "none", borderRight: "1px solid #e5e7eb", cursor: "pointer", fontFamily: "inherit" }}>
            {label}
          </button>
        ))}
      </div>

      {/* Filters — notifications view */}
      {view === "notifications" && (
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" as const }}>
          <select value={filterEvent} onChange={e => { setFilterEvent(e.target.value); setPage(1); }} style={inp}>
            <option value="">All Events</option>
            {["INVOICE_ISSUED","INVOICE_OVERDUE","SUBSCRIPTION_EXPIRING","SUBSCRIPTION_ACTIVATED","SUBSCRIPTION_SUSPENDED","QUOTATION_SENT","PAYMENT_RECEIVED","BROADCAST"].map(e => (
              <option key={e} value={e}>{e.replace(/_/g, " ")}</option>
            ))}
          </select>
          <select value={filterChan} onChange={e => { setFilterChan(e.target.value); setPage(1); }} style={inp}>
            <option value="">All Channels</option>
            <option value="inapp">In-App</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
          <button onClick={load} style={{ padding: "7px 14px", fontSize: 12, background: CLR.primaryBg, color: CLR.primary, border: `1px solid ${CLR.primary}44`, cursor: "pointer", fontFamily: "inherit" }}>Refresh</button>
        </div>
      )}

      {loading
        ? <div style={{ padding: "40px", textAlign: "center", color: CLR.faint, fontSize: 13 }}>Loading…</div>
        : view === "notifications"
          ? (
            <div style={{ border: "1px solid #e5e7eb", background: "#fff", overflowX: "auto" as const }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    {["Customer","Event","Channel","Title","Status","Date"].map(h => (
                      <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em", textTransform: "uppercase" as const, whiteSpace: "nowrap" as const }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {notifications.length === 0
                    ? <tr><td colSpan={6} style={{ padding: "32px", textAlign: "center", color: CLR.faint, fontSize: 13 }}>No notifications found</td></tr>
                    : notifications.map(n => (
                      <tr key={n.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ fontWeight: 500, fontSize: 12 }}>{n.user.fullName ?? n.user.email}</div>
                          <div style={{ fontSize: 11, color: CLR.faint }}>{n.user.email}</div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <span style={{ fontSize: 11, color: CLR.muted }}>{(n.eventType ?? "—").replace(/_/g, " ")}</span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          {n.channel ? <ChannelBadge ch={n.channel} /> : <span style={{ color: CLR.faint, fontSize: 11 }}>—</span>}
                        </td>
                        <td style={{ padding: "10px 14px", maxWidth: 240 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{n.title}</div>
                        </td>
                        <td style={{ padding: "10px 14px" }}><DeliveryStatus n={n} /></td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: CLR.muted, whiteSpace: "nowrap" as const }}>
                          {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )
          : (
            <div style={{ border: "1px solid #e5e7eb", background: "#fff", overflowX: "auto" as const }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                    {["Title","Channels","Target","Sent","Failed","Date","By"].map(h => (
                      <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {broadcasts.length === 0
                    ? <tr><td colSpan={7} style={{ padding: "32px", textAlign: "center", color: CLR.faint }}>No broadcasts yet</td></tr>
                    : broadcasts.map(b => (
                      <tr key={b.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                        <td style={{ padding: "10px 14px", fontWeight: 500, maxWidth: 200 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{b.title}</div>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                            {b.channels.map(ch => <span key={ch} style={{ fontSize: 10, fontWeight: 600, padding: "1px 6px", background: "#f3f4f6", border: "1px solid #e5e7eb", color: CLR.muted }}>{ch.toUpperCase()}</span>)}
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: CLR.muted }}>{b.targetType.toUpperCase()}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: "#15803d", fontWeight: 600 }}>{b.sentCount} / {b.totalCount}</td>
                        <td style={{ padding: "10px 14px", fontSize: 12, color: b.failCount > 0 ? "#dc2626" : CLR.faint }}>{b.failCount}</td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: CLR.muted, whiteSpace: "nowrap" as const }}>
                          {b.sentAt ? new Date(b.sentAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "Scheduled"}
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: 11, color: CLR.faint }}>{b.createdBy.fullName ?? b.createdBy.email}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )
      }

      {/* Pagination */}
      {total > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, fontSize: 12, color: CLR.muted }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: "5px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", cursor: page === 1 ? "not-allowed" : "pointer", fontFamily: "inherit", color: CLR.muted }}>
            ← Prev
          </button>
          <span>Page {page} · {total} total</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page * 50 >= total}
            style={{ padding: "5px 12px", background: "#f9fafb", border: "1px solid #e5e7eb", cursor: page * 50 >= total ? "not-allowed" : "pointer", fontFamily: "inherit", color: CLR.muted }}>
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
