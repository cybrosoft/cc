"use client";
// components/nav/CustomerHeader.tsx

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { colors } from "@/lib/ui/tokens";

export function CustomerHeader() {
  const [lang, setLang] = useState<"EN" | "AR">("EN");

  return (
    <>
      <style>{`
        .cy-topbar-ham-spacer  { display: none; width: 48px; flex-shrink: 0; }
        .cy-topbar-lang-toggle { display: flex; }
        .cy-topbar-rfq-btn     { display: flex; }
        .cy-topbar-cta-text    { display: inline; }

        @media (max-width: 1023px) {
          .cy-topbar-ham-spacer  { display: block; }
          .cy-topbar-lang-toggle { display: none; }
        }
        @media (max-width: 639px) {
          .cy-topbar-rfq-btn  { display: none; }
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
            placeholder="Search services, invoices, documents…"
            style={{
              flex: 1, minWidth: 0, fontSize: 13, color: "#d1d5db",
              background: "none", border: "none", outline: "none", fontFamily: "inherit",
            }}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* Language toggle — hidden on tablet/mobile */}
        <div className="cy-topbar-lang-toggle">
          <div style={{ display: "flex", background: "#2c2c2c", border: "1px solid #383838" }}>
            {(["EN", "AR"] as const).map(l => (
              <button key={l} type="button" onClick={() => setLang(l)} style={{
                padding: "5px 12px", fontSize: 12, fontWeight: lang === l ? 600 : 400,
                background: lang === l ? colors.primary : "transparent",
                color: lang === l ? "#fff" : "#6b7280",
                border: "none", cursor: "pointer", fontFamily: "inherit",
              }}>{l}</button>
            ))}
          </div>
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

        {/* RFQ button — hidden on small mobile */}
        <Link href="/dashboard/rfq" className="cy-topbar-rfq-btn" style={{
          background: "none", border: "1px solid #383838", padding: "0 12px", height: 34,
          alignItems: "center", fontSize: 13, fontWeight: 500, color: "#9ca3af",
          textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
        }}>
          Submit RFQ
        </Link>

        {/* New Service CTA */}
        <Link href="/dashboard/catalogue" style={{
          background: colors.primary, border: "none", padding: "0 14px", height: 34,
          display: "flex", alignItems: "center", gap: 6,
          fontSize: 13, fontWeight: 600, color: "#fff",
          textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0,
        }}>
          <Icon name="plus" size={14} color="#fff" />
          <span className="cy-topbar-cta-text">New Service</span>
        </Link>
      </header>
    </>
  );
}
