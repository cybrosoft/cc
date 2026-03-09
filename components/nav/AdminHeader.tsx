"use client";
// components/nav/AdminHeader.tsx

import React from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { colors } from "@/lib/ui/tokens";

interface AdminHeaderProps {
  ctaLabel?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
}

export function AdminHeader({ ctaLabel, ctaHref, ctaOnClick }: AdminHeaderProps) {
  return (
    <>
      <style>{`
        .cy-topbar-ham-spacer { display: none; width: 48px; flex-shrink: 0; }
        .cy-topbar-pills      { display: flex; }
        .cy-topbar-search-kbd { display: inline; }
        .cy-topbar-cta-text   { display: inline; }

        @media (max-width: 1023px) {
          .cy-topbar-ham-spacer { display: block; }
          .cy-topbar-pills      { display: none; }
          .cy-topbar-search-kbd { display: none; }
        }
        @media (max-width: 639px) {
          .cy-topbar-cta-text { display: none; }
        }
      `}</style>

      <header style={{
        height: 56, background: "#222222", flexShrink: 0,
        display: "flex", alignItems: "center", padding: "0 16px", gap: 10,
        borderBottom: "1px solid #2a2a2a",
      }}>
        {/* Space for hamburger on mobile */}
        <div className="cy-topbar-ham-spacer" />

        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#2c2c2c", border: "1px solid #383838",
          padding: "0 12px", height: 34, flex: 1, maxWidth: 520,
        }}>
          <Icon name="search" size={15} color="#6b7280" />
          <input
            placeholder="Search customers, invoices, subscriptions…"
            style={{
              flex: 1, minWidth: 0, fontSize: 13, color: "#d1d5db",
              background: "none", border: "none", outline: "none", fontFamily: "inherit",
            }}
          />
          <kbd className="cy-topbar-search-kbd" style={{ fontSize: 11, color: "#555", background: "#1a1a1a", border: "1px solid #333", padding: "1px 5px" }}>⌘K</kbd>
        </div>

        <div style={{ flex: 1 }} />

        {/* Market pills — hidden on tablet/mobile */}
        <div className="cy-topbar-pills" style={{ gap: 6 }}>
          {(["SA · SAR", "GL · USD"] as const).map((m, i) => (
            <span key={m} style={{
              fontSize: 11, fontWeight: 600, padding: "3px 10px",
              background: i === 0 ? "rgba(49,135,116,.2)" : "rgba(255,255,255,.06)",
              color: i === 0 ? "#5dbfad" : "#6b7280",
              border: `1px solid ${i === 0 ? "rgba(49,135,116,.4)" : "#333"}`,
            }}>{m}</span>
          ))}
        </div>

        {/* Bell */}
        <button style={{
          position: "relative", width: 34, height: 34,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "none", border: "1px solid #383838", cursor: "pointer", flexShrink: 0,
        }} aria-label="Notifications">
          <Icon name="bell" size={16} color="#9ca3af" />
          <span style={{
            position: "absolute", top: 6, right: 6, width: 6, height: 6,
            background: "#ef4444", border: "1.5px solid #222",
          }} />
        </button>

        {/* CTA */}
        {ctaLabel && (
          ctaHref ? (
            <Link href={ctaHref} style={{
              background: colors.primary, border: "none", padding: "0 14px", height: 34,
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 13, fontWeight: 600, color: "#fff",
              cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              <Icon name="plus" size={14} color="#fff" />
              <span className="cy-topbar-cta-text">{ctaLabel}</span>
            </Link>
          ) : (
            <button onClick={ctaOnClick} style={{
              background: colors.primary, border: "none", padding: "0 14px", height: 34,
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 13, fontWeight: 600, color: "#fff",
              cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", flexShrink: 0,
            }}>
              <Icon name="plus" size={14} color="#fff" />
              <span className="cy-topbar-cta-text">{ctaLabel}</span>
            </button>
          )
        )}
      </header>
    </>
  );
}
