"use client";
// app/dashboard/DashboardClient.tsx

import React from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { colors } from "@/lib/ui/tokens";

const P = colors.primary;
const PL = colors.primaryLight;

interface SubRow {
  id: string;
  productName: string;
  productType: string;
  marketKey: string;
  currency: string;
  status: string;
  paymentStatus: string;
  billingPeriod: string;
  currentPeriodEnd: string | null;
}

interface SessionUser {
  id: string;
  email: string;
  role: string;
  marketId: string | null;
  customerGroupId: string | null;
  customerNumber: string | null;
  fullName?: string | null;
  market?: { name: string; key: string } | null;
  customerGroup?: { name: string; key: string } | null;
}

interface Props {
  user: SessionUser;
  subs: SubRow[];
  serverCount: number;
  expiringSoon: number;
  unpaidCount: number;
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
  const label = status.replace(/_/g, " ");
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
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function DashboardClient({ user, subs, serverCount, expiringSoon, unpaidCount }: Props) {
  const displayName = user.fullName ?? user.email;
  const initials = displayName
    .split(/[\s@.]+/)
    .slice(0, 2)
    .map((s: string) => s[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2) || "CU";

  const activeSubs = subs.filter(s => s.status === "ACTIVE").length;

  return (
    <div style={{ padding: "24px" }}>
      {/* Welcome banner */}
      <div style={{
        background: "#fff",
        border: `1px solid ${colors.border}`,
        padding: "18px 22px",
        marginBottom: 20,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 42, height: 42, background: P, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#fff",
          }}>{initials}</div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{displayName}</p>
            <p style={{ fontSize: 12.5, color: colors.textMuted, marginTop: 2 }}>
              {user.customerNumber ? `Customer #${user.customerNumber} · ` : ""}
              {user.email}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/dashboard/rfq" style={{
            border: `1px solid ${colors.border}`,
            padding: "7px 14px",
            fontSize: 13, fontWeight: 500, color: "#374151",
            textDecoration: "none",
          }}>Submit RFQ</Link>
          <Link href="/dashboard/catalogue" style={{
            background: P, padding: "7px 16px",
            fontSize: 13, fontWeight: 600, color: "#fff",
            textDecoration: "none",
          }}>Buy / Renew</Link>
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        border: `1px solid ${colors.border}`,
        gap: 1, background: colors.border,
        marginBottom: 20,
      }}>
        {[
          { label: "Active Services",  value: activeSubs },
          { label: "Expiring Soon",    value: expiringSoon, warn: expiringSoon > 0 },
          { label: "Unpaid Invoices",  value: unpaidCount,  warn: unpaidCount > 0 },
          { label: "Servers",          value: serverCount },
        ].map((s, i) => (
          <div key={i} style={{ background: "#fff", padding: "18px 18px" }}>
            <div style={{
              fontSize: 26, fontWeight: 700, marginBottom: 3,
              color: s.warn ? "#991b1b" : "#111827",
            }}>{s.value}</div>
            <div style={{ fontSize: 12.5, color: colors.textMuted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Subscriptions list */}
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 16 }}>

        <div style={{ background: "#fff", border: `1px solid ${colors.border}` }}>
          <div style={{
            padding: "14px 20px", borderBottom: `1px solid ${colors.borderLight}`,
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>My Services</span>
            <Link href="/dashboard/subscriptions" style={{ fontSize: 13, color: P, textDecoration: "none" }}>View all →</Link>
          </div>

          {subs.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: colors.textFaint, fontSize: 13 }}>
              No services yet.{" "}
              <Link href="/dashboard/catalogue" style={{ color: P }}>Browse catalogue →</Link>
            </div>
          ) : subs.slice(0, 6).map((s, i) => {
            const days = daysUntil(s.currentPeriodEnd);
            return (
              <div key={s.id} style={{
                padding: "12px 20px",
                display: "flex", alignItems: "center", gap: 12,
                borderBottom: i < Math.min(subs.length, 6) - 1 ? `1px solid ${colors.borderLight}` : "none",
              }}>
                <div style={{
                  width: 34, height: 34, background: PL, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon name="services" size={15} color={P} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.productName}
                  </p>
                  <p style={{ fontSize: 11, color: colors.textFaint }}>
                    {s.billingPeriod.replace("_", " ")} · Due {fmtDate(s.currentPeriodEnd)}
                    {days !== null && days <= 14 && (
                      <span style={{ color: "#991b1b", marginLeft: 6 }}>({days}d left)</span>
                    )}
                  </p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  <StatusTag status={s.status} />
                  {s.paymentStatus === "UNPAID" && <StatusTag status={s.paymentStatus} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick actions */}
        <div style={{ background: "#fff", border: `1px solid ${colors.border}`, padding: "16px 20px" }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Quick Actions</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Browse Services",    icon: "catalogue",     href: "/dashboard/catalogue" },
              { label: "Submit RFQ",         icon: "rfq",           href: "/dashboard/rfq" },
              { label: "View Invoices",      icon: "invoice",       href: "/dashboard/invoices" },
              { label: "My Servers",         icon: "server",        href: "/dashboard/servers" },
              { label: "Download Statement", icon: "statement",     href: "/dashboard/statement" },
              { label: "View Quotations",    icon: "quotations",    href: "/dashboard/quotations" },
            ].map(a => (
              <Link key={a.label} href={a.href} style={{
                border: `1px solid ${colors.border}`,
                padding: "11px 12px",
                display: "flex", alignItems: "center", gap: 10,
                background: "#f9fafb",
                textDecoration: "none",
                transition: "all 0.12s",
              }} className="cy-row">
                <Icon name={a.icon} size={15} color={P} />
                <span style={{ fontSize: 12.5, fontWeight: 500, color: "#374151" }}>{a.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Servers link */}
      <div style={{ background: "#fff", border: `1px solid ${colors.border}`, padding: "16px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>My Servers</span>
          <Link href="/dashboard/servers" style={{ fontSize: 13, color: P, textDecoration: "none" }}>Manage →</Link>
        </div>
        {serverCount === 0 ? (
          <p style={{ fontSize: 13, color: colors.textFaint }}>No servers assigned yet.</p>
        ) : (
          <p style={{ fontSize: 13, color: "#374151" }}>
            You have <strong>{serverCount}</strong> server{serverCount > 1 ? "s" : ""} assigned.{" "}
            <Link href="/dashboard/servers" style={{ color: P }}>View details →</Link>
          </p>
        )}
      </div>
    </div>
  );
}
