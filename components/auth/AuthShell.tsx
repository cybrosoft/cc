"use client";
// components/auth/AuthShell.tsx
// Shared auth-page shell: light page background, centered card,
// green decorated LeftPanel on the left, form content on the right.
// Used by both /login and /signup (and their /sa variants).

import React from "react";

function LeftPanel({ headline, subtext }: { headline?: string; subtext?: string }) {
  return (
    <div style={{
      width: "100%", minHeight: "100%",
      background: "linear-gradient(160deg, #2f7d6c 0%, #1a4a40 55%, #0d2b25 100%)",
      display: "flex", flexDirection: "column" as const,
      justifyContent: "space-between", padding: "48px 44px",
      position: "relative" as const, overflow: "hidden",
      boxSizing: "border-box" as const,
    }}>
      {/* Grid overlay */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.06,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
        backgroundSize: "56px 56px",
      }} />

      {/* Decorative waves + circles */}
      <svg viewBox="0 0 600 900" preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
        <path d="M-50 120 C 120 40, 280 200, 650 90 L 650 -50 L -50 -50 Z" fill="rgba(255,255,255,0.06)" />
        <path d="M-50 200 C 150 100, 350 260, 650 160 L 650 -50 L -50 -50 Z" fill="rgba(255,255,255,0.04)" />
        <path d="M-50 760 C 150 680, 320 860, 650 740 L 650 950 L -50 950 Z" fill="rgba(13,43,37,0.55)" />
        <path d="M-50 820 C 180 740, 380 900, 650 800 L 650 950 L -50 950 Z" fill="rgba(49,135,116,0.35)" />
        <line x1="40" y1="700" x2="360" y2="260" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <line x1="220" y1="880" x2="560" y2="420" stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
        <circle cx="500" cy="110" r="26" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
        <circle cx="500" cy="110" r="12" fill="rgba(255,255,255,0.18)" />
        <circle cx="80" cy="330" r="18" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
        <circle cx="80" cy="330" r="7" fill="rgba(255,255,255,0.12)" />
        <circle cx="440" cy="640" r="22" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="2" />
        <circle cx="440" cy="640" r="9" fill="rgba(255,255,255,0.1)" />
        <circle cx="200" cy="180" r="4" fill="rgba(255,255,255,0.25)" />
        <circle cx="330" cy="520" r="3" fill="rgba(255,255,255,0.2)" />
        <circle cx="120" cy="560" r="3.5" fill="rgba(255,255,255,0.18)" />
      </svg>

      {/* Logo (top) */}
      <div style={{ position: "relative" as const }}>
        <div style={{ display: "flex", alignItems: "center"}}>
          <span style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.02em", color: "#e5e5e5" }}>Cybrosoft</span>
          <span style={{ fontSize: 13, color: "#b9b9b9", marginLeft: 7, marginTop: 5 }}>Console</span>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: 0 }}>Cloud Services Management Platform</p>
      </div>

      {/* Headline */}
      <div style={{ position: "relative" as const, textAlign: "left" as const }}>
        <div style={{ fontSize: 24, fontWeight: 500, color: "#ffffff99", lineHeight: 1.2, marginBottom: 14 }}>
          {headline ?? "Where your Cloud Meets Accountability"}
        </div>
        <div style={{ width: 40, height: 3, background: "rgba(255,255,255,0.85)", margin: "0 0 18px" }} />
        <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.7, maxWidth: 340 }}>
          {subtext ?? "Reliable infrastructure, transparent pricing, support that shows up."}
        </p>
      </div>

      {/* Footer */}
      <p style={{ position: "relative" as const, fontSize: 12, color: "rgba(255,255,255,0.35)", margin: 0 }}>
        © {new Date().getFullYear()} Cybrosoft · All rights reserved
      </p>
    </div>
  );
}

export default function AuthShell({ children, rightStyle, headline, subtext }: {
  children: React.ReactNode;
  rightStyle?: React.CSSProperties;
  headline?: string;
  subtext?: string;
}) {
  return (
    <>
      <style>{`
        .mobile-logo { display: none; }
        @media (max-width: 768px) {
          .auth-left { display: none !important; }
          .auth-right { width: 100% !important; padding: 32px 24px !important; }
          .auth-card { min-height: 100vh !important; border-radius: 0 !important; box-shadow: none !important; }
          .auth-page { padding: 0 !important; }
          .mobile-logo { display: block; }
        }
      `}</style>
      <div className="auth-page" style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#eef1f0", padding: "40px 24px",
        fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        <div className="auth-card" style={{
          display: "flex", width: "100%", maxWidth: 1060, minHeight: 640,
          background: "#fff", borderRadius: 4, overflow: "hidden",
          boxShadow: "0 24px 64px rgba(13,43,37,0.18)",
        }}>
          <div className="auth-left" style={{ width: "45%", flexShrink: 0, display: "flex" }}>
            <LeftPanel headline={headline} subtext={subtext} />
          </div>
          <div className="auth-right" style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "48px 32px", background: "#fff",
            ...rightStyle,
          }}>
            {children}
          </div>
        </div>
      </div>
    </>
  );
}
