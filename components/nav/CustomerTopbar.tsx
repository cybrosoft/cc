"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface TopbarUser {
  id: string;
  email: string;
  name?: string | null;
  customerNumber?: string | null;
  market?: string | null;
}

interface CustomerTopbarProps {
  user: TopbarUser;
}

export function CustomerTopbar({ user }: CustomerTopbarProps) {
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const displayName = user.name || user.email;
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="topbar">
      {/* Logo */}
      <Link href="/dashboard" className="topbar-logo">
        <div className="topbar-logo-mark">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <rect width="22" height="22" rx="5" fill="#318774" />
            <path
              d="M5 11C5 7.686 7.686 5 11 5s6 2.686 6 6-2.686 6-6 6-6-2.686-6-6z"
              fill="none"
              stroke="white"
              strokeWidth="2"
            />
            <circle cx="11" cy="11" r="2.5" fill="white" />
          </svg>
        </div>
        <span className="topbar-logo-text">Cybrosoft</span>
        <span className="topbar-logo-badge">Cloud</span>
      </Link>

      <div className="topbar-spacer" />

      {/* Right side actions */}
      <div className="topbar-actions">
        {/* Buy Service */}
        <Link href="/customer/subscribe" className="topbar-action-btn topbar-buy-btn">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>New Service</span>
        </Link>

        {/* Notifications */}
        <Link href="/dashboard/notifications" className="topbar-icon-btn" aria-label="Notifications">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 1.5A5.25 5.25 0 003.75 6.75c0 3-1.5 4.5-1.5 4.5h13.5s-1.5-1.5-1.5-4.5A5.25 5.25 0 009 1.5z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M10.294 15.75a1.5 1.5 0 01-2.588 0"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {/* Notification dot — shown conditionally via CSS class when there are unread */}
          <span className="notif-dot" aria-hidden="true" />
        </Link>

        {/* User menu */}
        <div className="topbar-user-wrap">
          <button
            className="topbar-user-btn"
            onClick={() => setUserMenuOpen((v) => !v)}
            aria-haspopup="true"
            aria-expanded={userMenuOpen}
          >
            <div className="topbar-avatar">{initials}</div>
            <div className="topbar-user-info">
              <span className="topbar-user-name">{displayName}</span>
              {user.customerNumber && (
                <span className="topbar-user-num">{user.customerNumber}</span>
              )}
            </div>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              style={{ opacity: 0.5 }}
            >
              <path
                d="M2 4l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {userMenuOpen && (
            <>
              <div
                className="topbar-backdrop"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="topbar-menu">
                <div className="topbar-menu-header">
                  <div className="topbar-menu-email">{user.email}</div>
                  {user.market && (
                    <div className="topbar-menu-market">
                      {user.market === "saudi" ? "Saudi Arabia · SAR" : "Global · USD"}
                    </div>
                  )}
                </div>
                <div className="topbar-menu-divider" />
                <Link
                  href="/dashboard/profile"
                  className="topbar-menu-item"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="4.5" r="2.5" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M1.5 12.5c0-3.038 2.462-5.5 5.5-5.5s5.5 2.462 5.5 5.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  Profile & Settings
                </Link>
                <Link
                  href="/dashboard/notifications"
                  className="topbar-menu-item"
                  onClick={() => setUserMenuOpen(false)}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 1A4.083 4.083 0 002.917 5.083c0 2.334-1.167 3.5-1.167 3.5h10.5s-1.167-1.166-1.167-3.5A4.083 4.083 0 007 1z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M8.008 12.25a1.167 1.167 0 01-2.016 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                  Notifications
                </Link>
                <div className="topbar-menu-divider" />
                <button
                  className="topbar-menu-item topbar-menu-logout"
                  onClick={handleLogout}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5.25 12.25H2.917A1.167 1.167 0 011.75 11.083V2.917A1.167 1.167 0 012.917 1.75H5.25M9.333 9.917L12.25 7l-2.917-2.917M12.25 7H5.25" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
