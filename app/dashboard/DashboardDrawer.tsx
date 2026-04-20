"use client";
// app/dashboard/DashboardDrawer.tsx

import { useState } from "react";
import { usePathname } from "next/navigation";
import { CustomerHeader } from "@/components/nav/CustomerHeader";
import { CustomerNav } from "@/components/nav/CustomerNav";
import type { BillingNavVisibility } from "@/components/nav/CustomerNav";

interface DashboardDrawerProps {
  userEmail: string;
  userName: string | null;
  companyName: string | null;
  customerNumber: string;
  billingVisibility: BillingNavVisibility;
  needsOnboarding: boolean;
  totpEnabled: boolean;
  userStatus: string;
  infoRequiredMessage?: string | null;
  suspensionReason?: string | null;
  children: React.ReactNode;
}

export function DashboardDrawer({
  userEmail,
  userName,
  companyName,
  customerNumber,
  billingVisibility,
  needsOnboarding,
  totpEnabled,
  userStatus,
  infoRequiredMessage,
  suspensionReason,
  children,
}: DashboardDrawerProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  const isHome = pathname === "/dashboard" || pathname === "/sa/dashboard";

  return (
    <>
      <style>{`
        .cy-mobile-spacer {
          display: none;
          height: 56px;
          flex-shrink: 0;
        }
        .cy-page-content {
          max-width: 1880px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        .cy-page-title {
          font-size: 24px;
          font-weight: 600;
          color: #111827;
          letter-spacing: -0.02em;
          margin: 0 0 20px;
        }
        @media (max-width: 1023px) {
          .cy-mobile-spacer { display: block !important; }
          .cy-page-title    { font-size: 20px; margin-bottom: 14px; }
        }
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden", background: "#f9fafb" }}>
        <CustomerNav
          userEmail={userEmail}
          userName={userName}
          companyName={companyName}
          customerNumber={customerNumber}
          billingVisibility={billingVisibility}
          drawerOpen={drawerOpen}
          onDrawerClose={() => setDrawerOpen(false)}
          needsOnboarding={needsOnboarding}
          userStatus={userStatus}
        />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "visible", minWidth: 0, position: "relative", zIndex: 1 }}>
          <CustomerHeader
            userEmail={userEmail}
            userName={userName}
            companyName={companyName}
            customerNumber={customerNumber}
            drawerOpen={drawerOpen}
            onHamburgerClick={() => setDrawerOpen(v => !v)}
          />

          <div className="cy-mobile-spacer" />

          {/* ── PENDING banner ── */}
          {userStatus === "PENDING" && (
            <div style={{
              background: "#fff8e6", borderBottom: "1px solid #fcd34d",
              padding: "10px 20px", display: "flex", alignItems: "center",
              gap: 10, flexShrink: 0, flexWrap: "wrap" as const,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="8" cy="8" r="7" stroke="#92400e" strokeWidth="1.5"/>
                <path d="M8 4.5v4l2 2" stroke="#92400e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>Your account is pending approval. </span>
                <span style={{ fontSize: 12.5, color: "#b45309" }}>Our team will review and activate your account shortly. You'll receive an email once approved.</span>
              </div>
            </div>
          )}

          {/* ── INFO_REQUIRED banner ── */}
          {userStatus === "INFO_REQUIRED" && (
            <div style={{
              background: "#fdf0ef", borderBottom: "1px solid #fca5a5",
              padding: "10px 20px", display: "flex", alignItems: "flex-start",
              gap: 10, flexShrink: 0, flexWrap: "wrap" as const,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="8" cy="8" r="7" stroke="#991b1b" strokeWidth="1.5"/>
                <path d="M8 7v4" stroke="#991b1b" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="4.5" r="0.75" fill="#991b1b"/>
              </svg>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#991b1b" }}>Additional information required. </span>
                <span style={{ fontSize: 12.5, color: "#dc2626" }}>Our team has requested more information before activating your account. Please check your email.</span>
                {infoRequiredMessage && (
                  <div style={{ marginTop: 6, padding: "6px 10px", background: "#fff", border: "1px solid #fca5a5", fontSize: 12.5, color: "#7f1d1d", lineHeight: 1.6 }}>
                    <strong>Message:</strong> {infoRequiredMessage}
                  </div>
                )}
              </div>
            </div>
          )}



          {/* ── SUSPENDED banner ── */}
          {userStatus === "SUSPENDED" && (
            <div style={{
              background: "#f3f4f6", borderBottom: "1px solid #d1d5db",
              padding: "10px 20px", display: "flex", alignItems: "flex-start",
              gap: 10, flexShrink: 0, flexWrap: "wrap" as const,
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                <circle cx="8" cy="8" r="7" stroke="#374151" strokeWidth="1.5"/>
                <path d="M8 5v3" stroke="#374151" strokeWidth="1.5" strokeLinecap="round"/>
                <circle cx="8" cy="11" r="0.75" fill="#374151"/>
              </svg>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Your account has been suspended. </span>
                <span style={{ fontSize: 12.5, color: "#374151" }}>Please contact our support team for assistance. You can still access your billing documents below.</span>
                {suspensionReason && (
                  <div style={{ marginTop: 6, padding: "6px 10px", background: "#fff", border: "1px solid #d1d5db", fontSize: 12.5, color: "#374151", lineHeight: 1.6 }}>
                    <strong>Reason:</strong> {suspensionReason}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scrollable area */}
          <main style={{ flex: 1, overflowY: "auto", position: "relative", zIndex: 0 }}>
            <div className="cy-page-content">
              {children}
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
