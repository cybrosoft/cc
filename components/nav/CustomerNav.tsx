"use client";
// components/nav/CustomerNav.tsx

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { colors } from "@/lib/ui/tokens";

export interface BillingNavVisibility {
  hasIssuedPO: boolean;
  hasDeliveryNotes: boolean;
  hasProformaInvoices: boolean;
}

export interface CustomerNavProps {
  userEmail: string;
  userName?: string | null;
  companyName?: string | null;
  customerNumber?: string | null;
  billingVisibility?: BillingNavVisibility;
  drawerOpen: boolean;
  onDrawerClose: () => void;
  needsOnboarding?: boolean;
  userStatus?: string;
}

interface NavChild {
  id: string;
  label: string;
  icon: string;
  href: string;
  mobileOnly?: boolean;
  isLogout?: boolean;
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  href?: string;
  children?: NavChild[];
  alwaysAllowed?: boolean;
  activePaths?: string[];
}

// Maps ?from= param to child href
const FROM_MAP: Record<string, string> = {
  invoices:   "/dashboard/invoices",
  quotations: "/dashboard/quotations",
  po:         "/dashboard/po",
  proforma:   "/dashboard/proforma",
  dn:         "/dashboard/delivery-notes",
  statement:  "/dashboard/statement",
};

// ─── Nav Leaf ─────────────────────────────────────────────────────────────────
function NavLeaf({
  item, pathname, onLinkClick, locked,
}: {
  item: NavItem; pathname: string; onLinkClick?: () => void; locked?: boolean;
}) {
  const active =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

  const el = (
    <span
      className="cy-nav-item"
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px",
        background: active ? colors.primaryLight : "transparent",
        borderLeft: `3px solid ${active ? colors.primary : "transparent"}`,
        textDecoration: "none", transition: "background 0.12s",
        cursor: locked ? "not-allowed" : "pointer",
        opacity: locked ? 0.45 : 1,
      }}
    >
      <Icon name={item.icon} size={15} color={active ? colors.primary : colors.textFaint} />
      <span style={{
        flex: 1, fontSize: 13.5,
        fontWeight: active ? 500 : 400,
        color: active ? colors.primary : colors.textSecondary,
        whiteSpace: "nowrap",
      }}>
        {item.label}
      </span>
      {locked && <Icon name="lock" size={12} color={colors.textFaint} />}
    </span>
  );

  if (locked) return el;

  return (
    <Link href={item.href!} onClick={onLinkClick} className="cy-nav-item" style={{ display: "block", textDecoration: "none" }}>
      {el}
    </Link>
  );
}

// ─── Nav Group ────────────────────────────────────────────────────────────────
function NavGroup({
  item, pathname, onLinkClick, isMobile, locked, fromHref,
}: {
  item: NavItem; pathname: string; onLinkClick?: () => void; isMobile?: boolean; locked?: boolean; fromHref?: string;
}) {
  const router = useRouter();

  const visibleChildren = (item.children ?? []).filter(
    (c) => !c.mobileOnly || isMobile
  );

  const childActive =
    visibleChildren.some(
      (c) => !c.isLogout && (pathname === c.href || pathname.startsWith(c.href + "/"))
    ) ||
    (item.activePaths ?? []).some(p => pathname === p || pathname.startsWith(p + "/")) ||
    (!!fromHref && visibleChildren.some(c => c.href === fromHref));

  const [open, setOpen] = React.useState(childActive);
  const isOpen = open || childActive;
  const highlight = childActive;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div style={{ opacity: locked ? 0.45 : 1 }}>
      <button
        onClick={() => !locked && setOpen((v) => !v)}
        className="cy-nav-item"
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: highlight ? colors.primaryLight : "transparent",
          borderLeft: `3px solid ${highlight ? colors.primary : "transparent"}`,
          border: "none", borderTop: "none", borderRight: "none", borderBottom: "none",
          cursor: locked ? "not-allowed" : "pointer", transition: "background 0.12s",
        }}
      >
        <Icon name={item.icon} size={15} color={highlight ? colors.primary : colors.textFaint} />
        <span style={{
          flex: 1, textAlign: "left", fontSize: 13.5,
          fontWeight: highlight ? 500 : 400,
          color: highlight ? colors.primary : colors.textSecondary,
          whiteSpace: "nowrap",
        }}>
          {item.label}
        </span>
        {locked
          ? <Icon name="lock" size={12} color={colors.textFaint} />
          : (
            <span style={{ display: "flex", flexShrink: 0, transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>
              <Icon name="chevron" size={13} color={colors.textFaint} />
            </span>
          )
        }
      </button>

      {isOpen && !locked && (
        <div style={{ borderLeft: `1px solid ${colors.border}`, marginLeft: 26 }}>
          {visibleChildren.map((child) => {
            if (child.isLogout) {
              return (
                <button key={child.id} onClick={handleLogout} className="cy-nav-child"
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 9,
                    padding: "9px 16px 9px 14px", background: "transparent",
                    border: "none", borderLeft: "3px solid transparent", outline: "none",
                    cursor: "pointer", fontFamily: "inherit", transition: "background 0.12s",
                    boxSizing: "border-box" as const, textAlign: "left" as const,
                  }}
                >
                  <Icon name={child.icon} size={14} color={colors.textFaint} />
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 400, color: colors.textSecondary, whiteSpace: "nowrap" }}>
                    {child.label}
                  </span>
                </button>
              );
            }
            const ca = pathname === child.href || pathname.startsWith(child.href + "/") || (!!fromHref && child.href === fromHref);
            return (
              <Link key={child.id} href={child.href} onClick={onLinkClick} className="cy-nav-child"
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "9px 16px 9px 14px",
                  background: ca ? colors.primaryLight : "transparent",
                  borderLeft: `3px solid ${ca ? colors.primary : "transparent"}`,
                  textDecoration: "none", transition: "background 0.12s",
                }}
              >
                <Icon name={child.icon} size={14} color={ca ? colors.primary : colors.textFaint} />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: ca ? 500 : 400, color: ca ? colors.primary : colors.textSecondary, whiteSpace: "nowrap" }}>
                  {child.label}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar Content ──────────────────────────────────────────────────────────
