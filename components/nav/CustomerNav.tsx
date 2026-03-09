"use client";
// components/nav/CustomerNav.tsx

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { colors } from "@/lib/ui/tokens";

interface NavChild {
  id: string;
  label: string;
  icon: string;
  href: string;
  badge?: string;
  alert?: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  icon: string;
  href?: string;
  children?: NavChild[];
}

const NAV: NavGroup[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", href: "/dashboard" },
  {
    id: "myservices",
    label: "My Services",
    icon: "clock",
    children: [
      { id: "subscriptions", label: "Subscriptions",    icon: "services",  href: "/dashboard/subscriptions" },
      { id: "servers",       label: "My Servers",        icon: "server",    href: "/dashboard/servers" },
      { id: "catalogue",     label: "Service Catalogue", icon: "catalogue", href: "/dashboard/catalogue" },
      { id: "rfq",           label: "RFQ / Inquiries",   icon: "rfq",       href: "/dashboard/rfq" },
    ],
  },
  {
    id: "billing",
    label: "Billing",
    icon: "billing",
    children: [
      { id: "documents",  label: "Document Hub", icon: "documents",  href: "/dashboard/documents" },
      { id: "invoices",   label: "Invoices",     icon: "invoice",    href: "/dashboard/invoices" },
      { id: "statement",  label: "Statement",    icon: "statement",  href: "/dashboard/statement" },
      { id: "quotations", label: "Quotations",   icon: "quotations", href: "/dashboard/quotations" },
    ],
  },
  {
    id: "account",
    label: "Account",
    icon: "user",
    children: [
      { id: "profile",       label: "Profile & Settings", icon: "settings",      href: "/dashboard/profile" },
      { id: "notifications", label: "Notifications",      icon: "notifications", href: "/dashboard/notifications" },
    ],
  },
];

function Badge({ value, alert }: { value: string; alert?: boolean }) {
  if (!value || value === "0") return null;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "1px 7px",
      background: alert ? "#fee2e2" : "#f3f4f6",
      color: alert ? "#dc2626" : "#6b7280",
      border: `1px solid ${alert ? "#fca5a5" : "#e5e7eb"}`,
      flexShrink: 0,
    }}>{value}</span>
  );
}

function NavItem({ item, pathname }: { item: NavGroup; pathname: string }) {
  const hasChildren = !!(item.children?.length);
  const isLeaf = !hasChildren;

  const selfActive = isLeaf && item.href
    ? (pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href + "/")))
    : false;
  const childActive = hasChildren && item.children!.some(
    c => pathname === c.href || pathname.startsWith(c.href + "/")
  );
  const highlight = selfActive || childActive;

  const [open, setOpen] = useState(false);
  const isOpen = open || childActive;

  const iconColor = highlight ? colors.primary : colors.textFaint;

  const rowStyle: React.CSSProperties = {
    width: "100%",
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 16px",
    background: highlight ? colors.primaryLight : "transparent",
    borderLeft: `3px solid ${highlight ? colors.primary : "transparent"}`,
    border: "none",
    cursor: "pointer",
    textDecoration: "none",
    transition: "background 0.12s",
    color: "inherit",
  };

  if (isLeaf && item.href) {
    return (
      <Link href={item.href} style={rowStyle} className="cy-nav-item">
        <Icon name={item.icon} size={15} color={iconColor} />
        <span style={{
          flex: 1, fontSize: 13.5,
          fontWeight: highlight ? 500 : 400,
          color: highlight ? colors.primary : colors.textSecondary,
          whiteSpace: "nowrap",
        }}>{item.label}</span>
      </Link>
    );
  }

  return (
    <div>
      <button onClick={() => setOpen(v => !v)} style={rowStyle} className="cy-nav-item">
        <Icon name={item.icon} size={15} color={iconColor} />
        <span style={{
          flex: 1, textAlign: "left", fontSize: 13.5,
          fontWeight: highlight ? 500 : 400,
          color: highlight ? colors.primary : colors.textSecondary,
          whiteSpace: "nowrap",
        }}>{item.label}</span>
        <span style={{
          display: "flex", flexShrink: 0,
          transform: isOpen ? "rotate(90deg)" : "none",
          transition: "transform 0.2s",
        }}>
          <Icon name="chevron" size={13} color={colors.textFaint} />
        </span>
      </button>

      {isOpen && (
        <div style={{ borderLeft: `1px solid ${colors.border}`, marginLeft: 26 }}>
          {item.children!.map(child => {
            const ca = pathname === child.href || pathname.startsWith(child.href + "/");
            return (
              <Link key={child.id} href={child.href}
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "9px 16px 9px 14px",
                  background: ca ? colors.primaryLight : "transparent",
                  borderLeft: `3px solid ${ca ? colors.primary : "transparent"}`,
                  textDecoration: "none",
                  transition: "background 0.12s",
                }}
                className="cy-nav-child"
              >
                <Icon name={child.icon} size={14} color={ca ? colors.primary : colors.textFaint} />
                <span style={{
                  flex: 1, fontSize: 13.5,
                  fontWeight: ca ? 500 : 400,
                  color: ca ? colors.primary : colors.textSecondary,
                  whiteSpace: "nowrap",
                }}>{child.label}</span>
                {child.badge && <Badge value={child.badge} alert={child.alert} />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CustomerNavProps {
  userEmail: string;
  userName?: string | null;
  customerNumber?: string | null;
}

export function CustomerNav({ userEmail, userName, customerNumber }: CustomerNavProps) {
  const pathname = usePathname();
  const initials = (userName ?? userEmail)
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "CU";

  return (
    <aside style={{
      width: 240, minWidth: 240,
      display: "flex", flexDirection: "column",
      background: "#ffffff",
      borderRight: `1px solid ${colors.border}`,
      overflow: "hidden",
      height: "100vh",
      position: "sticky",
      top: 0,
    }}>
      {/* Logo */}
      <div style={{
        height: 56,
        display: "flex", alignItems: "center",
        padding: "0 18px",
        background: colors.headerBg,
        borderBottom: `1px solid ${colors.headerBorder}`,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em",
          background: "linear-gradient(to right, #5ec4b4, #80d8ca)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>Cybrosoft</span>
        <span style={{ fontSize: 12.5, color: "#4b5563", marginLeft: 7 }}>Console</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "6px 0 12px" }}>
        {NAV.map(item => (
          <NavItem key={item.id} item={item} pathname={pathname} />
        ))}
      </nav>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${colors.border}`, padding: "6px 0", flexShrink: 0 }}>
        {[
          { icon: "settings", label: "Settings", href: "/dashboard/profile" },
          { icon: "help",     label: "Get Help",  href: "#" },
        ].map(x => (
          <Link key={x.label} href={x.href}
            style={{
              display: "flex", alignItems: "center",
              padding: "9px 16px", gap: 10,
              textDecoration: "none",
            }}
            className="cy-nav-item"
          >
            <Icon name={x.icon} size={15} color={colors.textFaint} />
            <span style={{ fontSize: 13.5, color: colors.textMuted }}>{x.label}</span>
          </Link>
        ))}
      </div>

      {/* User */}
      <div style={{
        padding: "11px 14px",
        borderTop: `1px solid ${colors.border}`,
        display: "flex", alignItems: "center", gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 30, height: 30,
          background: colors.primary, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "#fff",
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userName ?? userEmail}
          </div>
          {customerNumber && (
            <div style={{ fontSize: 11, color: colors.textFaint }}>#{customerNumber}</div>
          )}
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" title="Logout" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>
            <Icon name="logout" size={14} color={colors.textFaint} />
          </button>
        </form>
      </div>
    </aside>
  );
}
