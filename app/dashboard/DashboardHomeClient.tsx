"use client";
// app/dashboard/DashboardHomeClient.tsx

import { useState, useEffect } from "react";
import Link from "next/link";
import { colors } from "@/lib/ui/tokens";
import { useActionGuard } from "@/lib/auth/action-guard";

const LIMIT = {
  servers:  { lg: 6, sm: 4 },
  subs:     { lg: 6, sm: 4 },
  activity: { lg: 4, sm: 3 },
  notifs:   { lg: 4, sm: 3 },
};

interface DashboardUser {
  id: string; email: string; name?: string | null; companyName?: string | null;
  customerNumber?: string | null; market?: string | null; currency?: string | null;
  customerGroup?: string | null; userStatus?: string;
}
interface Stats {
  activeSubscriptions: number; pendingInvoices: number; overdueInvoices: number;
  expiringSubscriptions: number; servers: number;
}
interface ServerRow {
  id: string; provider: string; productName: string; productKey: string | null;
  subscriptionId: string | null; ipv4: string | null; status: string | null;
  location: string | null; vcpus: number | null; ramGb: number | null; diskGb: number | null;
  hetznerServerId?: string | null; oracleInstanceId?: string | null; createdAt: string;
}
interface SubRow {
  id: string; productName: string; productType: string; billingPeriod: string;
  status: string; paymentStatus: string;
  currentPeriodStart: string | null; currentPeriodEnd: string | null; createdAt: string;
}
interface ActivityRow {
  id: string; docNumber: string; type: string; status: string;
  totalAmount?: number; currency?: string; createdAt: string; href: string;
}
interface NotifRow {
  id: string; title: string; body: string; link: string | null;
  isRead: boolean; type: string; createdAt: string;
}

const REGION_COLOR: Record<string, string> = {
  me: "#16a34a", eu: "#2563eb", ap: "#7c3aed", am: "#0891b2",
};
const MAP_REGIONS = [
  { key: "me", label: "Middle East & Africa", cities: [
    { city: "Jeddah", country: "Saudi Arabia" }, { city: "Riyadh", country: "Saudi Arabia" },
    { city: "Dubai", country: "UAE" }, { city: "Doha", country: "Qatar" },
    { city: "Bahrain", country: "Bahrain" }, { city: "Cape Town", country: "South Africa" },
  ]},
  { key: "eu", label: "Europe", cities: [
    { city: "London", country: "UK" }, { city: "Amsterdam", country: "Netherlands" },
    { city: "Paris", country: "France" }, { city: "Madrid", country: "Spain" },
    { city: "Stockholm", country: "Sweden" }, { city: "Frankfurt", country: "Germany" },
    { city: "Nuremberg", country: "Germany" }, { city: "Falkenstein", country: "Germany" },
    { city: "Helsinki", country: "Finland" },
  ]},
  { key: "ap", label: "Asia Pacific", cities: [
    { city: "Mumbai", country: "India" }, { city: "Chennai", country: "India" },
    { city: "Singapore", country: "Singapore" }, { city: "Tokyo", country: "Japan" },
    { city: "Seoul", country: "South Korea" }, { city: "Sydney", country: "Australia" },
    { city: "Melbourne", country: "Australia" },
  ]},
  { key: "am", label: "Americas", cities: [
    { city: "Virginia", country: "USA" }, { city: "Arizona", country: "USA" },
    { city: "California", country: "USA" }, { city: "Toronto", country: "Canada" },
    { city: "São Paulo", country: "Brazil" },
  ]},
];

const DOC_LABELS: Record<string, string> = {
  INVOICE: "Invoice", QUOTATION: "Quotation", PO: "Purchase Order",
  DELIVERY_NOTE: "Delivery Note", PROFORMA: "Proforma", CREDIT_NOTE: "Credit Note", RFQ: "RFQ",
};

