"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardUser {
  id: string;
  email: string;
  name?: string | null;
  customerNumber?: string | null;
  market?: string | null;
  customerGroup?: string | null;
}

interface DashboardStats {
  activeSubscriptions: number;
  pendingInvoices: number;
  overdueInvoices: number;
  expiringSubscriptions: number;
  servers: number;
}

interface RecentDoc {
  id: string;
  docNumber: string;
  type: string;
  status: string;
  paymentStatus?: string;
  totalAmount?: number;
  currency?: string;
  createdAt: string;
}

interface DashboardHomeClientProps {
  user: DashboardUser;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  INVOICE: "Invoice",
  QUOTE: "Quotation",
  PO: "Purchase Order",
  DN: "Delivery Note",
  PROFORMA: "Proforma Invoice",
  RETURN: "Invoice Return",
  RFQ: "RFQ",
};

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function StatCard({
  label,
  value,
  icon,
  href,
  accent,
  loading,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  href: string;
  accent?: "warning" | "danger" | "success" | "default";
  loading?: boolean;
}) {
  return (
    <Link href={href} className={`stat-card stat-card--${accent ?? "default"}`}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-body">
        <div className="stat-card-value">
          {loading ? <span className="stat-skeleton" /> : value}
        </div>
        <div className="stat-card-label">{label}</div>
      </div>
    </Link>
  );
}

