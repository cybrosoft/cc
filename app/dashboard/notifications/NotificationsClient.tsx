"use client";
// app/dashboard/notifications/NotificationsClient.tsx

import { useEffect, useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/ui/tokens";

const SETTINGS_ICON = (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M7 9a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.3"/>
    <path d="M11.3 7c0-.2 0-.4-.1-.6l1.3-1-1-1.7-1.5.5a4 4 0 00-1-.6L9.8 2H7.2l-.2 1.6a4 4 0 00-1 .6L4.5 3.7l-1 1.7 1.3 1A4 4 0 004.7 7c0 .2 0 .4.1.6l-1.3 1 1 1.7 1.5-.5a4 4 0 001 .6l.2 1.6h2.6l.2-1.6a4 4 0 001-.6l1.5.5 1-1.7-1.3-1c.1-.2.1-.4.1-.6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  </svg>
);

interface Notif {
  id: string; type: string; title: string; body: string;
  link: string | null; isRead: boolean; readAt: string | null;
  eventType: string | null; createdAt: string;
}

const DOT_COLORS: Record<string, string> = {
  INFO:    "#2563eb",
  SUCCESS: "#0F6E56",
  WARNING: "#b45309",
  ERROR:   "#dc2626",
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return "Just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Sk({ w = "100%", h = 13 }: { w?: string | number; h?: number }) {
  return <span className="cy-shimmer" style={{ width: w, height: h, display: "inline-block" }} />;
}

export function NotificationsClient() {
  const [notifs,      setNotifs]      = useState<Notif[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [unread,      setUnread]      = useState(0);
  const [markingAll,  setMarkingAll]  = useState(false);
  const [showUnread,  setShowUnread]  = useState(false);
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set());

  function load() {
    const url = showUnread ? "/api/customer/notifications?unread=true" : "/api/customer/notifications";
    fetch(url)
      .then(r => r.json())
      .then(d => {
        setNotifs(d.notifications ?? []);
        setUnread(d.unreadCount  ?? 0);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [showUnread]); // eslint-disable-line

  async function markAllRead() {
    setMarkingAll(true);
    await fetch("/api/customer/notifications", { method: "POST" });
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnread(0);
    setMarkingAll(false);
  }

  async function markOneRead(id: string) {
    await fetch(`/api/customer/notifications/${id}/read`, { method: "POST" });
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  }

  const visible = notifs;

  return (
    <>
      <style>{`
        @keyframes cy-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .cy-shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%);background-size:800px 100%;animation:cy-shimmer 1.4s ease-in-out infinite;border-radius:4px;}
        .cy-notif:hover{background:#f5faf8!important;}
        .cy-filter-btn{border:0.5px solid #e5e7eb;cursor:pointer;padding:6px 12px;font-size:12.5px;transition:all 0.12s;}
      `}</style>

      <div className="cy-page-content">
        <div className="cy-dash-wrap">

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                <h1 className="cy-page-title" style={{ margin: 0 }}>Notifications</h1>
                {unread > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 20, height: 20, padding: "0 6px", borderRadius: 10, background: "#dc2626", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
                {loading ? "Loading…" : `${notifs.length} notification${notifs.length !== 1 ? "s" : ""}${unread > 0 ? ` · ${unread} unread` : ""}`}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Unread filter toggle */}
              <button className="cy-filter-btn"
                onClick={() => setShowUnread(!showUnread)}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  color:      showUnread ? colors.primary : "#6b7280",
                  background: showUnread ? "#e8f5f0" : "#fff",
                  borderColor:showUnread ? colors.primary : "#e5e7eb",
                  fontWeight: showUnread ? 600 : 400,
                }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M1.5 3.5h10M3.5 6.5h6M5.5 9.5h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                Unread only
              </button>
              {/* Mark all read */}
              {unread > 0 && (
                <button onClick={markAllRead} disabled={markingAll}
                  style={{ height: 34, padding: "0 14px", background: "#fff", border: "1px solid #e5e7eb", fontSize: 13, color: "#374151", cursor: markingAll ? "not-allowed" : "pointer", opacity: markingAll ? 0.6 : 1 }}>
                  {markingAll ? "Marking…" : "Mark all read"}
                </button>
              )}
              {/* Notification settings — primary button style */}
              <Link href="/dashboard/notifications/settings"
                style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 13px", background: colors.primary, fontSize: 12.5, fontWeight: 500, color: "#fff", textDecoration: "none", whiteSpace: "nowrap" }}>
                {SETTINGS_ICON}
                Settings
              </Link>
            </div>
          </div>

          {/* List */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>
            {loading ? (
              [1,2,3,4,5].map(i => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "14px 16px", borderBottom: "1px solid #f3f4f6", alignItems: "flex-start" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0, marginTop: 5 }} />
                  <div style={{ flex: 1 }}>
                    <Sk w="45%" h={13} />
                    <div style={{ marginTop: 6 }}><Sk w="70%" h={11} /></div>
                  </div>
                  <Sk w="40px" h={11} />
                </div>
              ))
            ) : visible.length === 0 ? (
              <div style={{ padding: "48px 16px", textAlign: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                    <path d="M11 2a7 7 0 017 7v3l1.5 2.5H2.5L4 12V9a7 7 0 017-7z" stroke="#9ca3af" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M9 18a2 2 0 004 0" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>
                  {showUnread ? "No unread notifications" : "You're all caught up"}
                </div>
                <div style={{ fontSize: 12.5, color: "#9ca3af" }}>
                  {showUnread ? "All notifications have been read." : "New notifications will appear here."}
                </div>
              </div>
            ) : (
              visible.map((n, idx) => {
                const dotColor  = DOT_COLORS[n.type] ?? "#6b7280";
                const isLast    = idx === visible.length - 1;
                const isExpanded = expanded.has(n.id);

                function handleClick() {
                  // Toggle expand
                  setExpanded(prev => {
                    const next = new Set(prev);
                    next.has(n.id) ? next.delete(n.id) : next.add(n.id);
                    return next;
                  });
                  // Mark read on first open
                  if (!n.isRead) markOneRead(n.id);
                }

                const row = (
                  <div
                    className="cy-notif"
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 12,
                      padding: "13px 16px",
                      borderBottom: isLast ? "none" : "1px solid #f3f4f6",
                      background: n.isRead ? "transparent" : "#f9fffe",
                      transition: "background 0.12s", cursor: "pointer",
                    }}
                    onClick={handleClick}>
                    {/* Unread dot */}
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: n.isRead ? "#e5e7eb" : dotColor, flexShrink: 0, marginTop: 5, transition: "background 0.2s" }} />
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", marginBottom: isExpanded ? 6 : 3, overflow: isExpanded ? "visible" : "hidden", textOverflow: isExpanded ? "unset" : "ellipsis", whiteSpace: isExpanded ? "normal" : "nowrap" }}>
                        {n.title}
                      </div>
                      {/* Body — collapsed: 1 line truncated, expanded: full pre-wrap */}
                      <div style={{
                        fontSize: 12.5, color: "#6b7280", lineHeight: 1.6,
                        ...(isExpanded
                          ? { whiteSpace: "pre-wrap", wordBreak: "break-word" }
                          : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
                        ),
                      }}>
                        {n.body}
                      </div>
                    </div>
                    {/* Time + chevron */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0, alignSelf: "flex-start" }}>
                      <span style={{ fontSize: 11, color: "#9ca3af", whiteSpace: "nowrap" }}>
                        {timeAgo(n.createdAt)}
                      </span>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                        style={{ transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", opacity: 0.4 }}>
                        <path d="M2 4l4 4 4-4" stroke="#6b7280" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                );

                // If has link and expanded, wrap in Link — otherwise plain div
                return n.link && isExpanded
                  ? <Link key={n.id} href={n.link} style={{ display: "block", textDecoration: "none", color: "inherit" }}>{row}</Link>
                  : <div key={n.id}>{row}</div>;
              })
            )}
          </div>

        </div>
      </div>
    </>
  );
}
