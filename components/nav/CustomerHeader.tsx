"use client";
// components/nav/CustomerHeader.tsx

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { colors } from "@/lib/ui/tokens";

export interface CustomerHeaderProps {
  userEmail?: string;
  userName?: string | null;
  companyName?: string | null;
  customerNumber?: string | null;
  onHamburgerClick?: () => void;
  drawerOpen?: boolean;
}

// Re-export so DashboardDrawer can import from one place
export type { CustomerHeaderProps as CustomerHeaderPropsType };

export function CustomerHeader({
  userEmail,
  userName,
  companyName,
  customerNumber,
  onHamburgerClick,
  drawerOpen,
}: CustomerHeaderProps) {
  const router = useRouter();
  const [lang, setLang] = useState<"EN" | "AR">("EN"); // kept, hidden until bilingual is ready
  const [accountOpen, setAccountOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  // Display name in button: company name preferred, fallback to personal name, then email
  const displayName = companyName || userName || userEmail || "Account";
  // Dropdown header primary line: company name or personal name
  const menuPrimaryName = companyName || userName || userEmail || "";

  return (
    <>
      <style>{`
        .cy-lang-toggle  { display: none; }
        .cy-account-label { display: inline; }

        /* Desktop header */
        .cy-customer-header-desktop {
          display: flex;
          height: 56px;
          background: #222222;
          flex-shrink: 0;
          align-items: center;
          padding: 0 12px;
          gap: 8px;
          border-bottom: 1px solid #2a2a2a;
          /* overflow must be visible so dropdown isn't clipped */
          overflow: visible;
          position: relative;
          /* high z-index so dropdown sits above sidebar and main content */
          z-index: 400;
          box-sizing: border-box;
          width: 100%;
        }

        /* Mobile topbar */
        .cy-customer-header-mobile {
          display: none;
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 300;
          height: 56px;
          background: #222222;
          border-bottom: 1px solid #2a2a2a;
          align-items: center;
          gap: 10px;
          padding: 0 14px;
          box-sizing: border-box;
          flex-shrink: 0;
          overflow: visible;
        }

        /* Account menu hidden on mobile — user accesses via sidebar footer */
        .cy-header-account { display: flex; }

        @media (max-width: 1023px) {
          .cy-customer-header-desktop { display: none !important; }
          .cy-customer-header-mobile  { display: flex !important; }
          .cy-account-label           { display: none; }
          .cy-header-account          { display: none !important; }
        }

        .cy-account-menu-item:hover        { background: #f3f4f6 !important; }
        .cy-account-menu-item-danger:hover { background: #fef2f2 !important; color: #dc2626 !important; }
      `}</style>

      {/* ── Desktop Header ───────────────────────────────────────────────────── */}
      <header className="cy-customer-header-desktop">

        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#2c2c2c", border: "1px solid #383838",
          padding: "0 12px", height: 34,
          flex: 1, minWidth: 0, maxWidth: 460,
          boxSizing: "border-box",
        }}>
          <Icon name="search" size={15} color="#6b7280" />
          <input
            placeholder="Search services, invoices…"
            style={{
              flex: 1, minWidth: 0, fontSize: 13, color: "#d1d5db",
              background: "none", border: "none", outline: "none", fontFamily: "inherit",
            }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }} />

        {/* Language toggle — hidden, kept for bilingual */}
        <div className="cy-lang-toggle">
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

        {/* Notifications */}
        <Link href="/dashboard/notifications" style={{
          position: "relative", width: 34, height: 34, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "none", border: "1px solid #383838", textDecoration: "none",
        }} aria-label="Notifications">
          <Icon name="bell" size={16} color="#9ca3af" />
          <span style={{
            position: "absolute", top: 6, right: 6,
            width: 6, height: 6, borderRadius: "50%",
            background: "#ef4444", border: "1.5px solid #222",
            display: "none", // set to "block" when unread
          }} />
        </Link>

        {/* Account menu — desktop only */}
        <div className="cy-header-account" style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setAccountOpen(v => !v)}
            title="My Account"
            style={{
              display: "flex", alignItems: "center", gap: 7,
              background: accountOpen ? "#2c2c2c" : "none",
              border: "1px solid #383838",
              padding: "0 10px 0 8px", height: 34,
              cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap",
            }}
          >
            {/* Account SVG icon — primary teal */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="9" cy="9" r="8" stroke={colors.primary} strokeWidth="1.4" />
              <circle cx="9" cy="7" r="2.5" stroke={colors.primary} strokeWidth="1.4" />
              <path d="M3.5 15c0-2.485 2.462-4.5 5.5-4.5s5.5 2.015 5.5 4.5"
                stroke={colors.primary} strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span className="cy-account-label" style={{
              fontSize: 13, fontWeight: 500, color: "#d1d5db",
              maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {displayName}
            </span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
              style={{ flexShrink: 0, opacity: 0.5, transition: "transform 0.2s", transform: accountOpen ? "rotate(180deg)" : "none" }}>
              <path d="M2 3.5l3 3 3-3" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Dropdown — positioned absolute, z-index above everything */}
          {accountOpen && (
            <>
              {/* Backdrop */}
              <div
                onClick={() => setAccountOpen(false)}
                style={{ position: "fixed", inset: 0, zIndex: 490 }}
              />

              <div style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                width: 240,
                background: "#fff",
                border: "1px solid #e5e7eb",
                boxShadow: "0 12px 32px rgba(0,0,0,0.15)",
                zIndex: 500,
                overflow: "hidden",
                borderRadius: 2,
              }}>
                {/* Menu header — company/name, email, customer ID */}
                <div style={{
                  padding: "13px 16px",
                  background: "#f9fafb",
                  borderBottom: "1px solid #e5e7eb",
                }}>
                  {/* Line 1: Company name (if exists) or personal name */}
                  <div style={{
                    fontSize: 13.5, fontWeight: 600, color: "#111827",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    marginBottom: 3,
                  }}>
                    {menuPrimaryName}
                  </div>

                  {/* Line 2: Email (only show if different from primary name) */}
                  {userEmail && userEmail !== menuPrimaryName && (
                    <div style={{
                      fontSize: 12, color: "#6b7280",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      marginBottom: 3,
                    }}>
                      {userEmail}
                    </div>
                  )}

                  {/* Line 3: Customer ID */}
                  {customerNumber && (
                    <div style={{
                      fontSize: 11, color: "#9ca3af",
                      fontFamily: "monospace",
                      marginTop: 1,
                    }}>
                      Customer ID: #{customerNumber}
                    </div>
                  )}
                </div>

                {/* Menu links */}
                {[
                  { icon: "user",          label: "Profile & Settings",    href: "/dashboard/profile" },
                  { icon: "notifications", label: "Notification Settings", href: "/dashboard/notifications" },
                  { icon: "statement",     label: "Statement",             href: "/dashboard/statement" },
                ].map(item => (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setAccountOpen(false)}
                    className="cy-account-menu-item"
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 16px", fontSize: 13, color: "#374151",
                      textDecoration: "none", transition: "background 0.12s",
                    }}
                  >
                    <Icon name={item.icon} size={14} color="#9ca3af" />
                    {item.label}
                  </Link>
                ))}

                <div style={{ height: 1, background: "#e5e7eb", margin: "4px 0" }} />

                <button
                  onClick={handleLogout}
                  className="cy-account-menu-item cy-account-menu-item-danger"
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 16px", fontSize: 13, color: "#374151",
                    background: "none", border: "none", cursor: "pointer",
                    textAlign: "left", transition: "background 0.12s", fontFamily: "inherit",
                  }}
                >
                  <Icon name="logout" size={14} color="#9ca3af" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── Mobile Topbar ────────────────────────────────────────────────────── */}
      <header className="cy-customer-header-mobile">

        <span style={{
          fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em",
          background: "linear-gradient(to right, #254b46, #318774)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          flexShrink: 0,
        }}>CC</span>

        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          background: "#2c2c2c", border: "1px solid #383838",
          padding: "0 12px", height: 34, minWidth: 0,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input placeholder="Search…" style={{
            flex: 1, minWidth: 0, fontSize: 13, color: "#d1d5db",
            background: "none", border: "none", outline: "none", fontFamily: "inherit",
          }} />
        </div>

        {/* Bell */}
        <Link href="/dashboard/notifications" style={{
          position: "relative", width: 34, height: 34, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "none", border: "1px solid #383838", textDecoration: "none",
        }} aria-label="Notifications">
          <Icon name="bell" size={16} color="#9ca3af" />
          <span style={{
            position: "absolute", top: 6, right: 6,
            width: 6, height: 6, borderRadius: "50%",
            background: "#ef4444", border: "1.5px solid #222", display: "none",
          }} />
        </Link>

        {/* Hamburger — rightmost */}
        <button
          onClick={onHamburgerClick}
          aria-label="Toggle navigation"
          style={{
            width: 34, height: 34, flexShrink: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 5,
            background: "none", border: "1px solid #383838",
            cursor: "pointer", padding: 0,
          }}
        >
          <span style={{ display: "block", width: 18, height: 2, background: "#d1d5db", transition: "all 0.2s", transform: drawerOpen ? "translateY(7px) rotate(45deg)" : "none" }} />
          <span style={{ display: "block", width: 18, height: 2, background: "#d1d5db", transition: "all 0.2s", opacity: drawerOpen ? 0 : 1 }} />
          <span style={{ display: "block", width: 18, height: 2, background: "#d1d5db", transition: "all 0.2s", transform: drawerOpen ? "translateY(-7px) rotate(-45deg)" : "none" }} />
        </button>
      </header>
    </>
  );
}
