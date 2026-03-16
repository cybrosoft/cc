"use client";
// components/nav/AdminNav.tsx

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { colors } from "@/lib/ui/tokens";
import { Bell } from "@/components/nav/AdminHeader";

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
  badge?: string;
  alert?: boolean;
  exactMatch?: boolean;
}

const NAV: NavGroup[] = [
  { id: "dashboard", label: "Dashboard", icon: "dashboard", href: "/admin", exactMatch: true },
  {
    id: "catalog", label: "Catalog", icon: "catalog",
    children: [
      { id: "categories", label: "Categories",  icon: "category",  href: "/admin/catalog/categories" },
      { id: "tags",       label: "Tags",         icon: "tag",       href: "/admin/catalog/tags" },
      { id: "products",   label: "Products",     icon: "product",   href: "/admin/catalog/products" },
      { id: "pricing",    label: "Pricing",      icon: "pricing",   href: "/admin/catalog/pricing" },
      { id: "locations",  label: "Locations",    icon: "location",  href: "/admin/catalog/locations" },
      { id: "templates",  label: "OS Templates", icon: "template",  href: "/admin/catalog/templates" },
    ],
  },
  {
    id: "sales", label: "Sales", icon: "sales",
    children: [
      { id: "rfq",      label: "RFQ Received",     icon: "rfq",      href: "/admin/sales/rfq",               badge: "0", alert: true },
      { id: "quotes",   label: "Quotations",        icon: "quote",    href: "/admin/sales/quotations" },
      { id: "po",       label: "Issued PO",         icon: "po",       href: "/admin/sales/po" },
      { id: "dn",       label: "Delivery Notes",    icon: "delivery", href: "/admin/sales/delivery-notes" },
      { id: "proforma", label: "Proforma Invoices", icon: "proforma", href: "/admin/sales/proforma" },
      { id: "invoices", label: "Invoices",          icon: "invoice",  href: "/admin/sales/invoices" },
      { id: "returns",  label: "Invoice Returns",   icon: "returns",  href: "/admin/sales/returns" },
      { id: "billing",  label: "Billing",           icon: "billing",  href: "/admin/sales/billing" },
    ],
  },
  {
    id: "management", label: "Management", icon: "management",
    children: [
      { id: "customers",     label: "Customers",     icon: "customers",     href: "/admin/customers" },
      { id: "subscriptions", label: "Subscriptions", icon: "subscriptions", href: "/admin/subscriptions" },
      { id: "servers",       label: "Servers",       icon: "server",        href: "/admin/servers" },
    ],
  },
  {
    id: "system", label: "System", icon: "system",
    children: [
      { id: "pages",         label: "Pages CMS",     icon: "pages",    href: "/admin/system/pages" },
      { id: "notifications", label: "Notifications", icon: "bell",     href: "/admin/system/notifications" },
      { id: "settings",      label: "Administrator", icon: "settings", href: "/admin/system/settings" },
    ],
  },
];

