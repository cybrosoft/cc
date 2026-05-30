"use client";
// components/ui/ComingSoonPage.tsx
import Link from "next/link";
import { colors } from "@/lib/ui/tokens";

interface Props {
  title?: string;
  description?: string;
  rfqLink?: string;
}

export function ComingSoonPage({ title, description, rfqLink }: Props) {
  return (
    <div className="cy-page-content">
      <div className="cy-dash-wrap" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <div style={{ textAlign: "center", maxWidth: 420 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🚧</div>
          {title && (
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 8px", letterSpacing: "-0.02em" }}>
              {title}
            </h1>
          )}
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 24px", lineHeight: 1.6 }}>
            {description ?? "This section is coming soon. We're working hard to bring you new features."}
          </p>
          {rfqLink && (
            <Link href={rfqLink}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 20px", background: colors.primary, color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              Submit an RFQ →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
