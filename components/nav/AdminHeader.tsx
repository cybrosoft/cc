"use client";
// components/nav/AdminHeader.tsx

import React from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { colors } from "@/lib/ui/tokens";

interface AdminHeaderProps {
  title: string;
  breadcrumb?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
}

export function AdminHeader({ title, breadcrumb, ctaLabel, ctaHref, ctaOnClick }: AdminHeaderProps) {
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
        flex: 1,
        maxWidth: 560,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "#2c2c2c",
        border: "1px solid #383838",
        padding: "0 14px",
        height: 36,
      }}>
        <Icon name="search" size={15} color="#6b7280" />
        <input
          placeholder="Search customers, invoices, subscriptions…"
          style={{
            flex: 1,
            fontSize: 13.5,
            color: "#d1d5db",
            background: "none",
            border: "none",
            outline: "none",
          }}
        />
        <kbd style={{
          fontSize: 11,
          color: "#555",
          background: "#1a1a1a",
          border: "1px solid #333",
          padding: "1px 6px",
          flexShrink: 0,
        }}>⌘K</kbd>
      </div>

      <div style={{ flex: 1 }} />

      {/* Market pills */}
      {["SA · SAR", "GL · USD"].map((m, i) => (
        <span key={m} style={{
          fontSize: 11,
          fontWeight: 600,
          padding: "3px 10px",
          background: i === 0 ? "rgba(49,135,116,.2)" : "rgba(255,255,255,.06)",
          color: i === 0 ? "#5dbfad" : "#6b7280",
          border: `1px solid ${i === 0 ? "rgba(49,135,116,.4)" : "#333"}`,
        }}>{m}</span>
      ))}

      {/* Notification bell */}
      <button style={{
        position: "relative",
        width: 34, height: 34,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "none",
        border: "1px solid #383838",
        cursor: "pointer",
      }}>
        <Icon name="bell" size={16} color="#9ca3af" />
        <span style={{
          position: "absolute", top: 7, right: 7,
          width: 6, height: 6,
          background: "#ef4444",
          border: "1.5px solid #222",
        }} />
      </button>

      {/* CTA */}
      {ctaLabel && (
        ctaHref ? (
          <Link href={ctaHref} style={{
            background: colors.primary,
            padding: "0 16px",
            height: 34,
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 13, fontWeight: 600, color: "#fff",
            textDecoration: "none",
          }}>
            <Icon name="plus" size={14} color="#fff" />
            {ctaLabel}
          </Link>
        ) : (
          <button onClick={ctaOnClick} style={{
            background: colors.primary,
            border: "none",
            padding: "0 16px",
            height: 34,
            display: "flex", alignItems: "center", gap: 6,
            fontSize: 13, fontWeight: 600, color: "#fff",
            cursor: "pointer",
          }}>
            <Icon name="plus" size={14} color="#fff" />
            {ctaLabel}
          </button>
        )
      )}
    </header>
  );
}