export function DashboardHomeClient({ user }: DashboardHomeClientProps) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/customer/dashboard")
      .then((r) => r.json())
      .then((data) => {
        setStats(data.stats);
        setRecentActivity(data.recentActivity ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const currency = user.market === "saudi" ? "SAR" : "USD";

  return (
    <div className="dashboard-home">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Welcome back{user.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="page-subtitle">
            Here's an overview of your cloud services.
          </p>
        </div>
        <div className="page-header-actions">
          <Link href="/dashboard/rfq" className="btn btn-secondary">
            Submit RFQ
          </Link>
          <Link href="/customer/subscribe" className="btn btn-primary">
            + New Service
          </Link>
        </div>
      </div>

      {/* Customer identity strip */}
      <div className="identity-strip">
        <div className="identity-item">
          <span className="identity-label">Customer No.</span>
          <span className="identity-value identity-value--mono">
            {user.customerNumber ?? "—"}
          </span>
        </div>
        <div className="identity-sep" />
        <div className="identity-item">
          <span className="identity-label">Email</span>
          <span className="identity-value">{user.email}</span>
        </div>
        <div className="identity-sep" />
        <div className="identity-item">
          <span className="identity-label">Market</span>
          <span className="identity-value">
            {user.market === "saudi" ? "🇸🇦 Saudi Arabia · SAR" : "🌐 Global · USD"}
          </span>
        </div>
        {user.customerGroup && (
          <>
            <div className="identity-sep" />
            <div className="identity-item">
              <span className="identity-label">Group</span>
              <span className="identity-value">{user.customerGroup}</span>
            </div>
          </>
        )}
      </div>

      {/* Stats grid */}
      <div className="stats-grid">
        <StatCard
          label="Active Services"
          value={stats?.activeSubscriptions ?? 0}
          href="/dashboard/subscriptions"
          loading={loading}
          accent="success"
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          }
        />
        <StatCard
          label="Active Servers"
          value={stats?.servers ?? 0}
          href="/dashboard/servers"
          loading={loading}
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="3" width="16" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <rect x="2" y="12" width="16" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
              <circle cx="5.5" cy="14.5" r="1" fill="currentColor" />
            </svg>
          }
        />
        <StatCard
          label="Pending Invoices"
          value={stats?.pendingInvoices ?? 0}
          href="/dashboard/invoices"
          loading={loading}
          accent={
            stats?.overdueInvoices && stats.overdueInvoices > 0
              ? "danger"
              : stats?.pendingInvoices && stats.pendingInvoices > 0
              ? "warning"
              : "default"
          }
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="3" y="2" width="14" height="16" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 6h6M7 9h5M7 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
        />
        <StatCard
          label="Expiring in 30 days"
          value={stats?.expiringSubscriptions ?? 0}
          href="/dashboard/subscriptions"
          loading={loading}
          accent={
            stats?.expiringSubscriptions && stats.expiringSubscriptions > 0
              ? "warning"
              : "default"
          }
          icon={
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10 6v4.5l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
      </div>

      {/* Quick actions */}
      <div className="section-header">
        <h2 className="section-title">Quick actions</h2>
      </div>
      <div className="quick-actions">
        <Link href="/customer/subscribe" className="quick-action">
          <div className="quick-action-icon quick-action-icon--primary">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M9 2v14M2 9h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="quick-action-label">Buy a Service</div>
            <div className="quick-action-sub">Browse cloud plans</div>
          </div>
        </Link>
        <Link href="/dashboard/invoices" className="quick-action">
          <div className="quick-action-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="3" y="2" width="12" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6 6h6M6 9h5M6 12h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="quick-action-label">View Invoices</div>
            <div className="quick-action-sub">Pay or download</div>
          </div>
        </Link>
        <Link href="/dashboard/rfq" className="quick-action">
          <div className="quick-action-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M16.5 3H12a1 1 0 00-.707.293L3.293 11.293A1 1 0 003.293 12.707l2 2a1 1 0 001.414 0L14.707 6.707A1 1 0 0015 6V1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="13" cy="5" r="0.75" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="quick-action-label">Submit RFQ</div>
            <div className="quick-action-sub">Request a quote</div>
          </div>
        </Link>
        <Link href="/dashboard/quotations" className="quick-action">
          <div className="quick-action-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3 3h12a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 7h8M5 10h6M5 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="quick-action-label">Quotations</div>
            <div className="quick-action-sub">View & accept quotes</div>
          </div>
        </Link>
        <Link href="/dashboard/servers" className="quick-action">
          <div className="quick-action-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="3" width="14" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <rect x="2" y="10.5" width="14" height="4.5" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="5" cy="5.25" r="0.75" fill="currentColor" />
              <circle cx="5" cy="12.75" r="0.75" fill="currentColor" />
            </svg>
          </div>
          <div>
            <div className="quick-action-label">My Servers</div>
            <div className="quick-action-sub">Manage infrastructure</div>
          </div>
        </Link>
        <Link href="/dashboard/statement" className="quick-action">
          <div className="quick-action-icon">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <rect x="2" y="2" width="14" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5 5h4M5 8h8M5 11h8M5 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <div className="quick-action-label">Statement</div>
            <div className="quick-action-sub">Account ledger</div>
          </div>
        </Link>
      </div>

      {/* Recent activity */}
      <div className="section-header">
        <h2 className="section-title">Recent activity</h2>
        <Link href="/dashboard/invoices" className="section-link">
          View all
        </Link>
      </div>

      {loading ? (
        <div className="activity-list">
          {[1, 2, 3].map((i) => (
            <div key={i} className="activity-item activity-item--loading">
              <div className="activity-skeleton-icon" />
              <div className="activity-skeleton-body">
                <div className="activity-skeleton-line activity-skeleton-line--wide" />
                <div className="activity-skeleton-line activity-skeleton-line--narrow" />
              </div>
            </div>
          ))}
        </div>
      ) : recentActivity.length === 0 ? (
        <div className="activity-empty">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ opacity: 0.3 }}>
            <rect x="4" y="4" width="24" height="24" rx="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 12h12M10 17h8M10 22h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p>No recent documents yet.</p>
        </div>
      ) : (
        <div className="activity-list">
          {recentActivity.map((doc) => (
            <div key={doc.id} className="activity-item">
              <div className={`activity-type-badge activity-type-badge--${doc.type.toLowerCase()}`}>
                {(DOC_TYPE_LABELS[doc.type] ?? doc.type).slice(0, 3).toUpperCase()}
              </div>
              <div className="activity-body">
                <div className="activity-title">
                  {DOC_TYPE_LABELS[doc.type] ?? doc.type}{" "}
                  <span className="activity-doc-num">{doc.docNumber}</span>
                </div>
                <div className="activity-meta">
                  {doc.totalAmount != null && (
                    <span className="activity-amount">
                      {formatCurrency(doc.totalAmount, currency)}
                    </span>
                  )}
                  {doc.paymentStatus && (
                    <span className={`activity-status activity-status--${doc.paymentStatus.toLowerCase()}`}>
                      {doc.paymentStatus}
                    </span>
                  )}
                </div>
              </div>
              <div className="activity-time">{timeAgo(doc.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