function fmt(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
}
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
function fmtDate(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function fmtDateShort(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusText({ status, size = 12 }: { status: string; size?: number }) {
  const colorMap: Record<string, string> = {
    ACTIVE: colors.primary, PAID: colors.primary,
    PENDING_PAYMENT: "#b45309", UNPAID: "#b45309", PROCESSING: "#b45309",
    OVERDUE: "#dc2626", EXPIRED: "#6b7280", CANCELED: "#6b7280", SUSPENDED: "#dc2626",
    ISSUED: "#374151", SENT: "#374151", DRAFT: "#9ca3af",
    running: colors.primary, RUNNING: colors.primary,
    stopped: "#6b7280", off: "#dc2626", UNKNOWN: "#6b7280",
  };
  return (
    <span style={{ fontSize: size, fontWeight: 600, color: colorMap[status] ?? "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Skeleton({ w = "100%", h = 13 }: { w?: string | number; h?: number }) {
  return <span className="cy-shimmer" style={{ width: w, height: h }} />;
}

function SectionHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: "#111827" }}>{title}</h2>
      {href && <Link href={href} style={{ fontSize: 12.5, color: colors.primary, textDecoration: "none", fontWeight: 500 }}>{linkLabel ?? "View all"}</Link>}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="cy-card" style={{ height: "100%", ...style }}>{children}</div>;
}

function THead({ cols, flex }: { cols: string[]; flex?: (number | string)[] }) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid #f3f4f6", padding: "8px 14px", background: "#f9fafb" }}>
      {cols.map((c, i) => (
        <span key={i} style={{ flex: flex?.[i] ?? 1, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", paddingRight: 8 }}>{c}</span>
      ))}
    </div>
  );
}

function ServerMap({ servers }: { servers: ServerRow[] }) {
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const activeSet = new Set(servers.map(s => (s.location ?? "").toLowerCase()));
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/world-map-servers.png" alt="Server locations" draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "fill", display: "block", userSelect: "none" }} />
      </div>
      <div style={{ display: "flex", borderTop: "1px solid #e5e7eb", flexWrap: "wrap" }}>
        {MAP_REGIONS.map(region => {
          const isHovered = hoveredRegion === region.key;
          return (
            <div key={region.key}
              onMouseEnter={() => setHoveredRegion(region.key)}
              onMouseLeave={() => setHoveredRegion(null)}
              style={{ position: "relative", padding: "7px 14px", cursor: "default", borderRight: "1px solid #f3f4f6", background: isHovered ? "#f9fafb" : "transparent", transition: "background 0.12s" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: REGION_COLOR[region.key], border: "1.5px solid #fff", boxShadow: `0 0 0 1.5px ${REGION_COLOR[region.key]}55`, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: "#6b7280", whiteSpace: "nowrap" }}>{region.label}</span>
              </div>
              {isHovered && (
                <div style={{ position: "absolute", bottom: "calc(100% + 6px)", left: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: "10px 14px", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", zIndex: 20, minWidth: 190, pointerEvents: "none" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: REGION_COLOR[region.key], marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #f3f4f6" }}>{region.label}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {region.cities.map(({ city, country }) => (
                      <div key={city} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: REGION_COLOR[region.key], flexShrink: 0, opacity: activeSet.has(city.toLowerCase()) ? 1 : 0.45 }} />
                        <span style={{ color: "#9ca3af" }}>{country}</span>
                        <span style={{ color: "#9ca3af" }}>–</span>
                        <span style={{ color: "#111827", fontWeight: 500 }}>{city}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DashboardHomeClient({ user }: { user: DashboardUser }) {
  const [stats,            setStats]           = useState<Stats | null>(null);
  const [servers,          setServers]         = useState<ServerRow[]>([]);
  const [subs,             setSubs]            = useState<SubRow[]>([]);
  const [activity,         setActivity]        = useState<ActivityRow[]>([]);
  const [notifs,           setNotifs]          = useState<NotifRow[]>([]);
  const [loading,          setLoading]         = useState(true);
  const [isMobile,         setIsMobile]        = useState(false);
  const [lastLogin,        setLastLogin]       = useState<string | null>(null);
  const [unreadNotifCount, setUnreadNotifCount]= useState(0);

  const userStatus = user.userStatus ?? "ACTIVE";

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 899px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    fetch("/api/customer/dashboard")
      .then(r => r.json())
      .then(d => {
        setStats(d.stats);
        setServers(d.servers ?? []);
        setSubs(d.subscriptions ?? []);
        setActivity(d.recentActivity ?? []);
        setNotifs(d.notifications ?? []);
        setLastLogin(d.lastLogin ?? null);
        setUnreadNotifCount(d.unreadNotifCount ?? 0);
      })
      .finally(() => setLoading(false));
  }, []);

  const { guardHref, toast } = useActionGuard(user.userStatus ?? "ACTIVE");

  const currency  = user.currency ?? (user.market === "saudi" ? "SAR" : "USD");
  const greetName = user.companyName || user.name?.split(" ")[0] || null;
  const lim       = isMobile ? "sm" : "lg";

  const visibleServers  = servers.slice(0,  LIMIT.servers[lim]);
  const visibleSubs     = subs.slice(0,     LIMIT.subs[lim]);
  const visibleActivity = activity.slice(0, LIMIT.activity[lim]);
  const visibleNotifs   = notifs.slice(0,   LIMIT.notifs[lim]);

  return (
    <>
      {toast}

      <style>{`
        .cy-dash-wrap { padding: 24px; overflow: hidden; }
        @media (max-width: 1023px) { .cy-dash-wrap { padding: 12px; } }
        .cy-stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; }
        @media (max-width: 900px) { .cy-stats-grid { grid-template-columns: repeat(2,1fr); gap: 8px; } }
        .cy-row-half { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr); gap: 16px; align-items: stretch; }
        @media (max-width: 900px) { .cy-row-half { grid-template-columns: minmax(0,1fr); gap: 12px; } }
        .cy-col-full { display: flex; flex-direction: column; height: 100%; min-width: 0; overflow: hidden; }
        .cy-quick-acts { display: flex; flex-direction: column; gap: 8px; height: 100%; }
        @media (max-width: 900px) { .cy-quick-acts { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; height: auto; } }
        .cy-stat-card:hover { border-color: #a8d5c9 !important; box-shadow: 0 2px 8px rgba(49,135,116,0.07); }
        .cy-stat-card { padding: 15px 16px; gap: 13px; }
        .cy-stat-icon { width: 40px; height: 40px; border-radius: 8px; }
        .cy-stat-val { font-size: 24px; }
        .cy-stat-lbl { font-size: 12px; }
        @media (max-width: 900px) {
          .cy-stat-card { padding: 10px 13px !important; gap: 10px !important; }
          .cy-stat-icon { width: 32px !important; height: 32px !important; border-radius: 7px !important; }
          .cy-stat-val { font-size: 18px !important; }
          .cy-stat-lbl { font-size: 11.5px !important; }
        }
        .cy-table-row:hover { background: #f5faf8 !important; }
        .cy-table-row { color: inherit; display: block; width: 100%; }
        .cy-quick-act:hover { border-color: #a8d5c9 !important; background: #fafefa !important; }
        .cy-notif-row:hover { background: #f5faf8 !important; }
        .cy-activity-row:hover { background: #f5faf8 !important; }
        .cy-card { background: #fff; border: 1px solid #e5e7eb; overflow: hidden; width: 100%; box-sizing: border-box; }
        .cy-act-link { display: flex; align-items: center; gap: 12px; padding: 11px 14px; text-decoration: none; overflow: hidden; width: 100%; box-sizing: border-box; }
        .cy-notif-lnk { display: block; text-decoration: none; overflow: hidden; width: 100%; }
        .cy-hdr-actions { display: flex; gap: 8px; flex-shrink: 0; }
        @media (max-width: 560px) { .cy-hdr-actions { display: none; } }
        @keyframes cy-shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .cy-shimmer { background: linear-gradient(90deg, #f0f0f0 25%, #e4e4e4 50%, #f0f0f0 75%); background-size: 800px 100%; animation: cy-shimmer 1.4s ease-in-out infinite; border-radius: 4px; display: inline-block; }
      `}</style>

      <div className="cy-dash-wrap">

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
          <div style={{ minWidth: 0 }}>
            <h1 className="cy-page-title" style={{ margin: "0 0 3px" }}>
              {greetName ? `Welcome, ${greetName.length > 25 ? greetName.slice(0, 23) + ".." : greetName}` : "Dashboard"}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
              {lastLogin
                ? `Last login: ${new Date(lastLogin).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at ${new Date(lastLogin).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
                : "Here's an overview of your cloud services."}
            </p>
          </div>
          <div className="cy-hdr-actions">
            {/* Submit RFQ — always allowed */}
            <Link href="/dashboard/rfq" style={{ display: "flex", alignItems: "center", height: 34, padding: "0 14px", background: "#fff", border: "1px solid #e5e7eb", fontSize: 13, fontWeight: 500, color: "#374151", textDecoration: "none" }}>
              Submit RFQ
            </Link>
            {/* New Service — restricted for PENDING/INFO_REQUIRED */}
            <Link href="/dashboard/catalogue" onClick={e => guardHref(e, "/dashboard/catalogue")}
              style={{ display: "flex", alignItems: "center", height: 34, padding: "0 14px", background: colors.primary, fontSize: 13, fontWeight: 500, color: "#fff", textDecoration: "none" }}>
              + New Service
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="cy-stats-grid" style={{ marginBottom: 20 }}>
          {[
            { label: "Active Services",    href: "/dashboard/subscriptions", value: stats?.activeSubscriptions ?? 0, accent: "success" as const, icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1.5" y="1.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="10.5" y="1.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="1.5" y="10.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="10.5" y="10.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/></svg> },
            { label: "Active Servers",     href: "/dashboard/servers",       value: stats?.servers ?? 0,                accent: "default" as const, icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="1.5" y="2.5" width="15" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="1.5" y="10.5" width="15" height="5" rx="1" stroke="currentColor" strokeWidth="1.5"/><circle cx="4.5" cy="5" r="0.8" fill="currentColor"/><circle cx="4.5" cy="13" r="0.8" fill="currentColor"/></svg> },
            { label: "Pending Invoices",   href: "/dashboard/invoices",      value: stats?.pendingInvoices ?? 0,        accent: (stats?.overdueInvoices ? "danger" : stats?.pendingInvoices ? "warning" : "default") as "danger"|"warning"|"default", icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2.5" y="1.5" width="13" height="15" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M6 6h6M6 9h5M6 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
            { label: "Expiring (30 days)", href: "/dashboard/subscriptions", value: stats?.expiringSubscriptions ?? 0, accent: (stats?.expiringSubscriptions ? "warning" : "default") as "warning"|"default", icon: <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M9 5.5v4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg> },
          ].map(card => {
            const accentMap = {
              success: { iconBg: "#e8f5f0", iconColor: colors.primary, valColor: colors.primary },
              warning: { iconBg: "#fff8e6", iconColor: "#b45309", valColor: "#b45309" },
              danger:  { iconBg: "#fdf0ef", iconColor: "#dc2626", valColor: "#dc2626" },
              default: { iconBg: "#f3f4f6", iconColor: "#6b7280", valColor: "#111827" },
            }[card.accent];
            return (
              <Link key={card.label} href={card.href} onClick={e => guardHref(e, card.href)}
                className="cy-stat-card" style={{ display: "flex", alignItems: "center", background: "#fff", border: "1px solid #e5e7eb", textDecoration: "none" }}>
                <div className="cy-stat-icon" style={{ flexShrink: 0, background: accentMap.iconBg, color: accentMap.iconColor, display: "flex", alignItems: "center", justifyContent: "center" }}>{card.icon}</div>
                <div>
                  <div className="cy-stat-val" style={{ fontWeight: 700, lineHeight: 1, color: accentMap.valColor, letterSpacing: "-0.02em" }}>{loading ? <Skeleton w={36} h={22} /> : card.value}</div>
                  <div className="cy-stat-lbl" style={{ color: "#6b7280", marginTop: 3 }}>{card.label}</div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Row 2: Servers + Quick actions */}
        <div className="cy-row-half" style={{ marginBottom: 20 }}>
          <div className="cy-col-full">
            <SectionHeader title="My Servers" href="/dashboard/servers" linkLabel="All servers" />
            <Card>
              {!isMobile && <THead cols={["ID / Key", "IPv4", "Specs", "Location", "Status"]} flex={[1.5, 1.5, 1.5, 1.5, 1]} />}
              {loading
                ? Array.from({ length: isMobile ? LIMIT.servers.sm : LIMIT.servers.lg }).map((_, i) => (
                    <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid #f9fafb" }}>
                      <Skeleton w="40%" h={12} /><div style={{ marginTop: 5 }}><Skeleton w="60%" h={10} /></div>
                    </div>
                  ))
                : visibleServers.length === 0
                  ? (
                    <div style={{ padding: "28px 16px", textAlign: "center" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1.5" y="3" width="17" height="6" rx="1.5" stroke="#9ca3af" strokeWidth="1.5"/><rect x="1.5" y="11" width="17" height="6" rx="1.5" stroke="#9ca3af" strokeWidth="1.5"/><circle cx="4.5" cy="6" r="1" fill="#9ca3af"/><circle cx="4.5" cy="14" r="1" fill="#9ca3af"/></svg>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>No servers yet</div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>Deploy your first cloud server</div>
                      <Link href="/dashboard/catalogue" onClick={e => guardHref(e, "/dashboard/catalogue")}
                        style={{ display: "inline-flex", alignItems: "center", height: 30, padding: "0 14px", background: colors.primary, color: "#fff", fontSize: 12, fontWeight: 500, textDecoration: "none", borderRadius: 6 }}>Browse catalogue</Link>
                    </div>
                  )
                  : visibleServers.map((s, idx) => {
                      const specs = s.vcpus || s.ramGb ? `${s.vcpus ?? "?"}vCPU / ${s.ramGb ?? "?"}GB${s.diskGb ? ` / ${s.diskGb}GB` : ""}` : "—";
                      const code  = s.productKey ?? s.hetznerServerId ?? s.oracleInstanceId ?? s.id.slice(0, 10);
                      const last  = idx === visibleServers.length - 1;
                      const border = last ? "none" : "1px solid #f3f4f6";
                      if (isMobile) {
                        return (
                          <Link key={s.id} href={`/dashboard/servers/${s.id}`} onClick={e => guardHref(e, `/dashboard/servers/${s.id}`)} className="cy-table-row"
                            style={{ display: "flex", flexDirection: "column", padding: "10px 14px", borderBottom: border, textDecoration: "none", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 500, color: "#111827", textTransform: "uppercase", letterSpacing: "0.03em" }}>{code}</span>
                              <StatusText status={s.status ?? "unknown"} size={11} />
                            </div>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 11, color: "#9ca3af" }}>
                              {s.ipv4 && <span style={{ fontFamily: "monospace" }}>{s.ipv4}</span>}
                              {specs !== "—" && <><span>·</span><span>{specs}</span></>}
                              {s.location && <><span>·</span><span>{s.location}</span></>}
                            </div>
                          </Link>
                        );
                      }
                      return (
                        <Link key={s.id} href={`/dashboard/servers/${s.id}`} onClick={e => guardHref(e, `/dashboard/servers/${s.id}`)} className="cy-table-row"
                          style={{ display: "flex", alignItems: "center", padding: "9px 14px", borderBottom: border, textDecoration: "none" }}>
                          <div style={{ flex: 1.5, minWidth: 0, paddingRight: 8 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.03em" }}>{code}</div>
                          </div>
                          <span style={{ flex: 1.5, fontSize: 12, fontFamily: "monospace", color: "#374151", paddingRight: 8, whiteSpace: "nowrap" }}>{s.ipv4 ?? "—"}</span>
                          <span style={{ flex: 1.5, fontSize: 11.5, color: "#6b7280", paddingRight: 8, whiteSpace: "nowrap" }}>{specs}</span>
                          <span style={{ flex: 1.5, fontSize: 12, color: "#6b7280", paddingRight: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.location ?? "—"}</span>
                          <span style={{ flex: 1 }}><StatusText status={s.status ?? "unknown"} /></span>
                        </Link>
                      );
                    })
              }
            </Card>
          </div>

          {/* Quick actions */}
          <div className="cy-col-full">
            <SectionHeader title="Quick actions" />
            <div className="cy-quick-acts">
              {(() => {
                const isTotpOn = user.totpEnabled ?? false;
                type QA = { href: string; label: string; sub: string; p: boolean; restricted: boolean; icon: React.ReactNode };
                const acts: QA[] = [
                  // First: 2FA if not enabled, RFQ if enabled
                  isTotpOn
                    ? { href: "/dashboard/rfq",              label: "Submit RFQ",   sub: "Request a quote",       p: false, restricted: false, icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 2H10a1 1 0 00-.707.293L2.293 9.293a1 1 0 000 1.414l3 3a1 1 0 001.414 0L13.707 6.707A1 1 0 0014 6V2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><circle cx="11.5" cy="4.5" r="0.75" fill="currentColor"/></svg> }
                    : { href: "/dashboard/profile#security", label: "Enable 2FA",   sub: "Secure your account",   p: true,  restricted: false, icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1L2 4v4c0 3.31 2.67 6.4 6 7 3.33-.6 6-3.69 6-7V4L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg> },
                  { href: "/dashboard/catalogue",  label: "Buy a Service",  sub: "Browse cloud plans",   p: false, restricted: true,  icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 1v14M1 8h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg> },
                  { href: "/dashboard/invoices",   label: "View Invoices",  sub: "Pay or download",      p: false, restricted: true,  icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="1" width="12" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M5 5h6M5 8h5M5 11h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
                  { href: "/dashboard/quotations", label: "Quotations",     sub: "View & accept quotes", p: false, restricted: true,  icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M4 6h8M4 9h6M4 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
                  { href: "/dashboard/statement",  label: "Statement",      sub: "Account ledger",       p: false, restricted: true,  icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1.5" y="1.5" width="13" height="13" rx="1" stroke="currentColor" strokeWidth="1.5"/><path d="M4 4h4M4 7h8M4 10h8M4 13h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> },
                ];
                return acts.map(a => (
                  <Link key={a.href} href={a.href} onClick={a.restricted ? e => guardHref(e, a.href) : undefined}
                    className="cy-quick-act" style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, background: a.label === "Enable 2FA" ? "#fafefa" : "#fff", border: a.label === "Enable 2FA" ? "1px solid #a8d5c9" : "1px solid #e5e7eb", padding: "10px 13px", textDecoration: "none", transition: "border-color 0.15s, background 0.15s", boxSizing: "border-box" }}>
                    <div style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, background: a.p ? "#e8f5f0" : "#f3f4f6", color: a.p ? colors.primary : "#6b7280", display: "flex", alignItems: "center", justifyContent: "center" }}>{a.icon}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.label}</div>
                      <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 1 }}>{a.sub}</div>
                    </div>
                  </Link>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Row 3: Subscriptions + Map */}
        <div className="cy-row-half" style={{ marginBottom: 20 }}>
          <div className="cy-col-full">
            <SectionHeader title="My Subscriptions" href="/dashboard/subscriptions" />
            <Card>
              {!isMobile && <THead cols={["Service", "Start", "Expires", "Status"]} flex={[2, 1, 1, 1]} />}
              {loading
                ? Array.from({ length: isMobile ? LIMIT.subs.sm : LIMIT.subs.lg }).map((_, i) => (
                    <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid #f9fafb" }}>
                      <Skeleton w="55%" h={12} /><div style={{ marginTop: 5 }}><Skeleton w="35%" h={10} /></div>
                    </div>
                  ))
                : visibleSubs.length === 0
                  ? (
                    <div style={{ padding: "28px 16px", textAlign: "center" }}>
                      <div style={{ width: 40, height: 40, borderRadius: 10, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="1.5" y="1.5" width="7" height="7" rx="1.5" stroke="#9ca3af" strokeWidth="1.5"/><rect x="11.5" y="1.5" width="7" height="7" rx="1.5" stroke="#9ca3af" strokeWidth="1.5"/><rect x="1.5" y="11.5" width="7" height="7" rx="1.5" stroke="#9ca3af" strokeWidth="1.5"/><rect x="11.5" y="11.5" width="7" height="7" rx="1.5" stroke="#9ca3af" strokeWidth="1.5"/></svg>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>No active services</div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>Subscribe to your first cloud service</div>
                      <Link href="/dashboard/catalogue" onClick={e => guardHref(e, "/dashboard/catalogue")}
                        style={{ display: "inline-flex", alignItems: "center", height: 30, padding: "0 14px", background: colors.primary, color: "#fff", fontSize: 12, fontWeight: 500, textDecoration: "none", borderRadius: 6 }}>Browse catalogue</Link>
                    </div>
                  )
                  : visibleSubs.map((s, idx) => {
                      const last   = idx === visibleSubs.length - 1;
                      const border = last ? "none" : "1px solid #f3f4f6";
                      if (isMobile) {
                        return (
                          <Link key={s.id} href={`/dashboard/subscriptions/${s.id}`} onClick={e => guardHref(e, `/dashboard/subscriptions/${s.id}`)} className="cy-table-row"
                            style={{ display: "flex", flexDirection: "column", padding: "10px 14px", borderBottom: border, textDecoration: "none", gap: 4 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "50%" }} title={s.productName}>{s.productName}</span>
                              <StatusText status={s.status} size={11} />
                            </div>
                            <div style={{ display: "flex", gap: 6, fontSize: 11, color: "#9ca3af" }}>
                              <span>{s.billingPeriod}</span><span>·</span><span>Exp: {fmtDateShort(s.currentPeriodEnd)}</span>
                            </div>
                          </Link>
                        );
                      }
                      return (
                        <Link key={s.id} href={`/dashboard/subscriptions/${s.id}`} onClick={e => guardHref(e, `/dashboard/subscriptions/${s.id}`)} className="cy-table-row"
                          style={{ display: "flex", alignItems: "center", padding: "9px 14px", borderBottom: border, textDecoration: "none" }}>
                          <div style={{ flex: 2, minWidth: 0, paddingRight: 12 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={s.productName}>{s.productName}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>{s.billingPeriod}</div>
                          </div>
                          <span style={{ flex: 1, fontSize: 12, color: "#6b7280", paddingRight: 8, whiteSpace: "nowrap" }}>{fmtDate(s.currentPeriodStart)}</span>
                          <span style={{ flex: 1, fontSize: 12, color: "#6b7280", paddingRight: 8, whiteSpace: "nowrap" }}>{fmtDateShort(s.currentPeriodEnd)}</span>
                          <span style={{ flex: 1 }}><StatusText status={s.status} /></span>
                        </Link>
                      );
                    })
              }
            </Card>
          </div>

          <div className="cy-col-full">
            <SectionHeader title="Server locations" />
            <Card style={{ padding: 0, minHeight: 240 }}>
              <ServerMap servers={servers} />
            </Card>
          </div>
        </div>

        {/* Row 4: Activity + Notifications */}
        <div className="cy-row-half">
          <div className="cy-col-full">
            <SectionHeader title="Recent activity" href="/dashboard/invoices" />
            <Card>
              {loading
                ? Array.from({ length: isMobile ? LIMIT.activity.sm : LIMIT.activity.lg }).map((_, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", borderBottom: "1px solid #f3f4f6" }}>
                      <Skeleton w={34} h={34} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}><Skeleton w="55%"/><Skeleton w="30%"/></div>
                    </div>
                  ))
                : visibleActivity.length === 0
                  ? <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>No recent activity yet.</div>
                  : visibleActivity.map((a, idx) => {
                      const tc: Record<string, {bg:string;color:string}> = {
                        INVOICE:{bg:"#eef5ff",color:"#2563eb"}, QUOTATION:{bg:"#fff8e6",color:"#b45309"},
                        RFQ:{bg:"#f0faf5",color:colors.primary}, CREDIT_NOTE:{bg:"#fdf0ef",color:"#dc2626"},
                        PROFORMA:{bg:"#f5f0ff",color:"#7c3aed"}, DELIVERY_NOTE:{bg:"#f0f5ff",color:"#1d4ed8"},
                        PO:{bg:"#f0fff4",color:"#166534"},
                      };
                      const c    = tc[a.type] ?? {bg:"#f3f4f6",color:"#6b7280"};
                      const last = idx === visibleActivity.length - 1;
                      return (
                        <Link key={a.id} href={a.href} onClick={e => guardHref(e, a.href)} className="cy-activity-row cy-act-link"
                          style={{ borderBottom: last ? "none" : "1px solid #f3f4f6", transition: "background 0.12s" }}>
                          <div style={{ width: 34, height: 34, borderRadius: 6, flexShrink: 0, background: c.bg, color: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.04em" }}>
                            {(DOC_LABELS[a.type] ?? a.type).slice(0,3).toUpperCase()}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {DOC_LABELS[a.type] ?? a.type}{" "}
                              <span style={{ fontFamily: "monospace", fontSize: 11.5, color: "#9ca3af", fontWeight: 400 }}>{a.docNumber}</span>
                            </div>
                            <div style={{ display: "flex", gap: 8, marginTop: 3, alignItems: "center" }}>
                              {a.totalAmount != null && <span style={{ fontSize: 12, color: "#374151", fontWeight: 500 }}>{fmt(a.totalAmount, a.currency ?? currency)}</span>}
                              <StatusText status={a.status} size={11} />
                            </div>
                          </div>
                          <span style={{ fontSize: 11.5, color: "#9ca3af", flexShrink: 0 }}>{timeAgo(a.createdAt)}</span>
                        </Link>
                      );
                    })
              }
            </Card>
          </div>

          <div className="cy-col-full">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <h2 style={{ margin: 0, fontSize: 14.5, fontWeight: 600, color: "#111827" }}>Notifications</h2>
                {unreadNotifCount > 0 && (
                  <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", minWidth: 18, height: 18, padding: "0 5px", borderRadius: 9, background: "#dc2626", color: "#fff", fontSize: 10.5, fontWeight: 700, lineHeight: 1 }}>
                    {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                  </span>
                )}
              </div>
              <Link href="/dashboard/notifications" style={{ fontSize: 12.5, color: colors.primary, textDecoration: "none", fontWeight: 500 }}>View all</Link>
            </div>
            <Card>
              {loading
                ? Array.from({ length: isMobile ? LIMIT.notifs.sm : LIMIT.notifs.lg }).map((_, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "12px 14px", borderBottom: "1px solid #f3f4f6" }}>
                      <Skeleton w={8} h={8} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}><Skeleton w="70%"/><Skeleton w="45%"/></div>
                    </div>
                  ))
                : visibleNotifs.length === 0
                  ? <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>You're all caught up.</div>
                  : visibleNotifs.map((n, idx) => {
                      const dotColor = {INFO:"#2563eb",SUCCESS:colors.primary,WARNING:"#b45309",ERROR:"#dc2626"}[n.type] ?? "#6b7280";
                      const last     = idx === visibleNotifs.length - 1;
                      const inner = (
                        <div className="cy-notif-row" style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "11px 14px", borderBottom: last ? "none" : "1px solid #f3f4f6", background: n.isRead ? "transparent" : "#f9fffe", transition: "background 0.12s", color: "inherit" }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0, marginTop: 5 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: n.isRead ? 400 : 600, color: "#111827", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.title}</div>
                            <div style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.body}</div>
                          </div>
                          <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0, whiteSpace: "nowrap" }}>{timeAgo(n.createdAt)}</span>
                        </div>
                      );
                      return n.link
                        ? <Link key={n.id} href={n.link} className="cy-notif-lnk">{inner}</Link>
                        : <div key={n.id} style={{ overflow: "hidden", width: "100%" }}>{inner}</div>;
                    })
              }
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
