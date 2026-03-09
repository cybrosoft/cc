"use client";
// app/admin/AdminDashboardClient.tsx

import React from "react";
import Link from "next/link";
import { colors } from "@/lib/ui/tokens";

const P = colors.primary;
const PL = colors.primaryLight;

interface SubRow {
  id: string;
  customerName: string;
  customerEmail: string;
  customerNumber: string;
  productName: string;
  marketKey: string;
  marketName: string;
  currency: string;
  status: string;
  paymentStatus: string;
  billingPeriod: string;
  currentPeriodEnd: string | null;
  createdAt: string;
}

interface DashboardStats {
  activeSubs: number;
  pendingApprovals: number;
  expiringSoon: number;
  activeServers: number;
  totalCustomers: number;
  recentSubs: SubRow[];
}

function StatusTag({ status }: { status: string }) {
  const map: Record<string, { c: string; bg: string; b: string }> = {
    ACTIVE:           colors.statusActive,
    PENDING_PAYMENT:  colors.statusPending,
    PENDING_EXTERNAL: colors.statusPending,
    CANCELED:         colors.statusCanceled,
    PAID:             colors.statusPaid,
    UNPAID:           colors.statusUnpaid,
    FAILED:           colors.statusUnpaid,
  };
  const s = map[status] ?? { c: "#374151", bg: "#f3f4f6", b: "#e5e7eb" };
  const label = status.replace("_", " ");
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: "1px 8px",
      color: s.c, background: s.bg, border: `1px solid ${s.b}`,
      whiteSpace: "nowrap",
    }}>{label}</span>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

interface StatCardProps {
  label: string;
  value: string | number;
  note?: string;
}

