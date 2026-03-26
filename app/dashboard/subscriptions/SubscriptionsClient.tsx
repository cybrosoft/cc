"use client";
// app/dashboard/subscriptions/SubscriptionsClient.tsx

import { useEffect, useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/ui/tokens";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PageUser {
  id: string; email: string; name?: string | null; companyName?: string | null;
  customerNumber?: string | null; market?: string | null; currency?: string | null;
}

interface AddonRow {
  id: string; productName: string; productKey: string | null;
  productType: string; unitLabel: string | null;
  billingPeriod: string; status: string; paymentStatus: string;
  quantity: number;
  currentPeriodStart: string | null; currentPeriodEnd: string | null;
}

interface SubRow extends AddonRow {
  locationCode: string | null; templateSlug: string | null;
  productNote: string | null; receiptUrl: string | null;
  parentSubId: string | null; expiringSoon: boolean;
  addons: AddonRow[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function daysLeft(d: string | null) {
  if (!d) return null;
  const diff = new Date(d).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

type FilterTab = "ALL" | "ACTIVE" | "PENDING_PAYMENT" | "CANCELED";

const TAB_LABELS: Record<FilterTab, string> = {
  ALL: "All", ACTIVE: "Active",
  PENDING_PAYMENT: "Pending", CANCELED: "Canceled",
};

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    ACTIVE:          { bg: "#e8f5f0", color: "#0F6E56" },
    PENDING_PAYMENT: { bg: "#fff8e6", color: "#854F0B" },
    PENDING_EXTERNAL:{ bg: "#fff8e6", color: "#854F0B" },
    CANCELED:        { bg: "#f3f4f6", color: "#6b7280" },
    EXPIRED:         { bg: "#fdf0ef", color: "#991b1b" },
  };
  const s = map[status] ?? { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", background: s.bg, color: s.color, textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ── Payment badge ─────────────────────────────────────────────────────────────
function PaymentBadge({ status }: { status: string }) {
  if (status === "PAID") return null;
  const map: Record<string, { bg: string; color: string }> = {
    UNPAID: { bg: "#fdf0ef", color: "#991b1b" },
    FAILED: { bg: "#fdf0ef", color: "#991b1b" },
  };
  const s = map[status] ?? { bg: "#f3f4f6", color: "#6b7280" };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", height: 20, padding: "0 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", background: s.bg, color: s.color, textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

// ── Skeleton shimmer ──────────────────────────────────────────────────────────
function Sk({ w = "100%", h = 13 }: { w?: string | number; h?: number }) {
  return <span className="cy-shimmer" style={{ width: w, height: h, display: "inline-block" }} />;
}

// ── Addon row ─────────────────────────────────────────────────────────────────
function AddonRow({ addon }: { addon: AddonRow }) {
  return (
    <Link href={`/dashboard/subscriptions/${addon.id}`}
      style={{ display: "flex", alignItems: "center", padding: "8px 14px 8px 36px", borderBottom: "1px solid #f9fafb", textDecoration: "none", background: "#fafafa", transition: "background 0.1s" }}
      className="cy-sub-row">
      {/* Indent line */}
      <div style={{ width: 2, height: "100%", background: "#e5e7eb", marginRight: 10, borderRadius: 1, alignSelf: "stretch" }} />
      <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
        <div style={{ fontSize: 12.5, color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {addon.productName}
          {addon.quantity > 1 && (
            <span style={{ marginLeft: 6, fontSize: 11, color: "#9ca3af" }}>×{addon.quantity}{addon.unitLabel ? ` ${addon.unitLabel}` : ""}</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{addon.billingPeriod}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <span style={{ fontSize: 11.5, color: "#6b7280" }}>{fmtDate(addon.currentPeriodEnd)}</span>
        <StatusBadge status={addon.status} />
      </div>
    </Link>
  );
}

// ── Subscription card ─────────────────────────────────────────────────────────
function SubCard({ sub }: { sub: SubRow }) {
  const days     = daysLeft(sub.currentPeriodEnd);
  const expiring = sub.expiringSoon || (days !== null && days <= 7 && days >= 0);
  const expired  = days !== null && days < 0;

  return (
    <div style={{ border: "1px solid #e5e7eb", background: "#fff", marginBottom: 10, overflow: "hidden" }}>
      {/* Main row */}
      <Link href={`/dashboard/subscriptions/${sub.id}`}
        style={{ display: "flex", alignItems: "center", padding: "12px 14px", textDecoration: "none", transition: "background 0.1s" }}
        className="cy-sub-row">

        {/* Left: name + meta */}
        <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>
              {sub.productName}
            </span>
            {sub.productKey && (
              <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", textTransform: "uppercase" }}>{sub.productKey}</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 11.5, color: "#6b7280" }}>{sub.billingPeriod}</span>
            {sub.locationCode && (
              <span style={{ fontSize: 11.5, color: "#6b7280" }}>· {sub.locationCode}</span>
            )}
            {sub.quantity > 1 && (
              <span style={{ fontSize: 11.5, color: "#6b7280" }}>· ×{sub.quantity}{sub.unitLabel ? ` ${sub.unitLabel}` : ""}</span>
            )}
            {expiring && !expired && (
              <span style={{ fontSize: 11, fontWeight: 600, color: "#b45309" }}>
                · Expires in {days} day{days !== 1 ? "s" : ""}
              </span>
            )}
            {expired && (
              <span style={{ fontSize: 11, fontWeight: 600, color: "#dc2626" }}>· Expired</span>
            )}
          </div>
        </div>

        {/* Right: dates + status */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <StatusBadge status={sub.status} />
            <PaymentBadge status={sub.paymentStatus} />
          </div>
          <div style={{ fontSize: 11.5, color: "#9ca3af" }}>
            {fmtDate(sub.currentPeriodStart)} → {fmtDate(sub.currentPeriodEnd)}
          </div>
        </div>
      </Link>

      {/* Addons */}
      {sub.addons.length > 0 && (
        <div style={{ borderTop: "1px solid #f3f4f6" }}>
          {sub.addons.map((a, i) => (
            <div key={a.id} style={{ borderBottom: i < sub.addons.length - 1 ? "1px solid #f9fafb" : "none" }}>
              <AddonRow addon={a} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function SubscriptionsClient({ user }: { user: PageUser }) {
  const [subs,    setSubs]    = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab,     setTab]     = useState<FilterTab>("ALL");

  useEffect(() => {
    fetch("/api/customer/subscriptions")
      .then(r => r.json())
      .then(d => setSubs(d.subscriptions ?? []))
      .finally(() => setLoading(false));
  }, []);

  // Count per tab
  const counts: Record<FilterTab, number> = {
    ALL:             subs.length,
    ACTIVE:          subs.filter(s => s.status === "ACTIVE").length,
    PENDING_PAYMENT: subs.filter(s => s.status === "PENDING_PAYMENT" || s.status === "PENDING_EXTERNAL").length,
    CANCELED:        subs.filter(s => s.status === "CANCELED").length,
  };

  const visible = tab === "ALL" ? subs
    : tab === "PENDING_PAYMENT"
      ? subs.filter(s => s.status === "PENDING_PAYMENT" || s.status === "PENDING_EXTERNAL")
      : subs.filter(s => s.status === tab);

  return (
    <>
      <style>{`
        @keyframes cy-shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .cy-shimmer { background: linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%); background-size:800px 100%; animation:cy-shimmer 1.4s ease-in-out infinite; border-radius:4px; }
        .cy-sub-row:hover { background: #f5faf8 !important; }
        .cy-tab { border: none; background: transparent; cursor: pointer; padding: 0; }
        .cy-tab:focus { outline: none; }
      `}</style>

      <div className="cy-page-content">
        <div className="cy-dash-wrap">

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <div>
              <h1 className="cy-page-title" style={{ margin: "0 0 3px" }}>My Subscriptions</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
                {loading ? "Loading..." : `${counts.ALL} service${counts.ALL !== 1 ? "s" : ""} · ${counts.ACTIVE} active`}
              </p>
            </div>
            <Link href="/dashboard/catalogue" style={{ display: "flex", alignItems: "center", height: 34, padding: "0 14px", background: colors.primary, fontSize: 13, fontWeight: 500, color: "#fff", textDecoration: "none" }}>
              + New Service
            </Link>
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #e5e7eb", paddingBottom: 0 }}>
            {(Object.keys(TAB_LABELS) as FilterTab[]).map(t => (
              <button key={t} className="cy-tab"
                onClick={() => setTab(t)}
                style={{
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: tab === t ? 600 : 400,
                  color: tab === t ? colors.primary : "#6b7280",
                  borderBottom: tab === t ? `2px solid ${colors.primary}` : "2px solid transparent",
                  marginBottom: -1,
                  transition: "color 0.12s",
                }}>
                {TAB_LABELS[t]}
                {counts[t] > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 11, background: tab === t ? "#e8f5f0" : "#f3f4f6", color: tab === t ? colors.primary : "#6b7280", padding: "1px 6px", borderRadius: 8, fontWeight: 500 }}>
                    {counts[t]}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          {loading ? (
            // Skeleton cards
            [1, 2, 3, 4].map(i => (
              <div key={i} style={{ border: "1px solid #e5e7eb", background: "#fff", padding: "14px", marginBottom: 10 }}>
                <Sk w="45%" h={14} />
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  <Sk w="18%" h={11} />
                  <Sk w="12%" h={11} />
                </div>
              </div>
            ))
          ) : visible.length === 0 ? (
            <div style={{ padding: "48px 16px", textAlign: "center" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <rect x="1.5" y="1.5" width="8" height="8" rx="1.5" stroke="#9ca3af" strokeWidth="1.4"/>
                  <rect x="12.5" y="1.5" width="8" height="8" rx="1.5" stroke="#9ca3af" strokeWidth="1.4"/>
                  <rect x="1.5" y="12.5" width="8" height="8" rx="1.5" stroke="#9ca3af" strokeWidth="1.4"/>
                  <rect x="12.5" y="12.5" width="8" height="8" rx="1.5" stroke="#9ca3af" strokeWidth="1.4"/>
                </svg>
              </div>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                {tab === "ALL" ? "No subscriptions yet" : `No ${TAB_LABELS[tab].toLowerCase()} subscriptions`}
              </div>
              {tab === "ALL" && (
                <>
                  <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 16 }}>Browse our catalogue to get started</div>
                  <Link href="/dashboard/catalogue" style={{ display: "inline-flex", alignItems: "center", height: 34, padding: "0 16px", background: colors.primary, color: "#fff", fontSize: 13, fontWeight: 500, textDecoration: "none", borderRadius: 6 }}>
                    Browse catalogue
                  </Link>
                </>
              )}
            </div>
          ) : (
            visible.map(s => <SubCard key={s.id} sub={s} />)
          )}

        </div>
      </div>
    </>
  );
}
