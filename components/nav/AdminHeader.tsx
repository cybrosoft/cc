// components/nav/AdminHeader.tsx
"use client";

import React from "react";

// Dark topbar — search, market pills, bell
// Shown on desktop (>= 1024px), hidden on mobile (AdminNav has its own mobile topbar)
// CTA buttons always go in the page title row, never here
export function AdminHeader() {
  return (
    <header className="cy-desktop-topbar" style={{
      height: 56, minHeight: 56, background: "#222222",
      borderBottom: "1px solid #2a2a2a",
      display: "flex", alignItems: "center",
      gap: 10, padding: "0 20px", flexShrink: 0,
    }}>
      {/* Search */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "#2c2c2c", border: "1px solid #383838",
        padding: "0 12px", height: 34, flex: 1, maxWidth: 520,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input style={{
          flex: 1, fontSize: 13, color: "#d1d5db", background: "none",
          border: "none", outline: "none", fontFamily: "inherit",
        }} placeholder="Search customers, invoices, subscriptions…" />
        <kbd style={{ fontSize: 10, color: "#555", background: "#1a1a1a", border: "1px solid #333", padding: "1px 5px" }}>⌘K</kbd>
      </div>

      <div style={{ flex: 1 }} />

      {/* Market pills */}
      {(["SA · SAR", "GL · USD"] as const).map((m, i) => (
        <span key={m} style={{
          fontSize: 11, fontWeight: 600, padding: "3px 10px",
          background: i === 0 ? "rgba(49,135,116,.2)" : "rgba(255,255,255,.06)",
          color:      i === 0 ? "#5dbfad" : "#6b7280",
          border:     `1px solid ${i === 0 ? "rgba(49,135,116,.4)" : "#333"}`,
        }}>{m}</span>
      ))}

      {/* Bell */}
      <Bell />
    </header>
  );
}

// Shared bell icon used in both desktop and mobile topbars
export function Bell() {
  return (
    <button style={{ width: 32, height: 32, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    </button>
  );
}