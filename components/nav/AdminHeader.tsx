// components/nav/AdminHeader.tsx
"use client";

import React from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";

interface AdminHeaderProps {
  title:        string;
  subtitle?:    string;
  breadcrumb?:  string;
  ctaLabel?:    string;
  ctaHref?:     string;
  ctaOnClick?:  () => void;
}

export function AdminHeader({ title, subtitle, breadcrumb, ctaLabel, ctaHref, ctaOnClick }: AdminHeaderProps) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
      padding: "20px 24px 16px", background: "#f5f5f5",
      borderBottom: "1px solid #e2e8f0", flexShrink: 0,
      flexWrap: "wrap", gap: 12,
    }}>
      <div>
        {breadcrumb && (
          <p style={{ fontSize: 11, color: "#94a3b8", letterSpacing: ".05em", marginBottom: 3, textTransform: "uppercase" }}>
            {breadcrumb}
          </p>
        )}
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "#0f172a", margin: 0 }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>{subtitle}</p>
        )}
      </div>

      {ctaLabel && (
        ctaHref ? (
          <Link href={ctaHref} style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 18px", fontSize: 13, fontWeight: 600,
            background: "#318774", color: "#fff",
            textDecoration: "none", flexShrink: 0,
          }}>
            <Icon name="plus" size={14} color="#fff" />
            {ctaLabel}
          </Link>
        ) : (
          <button onClick={ctaOnClick} type="button" style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 18px", fontSize: 13, fontWeight: 600, fontFamily: "inherit",
            background: "#318774", color: "#fff",
            border: "none", cursor: "pointer", flexShrink: 0,
          }}>
            <Icon name="plus" size={14} color="#fff" />
            {ctaLabel}
          </button>
        )
      )}
    </div>
  );
}