function SidebarContent({
  userEmail, userName, companyName, customerNumber, initials,
  pathname, onLinkClick, billingVisibility, isMobile, needsOnboarding, userStatus,
}: {
  userEmail: string;
  userName?: string | null;
  companyName?: string | null;
  customerNumber?: string | null;
  initials: string;
  pathname: string;
  onLinkClick?: () => void;
  billingVisibility?: BillingNavVisibility;
  isMobile?: boolean;
  needsOnboarding?: boolean;
  userStatus?: string;
}) {
  const searchParams = useSearchParams();
  const fromParam    = searchParams?.get("from") ?? "";
  const fromHref     = FROM_MAP[fromParam] ?? undefined;

  const bv = billingVisibility ?? { hasIssuedPO: false, hasDeliveryNotes: false, hasProformaInvoices: false };

  const billingChildren: NavChild[] = [
    { id: "quotations", label: "Quotations",       icon: "quotations", href: "/dashboard/quotations" },
    ...(bv.hasIssuedPO         ? [{ id: "po",       label: "Issued PO",         icon: "po",       href: "/dashboard/po" }]             : []),
    ...(bv.hasDeliveryNotes    ? [{ id: "dn",       label: "Delivery Notes",    icon: "documents", href: "/dashboard/delivery-notes" }] : []),
    ...(bv.hasProformaInvoices ? [{ id: "proforma", label: "Proforma Invoices", icon: "invoice",  href: "/dashboard/proforma" }]       : []),
    { id: "invoices",  label: "Invoices",  icon: "invoice",   href: "/dashboard/invoices" },
    { id: "statement", label: "Statement", icon: "statement", href: "/dashboard/statement" },
  ];

  const NAV: NavItem[] = [
    { id: "dashboard",   label: "Dashboard",            icon: "dashboard",  href: "/dashboard" },
    { id: "compute",     label: "Compute Instances",    icon: "server",     href: "/dashboard/servers" },
    { id: "gpu",         label: "GPU Instances",        icon: "cpu",        href: "/dashboard/gpu" },
    { id: "storage",     label: "Storage",              icon: "hardDrive",  href: "/dashboard/storage" },
    { id: "backup",      label: "Backup",               icon: "backup",     href: "/dashboard/backup" },
    { id: "network",     label: "Network & Public IP",  icon: "link",       href: "/dashboard/network" },
    { id: "database",    label: "Database",             icon: "database",   href: "/dashboard/database" },
    { id: "multicloud",  label: "Hybrid & Multi Cloud", icon: "cloud",      href: "/dashboard/multicloud" },
    { id: "aai",         label: "Analytics & AI",       icon: "sales",      href: "/dashboard/aai" },
    { id: "email",       label: "Email & Productivity", icon: "mail",       href: "/dashboard/email" },
    { id: "security",    label: "Security",             icon: "lock",       href: "/dashboard/security" },
    { id: "domains",     label: "Domain & DNS",         icon: "globe",      href: "/dashboard/domains" },
    { id: "services",    label: "Other Services",       icon: "catalogue",  href: "/dashboard/services" },
    {
      id: "billing", label: "Billing", icon: "billing",
      children: billingChildren,
      activePaths: ["/dashboard/sales"],
    },
    {
      id: "account", label: "Account", icon: "user",
      alwaysAllowed: true,
      children: [
        { id: "profile",       label: "Profile & Settings",    icon: "settings",      href: "/dashboard/profile" },
        { id: "notifications", label: "Notification Settings", icon: "notifications", href: "/dashboard/notifications" },
        { id: "logout",        label: "Sign Out",              icon: "logout",        href: "#", mobileOnly: true, isLogout: true },
      ],
    },
  ];

  const footerPrimaryName = companyName || userName || userEmail;

  return (
    <>
      {/* Logo */}
      <div style={{
        height: 56, display: "flex", alignItems: "center", padding: "0 18px",
        background: colors.headerBg, borderBottom: `1px solid ${colors.headerBorder}`,
        borderRight: `1px solid #383838`, flexShrink: 0,
      }}>
        <span style={{
          fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em",
          background: "linear-gradient(to right, #254b46, #318774)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>Cybrosoft</span>
        <span style={{ fontSize: 12.5, color: "#4b5563", marginLeft: 7, marginTop: 5 }}>Console</span>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: "6px 0 12px", borderRight: `1px solid ${colors.border}` }}>
        {NAV.map((item) => {
          const locked = false;
          return item.href ? (
            <NavLeaf key={item.id} item={item} pathname={pathname} onLinkClick={onLinkClick} locked={locked} />
          ) : (
            <NavGroup key={item.id} item={item} pathname={pathname} onLinkClick={onLinkClick} isMobile={isMobile} locked={locked} fromHref={fromHref} />
          );
        })}
      </nav>

      {/* Bottom help link */}
      <div style={{ borderTop: `1px solid ${colors.border}`, padding: "6px 0", flexShrink: 0, borderRight: `1px solid ${colors.border}` }}>
        <Link href="mailto:support@cybrosoft.com" onClick={onLinkClick} className="cy-nav-item" style={{ display: "flex", alignItems: "center", padding: "9px 16px", gap: 10, textDecoration: "none" }}>
          <Icon name="help" size={15} color={colors.textFaint} />
          <span style={{ fontSize: 13.5, color: colors.textMuted }}>Get Help</span>
        </Link>
      </div>

      {/* User footer */}
      <div style={{
        padding: "11px 14px", borderTop: `1px solid ${colors.border}`,
        display: "flex", alignItems: "center", gap: 10,
        flexShrink: 0, borderRight: `1px solid ${colors.border}`,
      }}>
        <div style={{
          width: 30, height: 30, background: colors.primary, flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: "#fff",
        }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: colors.textPrimary ?? "#111827" }}>
            {footerPrimaryName}
          </div>
          {customerNumber && (
            <div style={{ fontSize: 11, color: colors.textFaint, fontFamily: "monospace" }}>
              Customer ID: #{customerNumber}
            </div>
          )}
        </div>
        <form action="/api/auth/logout" method="POST">
          <button type="submit" title="Sign out" style={{ background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4 }}>
            <Icon name="logout" size={14} color={colors.textFaint} />
          </button>
        </form>
      </div>
    </>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────
export function CustomerNav({
  userEmail, userName, companyName, customerNumber,
  billingVisibility, drawerOpen, onDrawerClose, needsOnboarding, userStatus,
}: CustomerNavProps) {
  const pathname = usePathname();

  useEffect(() => { onDrawerClose(); }, [pathname]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const initialsSource = companyName || userName || userEmail;
  const initials = initialsSource.split(/[\s@.]+/).slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "").join("").slice(0, 2) || "CU";

  const sharedProps = { userEmail, userName, companyName, customerNumber, initials, pathname, billingVisibility, needsOnboarding, userStatus };

  return (
    <>
      <style>{`
        .cy-sidebar-desktop { display: flex; }
        @media (max-width: 1023px) { .cy-sidebar-desktop { display: none !important; } }
        .cy-nav-item:hover  { background: ${colors.primaryLight} !important; }
        .cy-nav-child:hover { background: ${colors.primaryLight} !important; }
      `}</style>

      {/* Desktop sidebar */}
      <aside key="desktop" className="cy-sidebar-desktop" style={{
        width: 240, minWidth: 240, flexDirection: "column",
        background: "#ffffff", overflow: "hidden", height: "100vh", position: "sticky", top: 0,
      }}>
        <SidebarContent {...sharedProps} onLinkClick={() => {}} isMobile={false} />
      </aside>

      {/* Mobile backdrop */}
      {drawerOpen && (
        <div onClick={onDrawerClose} style={{ position: "fixed", inset: 0, zIndex: 250, background: "rgba(0,0,0,0.5)" }} />
      )}

      {/* Mobile drawer */}
      <aside key="mobile" style={{
        position: "fixed", top: 0, left: 0, zIndex: 260,
        width: 260, height: "100vh", display: "flex", flexDirection: "column",
        background: "#ffffff",
        transform: drawerOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: drawerOpen ? "4px 0 24px rgba(0,0,0,0.18)" : "none",
        overflow: "hidden",
      }}>
        <SidebarContent {...sharedProps} onLinkClick={onDrawerClose} isMobile={true} />
      </aside>
    </>
  );
}