"use client";
// components/nav/CustomerNav.tsx

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
}

// ─── Nav Leaf ─────────────────────────────────────────────────────────────────
function NavLeaf({
  item,
  pathname,
  onLinkClick,
}: {
  item: NavItem;
  pathname: string;
  onLinkClick?: () => void;
}) {
  const active =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname.startsWith(item.href + "/"));

  return (
    <Link
      href={item.href!}
      onClick={onLinkClick}
      className="cy-nav-item"
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "10px 16px",
        background: active ? colors.primaryLight : "transparent",
        borderLeft: `3px solid ${active ? colors.primary : "transparent"}`,
        textDecoration: "none", transition: "background 0.12s",
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
    </Link>
  );
}

// ─── Nav Group ────────────────────────────────────────────────────────────────
function NavGroup({
  item,
  pathname,
  onLinkClick,
  isMobile,
}: {
  item: NavItem;
  pathname: string;
  onLinkClick?: () => void;
  isMobile?: boolean;
}) {
  const router = useRouter();

  const visibleChildren = (item.children ?? []).filter(
    (c) => !c.mobileOnly || isMobile
  );

  const childActive = visibleChildren.some(
    (c) => !c.isLogout && (pathname === c.href || pathname.startsWith(c.href + "/"))
  );
  const [open, setOpen] = React.useState(childActive);
  const isOpen = open || childActive;
  const highlight = childActive;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="cy-nav-item"
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          padding: "10px 16px",
          background: highlight ? colors.primaryLight : "transparent",
          borderLeft: `3px solid ${highlight ? colors.primary : "transparent"}`,
          border: "none", borderTop: "none", borderRight: "none", borderBottom: "none",
          cursor: "pointer", transition: "background 0.12s",
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
          {visibleChildren.map((child) => {
            // Logout item — button styled identically to Link child items
            if (child.isLogout) {
              return (
                <button
                  key={child.id}
                  onClick={handleLogout}
                  className="cy-nav-child"
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 9,
                    padding: "9px 16px 9px 14px",
                    background: "transparent",
                    border: "none",
                    borderLeft: "3px solid transparent",
                    outline: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "background 0.12s",
                    boxSizing: "border-box" as const,
                    textAlign: "left" as const,
                  }}
                >
                  <Icon name={child.icon} size={14} color={colors.textFaint} />
                  <span style={{
                    flex: 1, fontSize: 13.5, fontWeight: 400,
                    color: colors.textSecondary, whiteSpace: "nowrap",
                  }}>
                    {child.label}
                  </span>
                </button>
              );
            }

            const ca = pathname === child.href || pathname.startsWith(child.href + "/");
            return (
              <Link
                key={child.id}
                href={child.href}
                onClick={onLinkClick}
                className="cy-nav-child"
                style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "9px 16px 9px 14px",
                  background: ca ? colors.primaryLight : "transparent",
                  borderLeft: `3px solid ${ca ? colors.primary : "transparent"}`,
                  textDecoration: "none", transition: "background 0.12s",
                }}
              >
                <Icon name={child.icon} size={14} color={ca ? colors.primary : colors.textFaint} />
                <span style={{
                  flex: 1, fontSize: 13.5,
                  fontWeight: ca ? 500 : 400,
                  color: ca ? colors.primary : colors.textSecondary,
                  whiteSpace: "nowrap",
                }}>
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
  pathname, onLinkClick, billingVisibility, isMobile,
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
}) {
  const bv = billingVisibility ?? {
    hasIssuedPO: false,
    hasDeliveryNotes: false,
    hasProformaInvoices: false,
  };

  const billingChildren: NavChild[] = [
    { id: "quotations", label: "Quotations",        icon: "quotations", href: "/dashboard/quotations" },
    ...(bv.hasIssuedPO         ? [{ id: "po",       label: "Issued PO",          icon: "po",        href: "/dashboard/po" }]              : []),
    ...(bv.hasDeliveryNotes    ? [{ id: "dn",       label: "Delivery Notes",     icon: "documents",  href: "/dashboard/delivery-notes" }]  : []),
    ...(bv.hasProformaInvoices ? [{ id: "proforma", label: "Proforma Invoices",  icon: "invoice",   href: "/dashboard/proforma" }]        : []),
    { id: "invoices",   label: "Invoices",           icon: "invoice",   href: "/dashboard/invoices" },
    { id: "statement",  label: "Statement",          icon: "statement", href: "/dashboard/statement" },
  ];

  const NAV: NavItem[] = [
    { id: "dashboard",     label: "Dashboard",     icon: "dashboard", href: "/dashboard" },
    { id: "subscriptions", label: "Subscriptions", icon: "services",  href: "/dashboard/subscriptions" },
    { id: "servers",       label: "Servers",        icon: "server",    href: "/dashboard/servers" },
    {
      id: "services", label: "Services", icon: "catalogue",
      children: [
        { id: "catalogue", label: "Service Catalogue", icon: "catalogue", href: "/dashboard/catalogue" },
        { id: "rfq",       label: "RFQ / Inquiries",   icon: "rfq",       href: "/dashboard/rfq" },
      ],
    },
    {
      id: "billing", label: "Billing", icon: "billing",
      children: billingChildren,
    },
    {
      id: "account", label: "Account", icon: "user",
      children: [
        { id: "profile",       label: "Profile & Settings",    icon: "settings",      href: "/dashboard/profile" },
        { id: "notifications", label: "Notification Settings", icon: "notifications", href: "/dashboard/notifications" },
        // Mobile-only logout item
        {
          id: "logout", label: "Sign Out", icon: "logout",
          href: "#", mobileOnly: true, isLogout: true,
        },
      ],
    },
  ];

  // Footer display: company name preferred, else personal name, else email
  const footerPrimaryName = companyName || userName || userEmail;

  return (
    <>
      {/* Logo */}
      <div style={{
        height: 56, display: "flex", alignItems: "center", padding: "0 18px",
        background: colors.headerBg,
        borderBottom: `1px solid ${colors.headerBorder}`,
        borderRight: `1px solid #383838`,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em",
          background: "linear-gradient(to right, #254b46, #318774)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Cybrosoft
        </span>
        <span style={{ fontSize: 12.5, color: "#4b5563", marginLeft: 7, marginTop: 5 }}>
          Console
        </span>
      </div>

      {/* Nav */}
      <nav style={{
        flex: 1, overflowY: "auto", padding: "6px 0 12px",
        borderRight: `1px solid ${colors.border}`,
      }}>
        {NAV.map((item) =>
          item.href ? (
            <NavLeaf key={item.id} item={item} pathname={pathname} onLinkClick={onLinkClick} />
          ) : (
            <NavGroup
              key={item.id}
              item={item}
              pathname={pathname}
              onLinkClick={onLinkClick}
              isMobile={isMobile}
            />
          )
        )}
      </nav>

      {/* Bottom help link */}
      <div style={{
        borderTop: `1px solid ${colors.border}`,
        padding: "6px 0", flexShrink: 0,
        borderRight: `1px solid ${colors.border}`,
      }}>
        <Link href="#" onClick={onLinkClick} className="cy-nav-item" style={{
          display: "flex", alignItems: "center", padding: "9px 16px", gap: 10, textDecoration: "none",
        }}>
          <Icon name="help" size={15} color={colors.textFaint} />
          <span style={{ fontSize: 13.5, color: colors.textMuted }}>Get Help</span>
        </Link>
      </div>

      {/* User footer */}
      <div style={{
        padding: "11px 14px",
        borderTop: `1px solid ${colors.border}`,
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
          {/* Line 1: Company name or personal name */}
          <div style={{
            fontSize: 13, fontWeight: 600,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            color: colors.textPrimary ?? "#111827",
          }}>
            {footerPrimaryName}
          </div>
          {/* Line 2: Customer ID */}
          {customerNumber && (
            <div style={{ fontSize: 11, color: colors.textFaint, fontFamily: "monospace" }}>
              Customer ID: #{customerNumber}
            </div>
          )}
        </div>
        {/* Desktop logout button in footer */}
        <form action="/api/auth/logout" method="POST">
          <button type="submit" title="Sign out" style={{
            background: "none", border: "none", cursor: "pointer", display: "flex", padding: 4,
          }}>
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
  billingVisibility, drawerOpen, onDrawerClose,
}: CustomerNavProps) {
  const pathname = usePathname();

  useEffect(() => { onDrawerClose(); }, [pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  // Initials from company name preferred, else personal name, else email
  const initialsSource = companyName || userName || userEmail;
  const initials = initialsSource
    .split(/[\s@.]+/).slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("").slice(0, 2) || "CU";

  const sharedProps = { userEmail, userName, companyName, customerNumber, initials, pathname, billingVisibility };

  return (
    <>
      <style>{`
        .cy-sidebar-desktop { display: flex; }
        @media (max-width: 1023px) {
          .cy-sidebar-desktop { display: none !important; }
        }
        .cy-nav-item:hover  { background: ${colors.primaryLight} !important; }
        .cy-nav-child:hover { background: ${colors.primaryLight} !important; }
      `}</style>

      {/* Desktop sidebar */}
      <aside className="cy-sidebar-desktop" style={{
        width: 240, minWidth: 240, flexDirection: "column",
        background: "#ffffff", overflow: "hidden",
        height: "100vh", position: "sticky", top: 0,
      }}>
        <SidebarContent {...sharedProps} onLinkClick={() => {}} isMobile={false} />
      </aside>

      {/* Mobile backdrop */}
      {drawerOpen && (
        <div onClick={onDrawerClose} style={{
          position: "fixed", inset: 0, zIndex: 250, background: "rgba(0,0,0,0.5)",
        }} />
      )}

      {/* Mobile drawer */}
      <aside style={{
        position: "fixed", top: 0, left: 0, zIndex: 260,
        width: 260, height: "100vh",
        display: "flex", flexDirection: "column",
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