function isActive(pathname: string, href: string, exactMatch?: boolean): boolean {
  if (exactMatch) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

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

function NavItem({ item, pathname, onLinkClick, openGroup, setOpenGroup }: {
  item: NavGroup; pathname: string; onLinkClick?: () => void;
  openGroup?: string | null; setOpenGroup?: (id: string | null) => void;
}) {
  const hasChildren = !!(item.children?.length);
  const isLeaf      = !hasChildren;
  const selfActive  = isLeaf && !!item.href && isActive(pathname, item.href, item.exactMatch);
  const childActive = hasChildren && item.children!.some(c => isActive(pathname, c.href));
  const highlight   = selfActive || childActive;
  const isOpen      = openGroup === item.id;

  const bgColor = highlight
    ? colors.primaryLight
    : isOpen && !childActive
      ? "#f3f4f6"
      : "transparent";

  const rowStyle: React.CSSProperties = {
    width: "100%", display: "flex", alignItems: "center", gap: 10,
    padding: "10px 16px",
    background: bgColor,
    borderLeft: `3px solid ${highlight ? colors.primary : "transparent"}`,
    borderTop: "none", borderRight: "none", borderBottom: "none",
    cursor: "pointer", textDecoration: "none",
    transition: "background 0.12s",
  };
  const labelStyle: React.CSSProperties = {
    flex: 1, textAlign: "left", fontSize: 13.5,
    fontWeight: highlight ? 500 : 400,
    color: highlight ? colors.primary : colors.textSecondary,
    whiteSpace: "nowrap",
  };
  const iconColor = highlight ? colors.primary : colors.textFaint;

  if (isLeaf && item.href) {
    return (
      <Link href={item.href} style={rowStyle} className="cy-nav-item" onClick={onLinkClick}>
        <Icon name={item.icon} size={15} color={iconColor} />
        <span style={labelStyle}>{item.label}</span>
        {item.badge && <Badge value={item.badge} alert={item.alert} />}
      </Link>
    );
  }

  return (
    <div>
      <button onClick={() => setOpenGroup?.(isOpen ? null : item.id)} style={rowStyle} className="cy-nav-item">
        <Icon name={item.icon} size={15} color={iconColor} />
        <span style={labelStyle}>{item.label}</span>
        {item.badge && <Badge value={item.badge} alert={item.alert} />}
        <span style={{ display: "flex", flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
          <Icon name="chevron" size={13} color={colors.textFaint} />
        </span>
      </button>
      <div style={{
        display: "grid",
        gridTemplateRows: isOpen ? "1fr" : "0fr",
        transition: "grid-template-rows 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        <div style={{ overflow: "hidden" }}>
          <div style={{ borderLeft: `1px solid ${colors.border}`, marginLeft: 26 }}>
            {item.children!.map(child => {
              const ca = isActive(pathname, child.href);
              return (
                <Link key={child.id} href={child.href} onClick={onLinkClick}
                  style={{
                    display: "flex", alignItems: "center", gap: 9,
                    padding: "9px 16px 9px 14px",
                    background: ca ? colors.primaryLight : "transparent",
                    borderLeft: `3px solid ${ca ? colors.primary : "transparent"}`,
                    textDecoration: "none", transition: "background 0.12s",
                  }}
                  className="cy-nav-child"
                >
                  <Icon name={child.icon} size={14} color={ca ? colors.primary : colors.textFaint} />
                  <span style={{
                    flex: 1, fontSize: 13.5, fontWeight: ca ? 500 : 400,
                    color: ca ? colors.primary : colors.textSecondary, whiteSpace: "nowrap",
                  }}>{child.label}</span>
                  {child.badge && <Badge value={child.badge} alert={child.alert} />}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarContent({ userEmail, userName, initials, pathname, onLinkClick }: {
  userEmail: string; userName?: string | null; initials: string;
  pathname: string; onLinkClick?: () => void;
}) {
  const defaultOpen = NAV.find(item =>
    item.children?.some(c => isActive(pathname, c.href))
  )?.id ?? null;
  const [openGroup, setOpenGroup] = useState<string | null>(defaultOpen);

  return (
    <>
      {/* Logo */}
      <div style={{
        height: 56, display: "flex", alignItems: "center", padding: "0 18px",
        background: colors.headerBg, borderBottom: `1px solid ${colors.headerBorder}`, borderRight: `1px solid #383838`, flexShrink: 0,
      }}>
        <span style={{
          fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em",
          background: "linear-gradient(to right, #254b46, #318774)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>Cybrosoft</span>
        <span style={{ fontSize: 12.5, color: "#4b5563", marginLeft: 7, marginTop: 5 }}>Console</span>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "6px 0 12px", borderRight: `1px solid ${colors.border}` }}>
        {NAV.map(item => (
          <NavItem
            key={item.id} item={item} pathname={pathname} onLinkClick={onLinkClick}
            openGroup={openGroup} setOpenGroup={setOpenGroup}
          />
        ))}
      </nav>

      {/* Footer links */}
      <div style={{ borderTop: `1px solid ${colors.border}`, padding: "6px 0", flexShrink: 0, borderRight: `1px solid ${colors.border}` }}>
        {[
          { icon: "settings", label: "Settings", href: "/admin/system/settings" },
          { icon: "help",     label: "Get Help",  href: "#" },
          { icon: "search",   label: "Search",    href: "#" },
        ].map(x => (
          <Link key={x.label} href={x.href} onClick={onLinkClick}
            style={{ display: "flex", alignItems: "center", padding: "9px 16px", gap: 10, textDecoration: "none", color: "inherit" }}
            className="cy-nav-item"
          >
            <Icon name={x.icon} size={15} color={colors.textFaint} />
            <span style={{ fontSize: 13.5, color: colors.textMuted }}>{x.label}</span>
          </Link>
        ))}
      </div>

      {/* User row */}
      <div style={{
        padding: "11px 14px", borderTop: `1px solid ${colors.border}`,
        display: "flex", alignItems: "center", gap: 10, flexShrink: 0, borderRight: `1px solid ${colors.border}`
      }}>
        <div style={{
          width: 30, height: 30, background: colors.primary, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "#fff",
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userName ?? "Admin"}
          </div>
          <div style={{ fontSize: 11, color: colors.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {userEmail}
          </div>
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" title="Logout" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>
            <Icon name="logout" size={14} color={colors.textFaint} />
          </button>
        </form>
      </div>
    </>
  );
}

export interface AdminNavProps {
  userEmail: string;
  userName?: string | null;
}

export function AdminNav({ userEmail, userName }: AdminNavProps) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const initials = (userName ?? userEmail)
    .split(/[\s@.]+/).slice(0, 2)
    .map(s => s[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "AD";

  return (
    <>
      <style>{`
        .cy-sidebar-desktop { display: flex; }
        .cy-hamburger-btn   { display: none; }
        .cy-mobile-topbar   { display: none; }
        .cy-desktop-topbar  { display: flex; }

        @media (max-width: 1023px) {
          .cy-sidebar-desktop { display: none !important; }
          .cy-hamburger-btn   { display: none !important; }
          .cy-mobile-topbar   { display: flex !important; }
          .cy-desktop-topbar  { display: none !important; }
        }
      `}</style>

      {/* Desktop sidebar */}
      <aside className="cy-sidebar-desktop" style={{
        width: 240, minWidth: 240, flexDirection: "column",
        background: "#ffffff", overflow: "hidden",
        height: "100vh", position: "sticky", top: 0,
      }}>
        <SidebarContent userEmail={userEmail} userName={userName} initials={initials} pathname={pathname} onLinkClick={() => {}} />
      </aside>

      {/* Mobile topbar */}
      <header className="cy-mobile-topbar" style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 300,
        height: 56, minHeight: 56, background: "#222222",
        borderBottom: "1px solid #2a2a2a",
        alignItems: "center", gap: 10, padding: "0 14px",
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em",
          background: "linear-gradient(to right, #254b46, #318774)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>CC</span>

        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 8,
          background: "#2c2c2c", border: "1px solid #383838",
          padding: "0 12px", height: 34,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input style={{
            flex: 1, fontSize: 13, color: "#d1d5db", background: "none",
            border: "none", outline: "none", fontFamily: "inherit",
          }} placeholder="Search…" />
        </div>

        <Bell />

        <button
          onClick={() => setDrawerOpen(v => !v)}
          aria-label="Toggle navigation"
          style={{
            width: 34, height: 34, flexShrink: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
            background: "none", border: "1px solid #383838", cursor: "pointer", padding: 0,
          }}>
          <span style={{ display: "block", width: 18, height: 2, background: "#d1d5db", transition: "all 0.2s", transform: drawerOpen ? "translateY(7px) rotate(45deg)" : "none" }} />
          <span style={{ display: "block", width: 18, height: 2, background: "#d1d5db", transition: "all 0.2s", opacity: drawerOpen ? 0 : 1 }} />
          <span style={{ display: "block", width: 18, height: 2, background: "#d1d5db", transition: "all 0.2s", transform: drawerOpen ? "translateY(-7px) rotate(-45deg)" : "none" }} />
        </button>
      </header>

      <div className="cy-mobile-spacer" />

      {drawerOpen && <div onClick={() => setDrawerOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 350, background: "rgba(0,0,0,0.5)" }} />}

      {/* Mobile drawer */}
      <aside style={{
        position: "fixed", top: 0, left: 0, zIndex: 400,
        width: 260, height: "100vh", display: "flex", flexDirection: "column",
        background: "#ffffff",
        transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: drawerOpen ? "4px 0 24px rgba(0,0,0,0.18)" : "none",
        overflow: "hidden",
      }}>
        <SidebarContent userEmail={userEmail} userName={userName} initials={initials} pathname={pathname} onLinkClick={() => setDrawerOpen(false)} />
      </aside>
    </>
  );
}