function StatCard({ label, value, note }: StatCardProps) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${colors.border}`, padding: "18px 18px" }}>
      <div style={{ fontSize: 26, fontWeight: 700, color: "#111827", marginBottom: 3 }}>{value}</div>
      <div style={{ fontSize: 12.5, fontWeight: 500, color: "#374151", marginBottom: 2 }}>{label}</div>
      {note && <div style={{ fontSize: 11, color: colors.textFaint }}>{note}</div>}
    </div>
  );
}

export function AdminDashboardClient({ stats }: { stats: DashboardStats }) {
  const expiringSubs = stats.recentSubs
    .filter(s => s.currentPeriodEnd && s.status === "ACTIVE")
    .map(s => ({ ...s, daysLeft: daysUntil(s.currentPeriodEnd) }))
    .filter(s => s.daysLeft !== null && s.daysLeft <= 30)
    .sort((a, b) => (a.daysLeft ?? 99) - (b.daysLeft ?? 99))
    .slice(0, 5);

  return (
    <div>
      {/* Page title row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 11, color: colors.textFaint, letterSpacing: ".05em", marginBottom: 3 }}>ADMIN / DASHBOARD</p>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {["All Markets", "Saudi · SAR", "Global · USD"].map((m, i) => (
            <button key={m} style={{
              padding: "6px 14px", fontSize: 13,
              fontWeight: i === 0 ? 600 : 400,
              background: i === 0 ? P : "#fff",
              color: i === 0 ? "#fff" : colors.textMuted,
              border: i === 0 ? "none" : `1px solid ${colors.border}`,
              cursor: "pointer",
              fontFamily: "inherit",
            }}>{m}</button>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: 1,
        background: colors.border,
        border: `1px solid ${colors.border}`,
        marginBottom: 20,
      }}>
        <StatCard label="Active Subscriptions" value={stats.activeSubs}       note="All markets" />
        <StatCard label="Pending Approvals"    value={stats.pendingApprovals} note="Awaiting action" />
        <StatCard label="Expiring ≤ 30 Days"   value={stats.expiringSoon}     note="Needs attention" />
        <StatCard label="Active Servers"       value={stats.activeServers}    note="All providers" />
        <StatCard label="Total Customers"      value={stats.totalCustomers}   note="Registered users" />
      </div>

      {/* 2-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Recent subscriptions */}
        <div style={{ background: "#fff", border: `1px solid ${colors.border}` }}>
          <div style={{
            padding: "14px 20px",
            borderBottom: `1px solid ${colors.borderLight}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>Recent Subscriptions</span>
            <Link href="/admin/subscriptions" style={{ fontSize: 13, color: P, textDecoration: "none" }}>
              View all →
            </Link>
          </div>

          {/* Head */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 48px 96px",
            padding: "8px 20px",
            background: "#f9fafb",
            borderBottom: `1px solid ${colors.borderLight}`,
          }}>
            {["CUSTOMER", "PRODUCT", "MKT", "STATUS"].map(h => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: colors.textFaint, letterSpacing: ".06em" }}>{h}</span>
            ))}
          </div>

          {stats.recentSubs.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: colors.textFaint, fontSize: 13 }}>
              No subscriptions yet
            </div>
          ) : stats.recentSubs.map((s, i) => (
            <Link
              key={s.id}
              href={`/admin/subscriptions`}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 48px 96px",
                padding: "11px 20px",
                alignItems: "center",
                borderBottom: i < stats.recentSubs.length - 1 ? `1px solid ${colors.borderLight}` : "none",
                textDecoration: "none",
                transition: "background 0.12s",
              }}
              className="cy-row"
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.customerName}
                </div>
                <div style={{ fontSize: 11, color: colors.textFaint }}>#{s.customerNumber}</div>
              </div>
              <span style={{ fontSize: 12, color: colors.textMuted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>
                {s.productName}
              </span>
              <span style={{
                fontSize: 11, fontWeight: 600,
                color: s.marketKey === "saudi" ? P : "#2563eb",
                background: s.marketKey === "saudi" ? PL : "#eff6ff",
                padding: "2px 6px",
              }}>{s.marketKey === "saudi" ? "SA" : "GL"}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <StatusTag status={s.status} />
                <StatusTag status={s.paymentStatus} />
              </div>
            </Link>
          ))}
        </div>

        {/* Expiring soon + quick links */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Expiring */}
          <div style={{ background: "#fff", border: `1px solid ${colors.border}`, flex: 1 }}>
            <div style={{
              padding: "14px 20px",
              borderBottom: `1px solid ${colors.borderLight}`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Expiring Soon</span>
              {stats.expiringSoon > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: "#991b1b", background: "#fee2e2",
                  padding: "1px 8px", border: "1px solid #fca5a5",
                }}>{stats.expiringSoon} subs</span>
              )}
            </div>
            {expiringSubs.length === 0 ? (
              <div style={{ padding: "24px 20px", textAlign: "center", color: colors.textFaint, fontSize: 13 }}>
                Nothing expiring soon 🎉
              </div>
            ) : expiringSubs.map((s, i) => (
              <div key={s.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 20px",
                borderBottom: i < expiringSubs.length - 1 ? `1px solid ${colors.borderLight}` : "none",
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.customerName}
                  </div>
                  <div style={{ fontSize: 11, color: colors.textFaint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.productName}
                  </div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, flexShrink: 0, marginLeft: 10,
                  color: (s.daysLeft ?? 99) <= 7 ? "#991b1b" : "#92400e",
                  background: (s.daysLeft ?? 99) <= 7 ? "#fee2e2" : "#fef3c7",
                  padding: "2px 8px",
                  border: `1px solid ${(s.daysLeft ?? 99) <= 7 ? "#fca5a5" : "#fcd34d"}`,
                }}>{s.daysLeft}d</span>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div style={{ background: "#fff", border: `1px solid ${colors.border}`, padding: "16px 20px" }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Quick Actions</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "New Customer",    href: "/admin/customers/new" },
                { label: "New Invoice",     href: "/admin/sales/invoices" },
                { label: "Subscriptions",   href: "/admin/subscriptions" },
                { label: "All Customers",   href: "/admin/customers" },
              ].map(a => (
                <Link key={a.label} href={a.href} style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "10px 8px",
                  background: "#f9fafb",
                  border: `1px solid ${colors.border}`,
                  fontSize: 12.5, fontWeight: 500, color: "#374151",
                  textDecoration: "none",
                  textAlign: "center",
                  transition: "all 0.12s",
                }}>{a.label}</Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Management links row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 1, background: colors.border,
        border: `1px solid ${colors.border}`,
      }}>
        {[
          { label: "Catalog",    sub: "Categories, Products, Pricing", href: "/admin/catalog" },
          { label: "Customers",  sub: "View and manage customers",     href: "/admin/customers" },
          { label: "Sales",      sub: "Invoices, Quotes, RFQs",       href: "/admin/sales/invoices" },
          { label: "Servers",    sub: "Hetzner & Oracle instances",    href: "/admin/servers" },
        ].map(item => (
          <Link key={item.label} href={item.href} style={{
            background: "#fff",
            padding: "18px 20px",
            textDecoration: "none",
            display: "block",
            transition: "background 0.12s",
          }} className="cy-row">
            <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 3 }}>{item.label}</div>
            <div style={{ fontSize: 12, color: colors.textFaint }}>{item.sub}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
