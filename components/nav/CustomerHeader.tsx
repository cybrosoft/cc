"use client";
// components/nav/CustomerHeader.tsx

import React, { useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { colors } from "@/lib/ui/tokens";

interface CustomerHeaderProps {
  ctaLabel?: string;
  ctaHref?: string;
}

export function CustomerHeader({ ctaLabel = "New Service", ctaHref = "/dashboard/catalogue" }: CustomerHeaderProps) {
  const [lang, setLang] = useState<"EN" | "AR">("EN");

  return (
    <header style={{
      height: 56,
      background: colors.headerBg,
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      padding: "0 24px",
      gap: 12,
      borderBottom: `1px solid ${colors.headerBorder}`,
    }}>
      {/* Search */}
      <div style={{
        flex: 1, maxWidth: 560,
        display: "flex", alignItems: "center", gap: 10,
        background: "#2c2c2c", border: "1px solid #383838",
        padding: "0 14px", height: 36,
      }}>
        <Icon name="search" size={15} color="#6b7280" />
        <input
          placeholder="Search services, invoices, documents…"
          style={{ flex: 1, fontSize: 13.5, color: "#d1d5db", background: "none", border: "none", outline: "none" }}
        />
        <kbd style={{ fontSize: 11, color: "#555", background: "#1a1a1a", border: "1px solid #333", padding: "1px 6px", flexShrink: 0 }}>⌘K</kbd>
      </div>

      <div style={{ flex: 1 }} />

      {/* Language toggle */}
      <div style={{ display: "flex", background: "#2c2c2c", border: "1px solid #383838" }}>
        {(["EN", "AR"] as const).map(l => (
          <button key={l} onClick={() => setLang(l)} style={{
            padding: "5px 14px", fontSize: 12,
            fontWeight: lang === l ? 600 : 400,
            background: lang === l ? colors.primary : "transparent",
            color: lang === l ? "#fff" : "#6b7280",
            border: "none", cursor: "pointer",
          }}>{l}</button>
        ))}
      </div>

      {/* Bell */}
      <button style={{
        position: "relative", width: 34, height: 34,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "none", border: "1px solid #383838", cursor: "pointer",
      }}>
        <Icon name="bell" size={16} color="#9ca3af" />
        <span style={{
          position: "absolute", top: 7, right: 7,
          width: 6, height: 6, background: "#ef4444", border: "1.5px solid #222",
        }} />
      </button>

      {/* Submit RFQ */}
      <Link href="/dashboard/rfq" style={{
        background: "none", border: "1px solid #383838",
        padding: "0 14px", height: 34,
        display: "flex", alignItems: "center",
        fontSize: 13, fontWeight: 500, color: "#9ca3af",
        textDecoration: "none",
      }}>Submit RFQ</Link>

      {/* CTA */}
      <Link href={ctaHref} style={{
        background: colors.primary, padding: "0 16px", height: 34,
        display: "flex", alignItems: "center", gap: 6,
        fontSize: 13, fontWeight: 600, color: "#fff",
        textDecoration: "none",
      }}>
        <Icon name="plus" size={14} color="#fff" />
        {ctaLabel}
      </Link>
    </header>
  );
}
