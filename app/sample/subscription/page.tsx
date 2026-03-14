"use client";

import { useState } from "react";

const MOCK_LOCATIONS = [
  { id: "loc_jed", code: "JED", name: "Jeddah", flag: "🇸🇦" },
  { id: "loc_ruh", code: "RUH", name: "Riyadh", flag: "🇸🇦" },
  { id: "loc_fra", code: "FRA", name: "Frankfurt", flag: "🇩🇪" },
  { id: "loc_ams", code: "AMS", name: "Amsterdam", flag: "🇳🇱" },
];

const MOCK_TEMPLATES = [
  { id: "tpl_01", name: "Ubuntu 22.04 LTS + cPanel" },
  { id: "tpl_02", name: "Debian 12 + Plesk" },
  { id: "tpl_03", name: "Windows Server 2022" },
  { id: "tpl_04", name: "Bare OS — Ubuntu 22.04" },
];

const BILLING_PERIODS = [
  { key: "MONTHLY",    label: "Monthly"  },
  { key: "SIX_MONTHS", label: "6 Months" },
  { key: "YEARLY",     label: "Yearly"   },
  { key: "ONE_TIME",   label: "One-time" },
];


const ALL_PLAN_SUBS = [
  { id: "sub_01jk2m3n4p", product: { name: "Cloud Server 2Core 4GB", key: "CSO-101" } },
  { id: "sub_03np4q5r6s", product: { name: "VPS Europe 2Core", key: "CSG-101" } },
];

// Addon subs keyed by parentSubscriptionId for quick lookup
function getAttachedAddons(parentId, allSubs) {
  return allSubs.filter(s => s.parentSubscriptionId === parentId);
}

// Addon subs with no parent yet (unlinked pool to attach from)
function getUnlinkedAddons(allSubs) {
  return allSubs.filter(s => s.product.type === "addon" && !s.parentSubscriptionId);
}

const MOCK_SUBS = [
  {
    id: "sub_01jk2m3n4p",
    user: { email: "ahmed@example.com", name: "Ahmed Al-Rashid" },
    product: {
      name: "Cloud Server 2Core 4GB", key: "CSO-101", type: "plan",
      category: { name: "Cloud Servers O", key: "servers-o" },
      tags: [{ id: "t1", key: "or", name: "Oracle" }, { id: "t1b", key: "server", name: "Server" }],
      billingPeriods: ["yearly"],
    },
    market: { name: "Saudi Arabia · SAR" },
    status: "ACTIVE", paymentStatus: "PAID", autoRenewal: true, activatedAt: "2025-01-15",
    currentPeriodStart: "2025-01-15", currentPeriodEnd: "2026-01-15",
    receiptUrl: "/receipts/example.pdf", provisionLocation: "Saudi Arabia - Jeddah",
    productDetails: "Ubuntu 22.04 LTS, 120GB SSD", productNote: "Customer requested daily backups.",
    servers: [{ hetznerServerId: null, oracleInstanceId: "ocid1.instance.oc1.je1.abc123" }],
    parentSubscriptionId: null,
    billingHistory: [
      { id: "bh1", period: "Jan 2025 – Jan 2026", paidAt: "2025-01-15", amount: "1200.00 SAR", receiptUrl: "/r/1.pdf", note: "Annual", paymentStatus: "PAID", isRenewal: false },
    ],
  },
  {
    id: "sub_02lm3n4p5q",
    user: { email: "sara@techco.sa", name: "Sara Mahmoud" },
    product: {
      name: "Cloud Server 1Core 2GB", key: "CSO-50", type: "plan",
      category: { name: "Cloud Servers O", key: "servers-o" },
      tags: [{ id: "t1", key: "server", name: "Server" }],
      billingPeriods: ["yearly"],
    },
    market: { name: "Saudi Arabia · SAR" },
    status: "PENDING", paymentStatus: "UNPAID", autoRenewal: false, activatedAt: null,
    currentPeriodStart: null, currentPeriodEnd: null,
    receiptUrl: null, provisionLocation: "Saudi Arabia - Riyadh",
    productDetails: "", productNote: "",
    servers: [], parentSubscriptionId: null, billingHistory: [],
  },
  {
    id: "sub_03np4q5r6s",
    user: { email: "john@globalcorp.com", name: "John Smith" },
    product: {
      name: "VPS Europe 2Core", key: "CSG-101", type: "plan",
      category: { name: "Cloud Servers G", key: "servers-g" },
      tags: [{ id: "t2", key: "vps", name: "VPS" }],
      billingPeriods: ["yearly"],
    },
    market: { name: "Global · USD" },
    status: "EXPIRED", paymentStatus: "RENEWAL_UNPAID", autoRenewal: false, activatedAt: "2025-03-01",
    currentPeriodStart: "2025-03-01", currentPeriodEnd: "2025-04-05",
    receiptUrl: null, provisionLocation: "Europe Central",
    productDetails: "Debian 12, cPanel", productNote: "",
    servers: [{ hetznerServerId: "48291037", oracleInstanceId: null }],
    parentSubscriptionId: null,
    billingHistory: [
      { id: "bh2", period: "Mar – Apr 2025", paidAt: "2025-03-01", amount: "$240.00", receiptUrl: null, note: "", paymentStatus: "RENEWAL_UNPAID", isRenewal: true },
    ],
  },
  {
    id: "sub_04qr5s6t7u",
    user: { email: "ahmed@example.com", name: "Ahmed Al-Rashid" },
    product: {
      name: "SEO Addon Pack", key: "ADDON-SEO", type: "addon",
      category: { name: "Addons", key: "addons" },
      tags: [], billingPeriods: ["yearly"],
    },
    market: { name: "Saudi Arabia · SAR" },
    status: "ACTIVE", paymentStatus: "PAID", autoRenewal: false, activatedAt: "2025-02-10",
    currentPeriodStart: "2025-02-10", currentPeriodEnd: "2026-02-10",
    receiptUrl: "/receipts/seo.pdf", provisionLocation: null,
    productDetails: "", productNote: "Linked to main hosting plan.",
    servers: [], parentSubscriptionId: "sub_01jk2m3n4p",
    billingHistory: [
      { id: "bh3", period: "Feb 2025 – Feb 2026", paidAt: "2025-02-10", amount: "200.00 SAR", receiptUrl: "/r/3.pdf", note: "", paymentStatus: "PAID", isRenewal: false },
    ],
  },
  {
    id: "sub_06uv7w8x9y",
    user: { email: "ahmed@example.com", name: "Ahmed Al-Rashid" },
    product: {
      name: "Daily Backup Addon", key: "ADDON-BCK", type: "addon",
      category: { name: "Addons", key: "addons" },
      tags: [], billingPeriods: ["yearly"],
    },
    market: { name: "Saudi Arabia · SAR" },
    status: "SUSPENDED", paymentStatus: "UNPAID", autoRenewal: false, activatedAt: "2025-03-01",
    currentPeriodStart: "2025-03-01", currentPeriodEnd: "2026-03-01",
    receiptUrl: null, provisionLocation: null,
    productDetails: "", productNote: "",
    servers: [], parentSubscriptionId: null,
    billingHistory: [],
  },
  {
    id: "sub_05st6u7v8w",
    user: { email: "layla@startup.io", name: "Layla Hassan" },
    product: {
      name: "Domain Registration .com", key: "DOMAIN-COM", type: "service",
      category: { name: "Domains", key: "domains" },
      tags: [], billingPeriods: ["one_time"],
    },
    market: { name: "Saudi Arabia · SAR" },
    status: "ACTIVE", paymentStatus: "PAID", autoRenewal: false, activatedAt: "2025-01-20",
    currentPeriodStart: null, currentPeriodEnd: null,
    receiptUrl: "/receipts/domain.pdf", provisionLocation: null,
    productDetails: "layla-startup.com", productNote: "Registered for 1 year.",
    servers: [], parentSubscriptionId: null,
    billingHistory: [
      { id: "bh4", period: "One-time", paidAt: "2025-01-20", amount: "50.00 SAR", receiptUrl: "/r/4.pdf", note: "Registration fee", paymentStatus: "PAID", isRenewal: false },
    ],
  },
  {
    id: "sub_07em8a9i0l",
    user: { email: "ahmed@example.com", name: "Ahmed Al-Rashid" },
    product: {
      name: "Cybrosoft Business Email", key: "EM-CY10", type: "plan",
      category: { name: "Email", key: "email" },
      tags: [{ id: "t5", key: "per_unit", name: "Per Unit" }],
      billingPeriods: ["yearly"],
      unitLabel: "mailbox", unitPriceCents: 1200,
    },
    market: { name: "Saudi Arabia · SAR" },
    status: "ACTIVE", paymentStatus: "PAID", autoRenewal: true, activatedAt: "2025-01-01",
    currentPeriodStart: "2025-01-01", currentPeriodEnd: "2026-01-01",
    quantity: 10, billingPeriodKey: "YEARLY",
    receiptUrl: "/receipts/email.pdf", provisionLocation: null,
    productDetails: "", productNote: "",
    servers: [], parentSubscriptionId: null,
    billingHistory: [
      { id: "bh5", period: "Jan 2025 – Jan 2026", type: "New", qty: 10, unitPrice: 12, paidAt: "2025-01-01", amount: "120.00 SAR", receiptUrl: "/r/5.pdf", note: "Initial 10 mailboxes", paymentStatus: "PAID", isRenewal: false },
    ],
  },
  {
    id: "sub_08s3b0c1d2",
    user: { email: "sara@techco.sa", name: "Sara Mahmoud" },
    product: {
      name: "Simple Storage Service S3", key: "S3", type: "plan",
      category: { name: "Storage", key: "storage" },
      tags: [{ id: "t6", key: "per_unit", name: "Per Unit" }],
      billingPeriods: ["monthly"],
      unitLabel: "GB", unitPriceCents: 200,
    },
    market: { name: "Global · USD" },
    status: "ACTIVE", paymentStatus: "PAID", autoRenewal: true, activatedAt: "2025-09-01",
    currentPeriodStart: "2025-09-01", currentPeriodEnd: "2026-09-01",
    quantity: 100, billingPeriodKey: "YEARLY",
    receiptUrl: null, provisionLocation: null,
    productDetails: "", productNote: "",
    servers: [], parentSubscriptionId: null,
    billingHistory: [
      { id: "bh6", period: "Sep 2025 – Sep 2026", type: "New", qty: 100, unitPrice: 2, paidAt: "2025-09-01", amount: "$200.00", receiptUrl: null, note: "Initial 100 GB", paymentStatus: "PAID", isRenewal: false },
    ],
  },
];

// Subscription lifecycle statuses
const SUB_STATUS_CFG = {
  PENDING:    { label: "Pending",    bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400"   },
  ACTIVE:     { label: "Active",     bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  SUSPENDED:  { label: "Suspended",  bg: "bg-orange-50",  text: "text-orange-700",  dot: "bg-orange-400"  },
  EXPIRED:    { label: "Expired",    bg: "bg-gray-100",   text: "text-gray-500",    dot: "bg-gray-400"    },
  CANCELLED:  { label: "Cancelled",  bg: "bg-red-50",     text: "text-red-600",     dot: "bg-red-400"     },
};

// Payment statuses (per bill)
const PAY_STATUS_CFG = {
  UNPAID:           { label: "Unpaid",               bg: "bg-red-50",     text: "text-red-600"     },
  PAID:             { label: "Paid",                 bg: "bg-green-50",   text: "text-green-700"   },
  RENEWAL_UNPAID:   { label: "Renewal: Unpaid",      bg: "bg-orange-50",  text: "text-orange-700"  },
  RENEWAL_PAID:     { label: "Renewal: Paid",        bg: "bg-green-50",   text: "text-green-700"   },
};

// Legacy alias
const STATUS_CFG = SUB_STATUS_CFG;

const TYPE_CFG = {
  plan:    "bg-blue-50 text-blue-700 border-blue-200",
  addon:   "bg-purple-50 text-purple-700 border-purple-200",
  service: "bg-amber-50 text-amber-700 border-amber-200",
  product: "bg-green-50 text-green-700 border-green-200",
};

function StatusBadge({ status }) {
  const c = SUB_STATUS_CFG[status] ?? SUB_STATUS_CFG.PENDING;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${c.bg} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function PaymentBadge({ status }) {
  const c = PAY_STATUS_CFG[status] ?? PAY_STATUS_CFG.UNPAID;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold border-current/20 ${c.bg} ${c.text}`}>
      {status === "PAID" || status === "RENEWAL_PAID" ? "✓ " : "○ "}{c.label}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TYPE_CFG[type] ?? TYPE_CFG.plan}`}>
      {(type ?? "plan").charAt(0).toUpperCase() + (type ?? "plan").slice(1)}
    </span>
  );
}

function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso) - new Date()) / 86400000);
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function isOneTime(sub) {
  const bp = sub.product.billingPeriods ?? [];
  return bp.length === 1 && bp[0] === "one_time";
}

function isPerUnit(sub) {
  return (sub.product.tags ?? []).some(t => t.key === "per_unit");
}

function daysRemaining(periodEnd) {
  if (!periodEnd) return 0;
  return Math.max(0, Math.ceil((new Date(periodEnd) - new Date()) / 86400000));
}

function totalPeriodDays(periodStart, periodEnd) {
  if (!periodStart || !periodEnd) return 365;
  return Math.max(1, Math.ceil((new Date(periodEnd) - new Date(periodStart)) / 86400000));
}

function proRatedCost(unitPriceCents, qty, periodStart, periodEnd) {
  const remaining = daysRemaining(periodEnd);
  const total = totalPeriodDays(periodStart, periodEnd);
  return +((unitPriceCents / 100) * qty * (remaining / total)).toFixed(2);
}

const MOCK_CATALOG_ADDONS = [
  { id: "prod_addon_seo",     name: "SEO Addon Pack",       key: "ADDON-SEO",  addonPricingType: "fixed",      price: 200,   currency: "SAR", billingPeriod: "YEARLY",  description: "SEO tools and analytics dashboard." },
  { id: "prod_addon_storage", name: "Extra Block Storage",  key: "ADDON-STOR", addonPricingType: "per_unit",   unitPrice: 2.50, unitLabel: "GB", minUnits: 10, maxUnits: 500, currency: "SAR", billingPeriod: "MONTHLY", description: "Expandable SSD block storage attached to your server." },
  { id: "prod_addon_support", name: "Managed Support",      key: "ADDON-SUP",  addonPricingType: "percentage", percentage: 20, currency: "SAR", billingPeriod: "YEARLY",  description: "24/7 managed support — priced as % of your plan." },
  { id: "prod_addon_ddos",    name: "DDoS Protection",      key: "ADDON-DDOS", addonPricingType: "fixed",      price: 350,   currency: "SAR", billingPeriod: "YEARLY",  description: "Layer 3/4/7 DDoS mitigation." },
  { id: "prod_addon_bck",     name: "Daily Backup Addon",   key: "ADDON-BCK",  addonPricingType: "fixed",      price: 120,   currency: "SAR", billingPeriod: "YEARLY",  description: "Automated daily snapshots with 30-day retention." },
];

function fmtPrice(amount, currency = "SAR") {
  return `${Number(amount).toFixed(2)} ${currency}`;
}

function getPriceLabel(addon) {
  if (addon.addonPricingType === "fixed")      return `${fmtPrice(addon.price, addon.currency)} / ${addon.billingPeriod === "MONTHLY" ? "mo" : "yr"}`;
  if (addon.addonPricingType === "per_unit")   return `${fmtPrice(addon.unitPrice, addon.currency)} / ${addon.unitLabel} / mo`;
  if (addon.addonPricingType === "percentage") return `${addon.percentage}% of plan`;
  return "—";
}

function getPriceBadgeCls(type) {
  if (type === "fixed")      return "border-blue-200 bg-blue-50 text-blue-700";
  if (type === "per_unit")   return "border-orange-200 bg-orange-50 text-orange-700";
  if (type === "percentage") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function getPriceTypeLabel(type) {
  if (type === "fixed")      return "Fixed";
  if (type === "per_unit")   return "Per Unit";
  if (type === "percentage") return "% of Plan";
  return type;
}

function isServerProduct(sub) {
  const tags = (sub.product.tags ?? []).map(t => t.key);
  return (tags.includes("vps") || tags.includes("server"));
}

function getServerTag(sub) {
  const tags = sub.product.tags ?? [];
  const vps    = tags.find(t => t.key === "vps");
  const server = tags.find(t => t.key === "server");
  if (vps)    return { label: "VPS",    color: "bg-cyan-50 text-cyan-700 border-cyan-200",     icon: "🖥️" };
  if (server) return { label: "Server", color: "bg-indigo-50 text-indigo-700 border-indigo-200", icon: "🗄️" };
  return null;
}

// ── Billing Tab ───────────────────────────────────────────────────────────────
function BillingTab({ sub }) {
  const oneTime  = isOneTime(sub);
  const perUnit  = isPerUnit(sub);
  const [start,          setStart]          = useState(sub.currentPeriodStart?.slice(0,10) ?? "");
  const [end,            setEnd]            = useState(sub.currentPeriodEnd?.slice(0,10) ?? "");
  const [payDate,        setPayDate]        = useState(sub.activatedAt?.slice(0,10) ?? "");
  const [amount,         setAmount]         = useState("");
  const [note,           setNote]           = useState("");
  const [billingPeriod,  setBillingPeriod]  = useState("YEARLY");
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [customAmount,   setCustomAmount]   = useState("");
  const [saved,          setSaved]          = useState(false);
  const [autoRenewal,    setAutoRenewal]    = useState(sub.autoRenewal ?? false);
  // Quantity upgrade state
  const [currentQty,    setCurrentQty]    = useState(sub.quantity ?? 1);
  const [showUpgrade,   setShowUpgrade]   = useState(false);
  const [addQty,        setAddQty]        = useState(1);
  const [upgradeNote,   setUpgradeNote]   = useState("");
  const [upgradeSaved,  setUpgradeSaved]  = useState(false);
  const cs = sub.market?.name?.includes("SAR") ? "﷼" : "$";
  const d = daysUntil(sub.currentPeriodEnd);
  const urgent = !oneTime && sub.status === "ACTIVE" && d !== null && d <= 30;
  const unitPriceCents = sub.product.unitPriceCents ?? 0;
  const unitLabel      = sub.product.unitLabel ?? "unit";
  const upgradeCharge  = perUnit ? proRatedCost(unitPriceCents, addQty, sub.currentPeriodStart, sub.currentPeriodEnd) : 0;
  const remaining      = daysRemaining(sub.currentPeriodEnd);
  const totalDays      = totalPeriodDays(sub.currentPeriodStart, sub.currentPeriodEnd);

  function handleUpgrade() {
    setUpgradeSaved(true);
    setCurrentQty(q => q + addQty);
    setShowUpgrade(false);
    setTimeout(() => { setUpgradeSaved(false); setAddQty(1); setUpgradeNote(""); }, 2000);
  }

  return (
    <div className="space-y-4">
      {urgent && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-base">⚠️</span>
          <div>
            <div className="text-sm font-semibold text-amber-800">Renewal due in {d} day{d !== 1 ? "s" : ""}</div>
            <div className="text-xs text-amber-600 mt-0.5">Once payment received, set new end date and click Save. It will be added to billing history.</div>
          </div>
        </div>
      )}
      {oneTime && (
        <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <span>🏷️</span>
          <div>
            <div className="text-sm font-semibold text-gray-700">One-time payment product</div>
            <div className="text-xs text-gray-500">No subscription period. Record payment date and amount only.</div>
          </div>
        </div>
      )}

      {!oneTime && sub.currentPeriodStart && sub.currentPeriodEnd && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Current Period</span>
            {sub.status === "ACTIVE" && d !== null && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d <= 7 ? "bg-red-100 text-red-700" : d <= 30 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {d}d remaining
              </span>
            )}
          </div>
          <div className="relative h-2 w-full rounded-full bg-gray-200 mb-1">
            {(() => {
              const total = new Date(sub.currentPeriodEnd) - new Date(sub.currentPeriodStart);
              const elapsed = new Date() - new Date(sub.currentPeriodStart);
              const pct = Math.min(100, Math.max(0, (elapsed/total)*100));
              const color = pct > 90 ? "bg-red-400" : pct > 70 ? "bg-amber-400" : "bg-emerald-400";
              return <div className={`h-2 rounded-full ${color}`} style={{ width: `${pct}%` }} />;
            })()}
          </div>
          <div className="flex justify-between text-[10px] text-gray-400">
            <span>{fmtDate(sub.currentPeriodStart)}</span>
            <span>{fmtDate(sub.currentPeriodEnd)}</span>
          </div>
        </div>
      )}

      {/* ── Quantity Card (per_unit products only) ── */}
      {perUnit && (
        <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">📦</span>
              <span className="text-sm font-semibold text-violet-800">Quantity</span>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 border border-violet-200 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700">
              {currentQty} {unitLabel}{currentQty !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-violet-600">
            <span>{currentQty} × {cs}{(unitPriceCents/100).toFixed(2)}/{unitLabel}/yr = <strong>{cs}{((unitPriceCents/100)*currentQty).toFixed(2)}/yr</strong></span>
            {sub.status === "ACTIVE" && (
              <button onClick={() => setShowUpgrade(v => !v)}
                className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-50 transition-colors">
                {showUpgrade ? "Cancel" : "+ Add More"}
              </button>
            )}
          </div>

          {showUpgrade && (
            <div className="rounded-xl border border-violet-200 bg-white p-4 space-y-3">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Add Units — Pro-rated</div>
              <div className="rounded-lg bg-violet-50 px-3 py-2.5 text-xs text-violet-700 space-y-1">
                <div className="font-semibold">How it's calculated:</div>
                <div className="text-violet-600">New units are charged only for the remaining period, then renew at full price with the base plan.</div>
                <div className="mt-1 font-mono text-[11px] bg-white rounded px-2 py-1 text-violet-800">
                  {addQty} {unitLabel}{addQty !== 1 ? "s" : ""} × {cs}{(unitPriceCents/100).toFixed(2)}/yr × ({remaining}/{totalDays} days) = <strong>{cs}{upgradeCharge}</strong>
                </div>
              </div>
              <div className="flex items-end gap-3">
                <div className="space-y-1 flex-1">
                  <label className="text-[11px] font-medium text-gray-500">Additional {unitLabel}s</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setAddQty(Math.max(1, addQty - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 font-bold">−</button>
                    <input type="number" min={1} value={addQty} onChange={e => setAddQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 rounded-lg border border-gray-200 px-3 py-1.5 text-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-violet-300" />
                    <button onClick={() => setAddQty(addQty + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 font-bold">+</button>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-2 text-right">
                  <div className="text-[10px] text-gray-400">Current → New</div>
                  <div className="text-sm font-bold text-gray-800">{currentQty} → {currentQty + addQty} {unitLabel}s</div>
                  <div className="text-[11px] text-violet-600 font-semibold">Bill: {cs}{upgradeCharge}</div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-500">Note</label>
                <input value={upgradeNote} onChange={e => setUpgradeNote(e.target.value)}
                  placeholder={`e.g. Customer requested +${addQty} ${unitLabel}s`}
                  className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-300" />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-gray-900 px-4 py-2.5">
                <span className="text-xs text-gray-400">Pro-rated · {remaining} of {totalDays} days remaining</span>
                <span className="text-sm font-bold text-white">{cs}{upgradeCharge} {sub.market?.name?.includes("SAR") ? "SAR" : "USD"}</span>
              </div>
              <div className="flex justify-end">
                <button onClick={handleUpgrade}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700">
                  {upgradeSaved ? "✓ Upgraded" : `Upgrade to ${currentQty + addQty} ${unitLabel}s`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <span className="mb-3 block text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          {oneTime ? "Payment Record" : "Update Billing"}
        </span>
        <div className={`grid gap-3 ${oneTime ? "grid-cols-2" : "grid-cols-3"}`}>
          {!oneTime && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-500">Start Date</label>
              <input type="date" value={start} onChange={e => setStart(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
          )}
          {!oneTime && (
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-500">End Date</label>
              <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Payment Date</label>
            <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Amount Paid</label>
            <input placeholder="e.g. 1200.00 SAR" value={amount} onChange={e => setAmount(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
        </div>
        <div className="mt-3 space-y-1">
          <label className="text-[11px] font-medium text-gray-500">Note <span className="text-gray-400">(stored in history)</span></label>
          <input placeholder="e.g. Annual renewal, bank transfer ref #123" value={note} onChange={e => setNote(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" />
        </div>
      </div>

      {/* ── Billing Period ── */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <span className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400">Billing Period</span>
        <div className="grid grid-cols-4 gap-2">
          {BILLING_PERIODS.map(p => (
            <button key={p.key} type="button" onClick={() => setBillingPeriod(p.key)}
              className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                billingPeriod === p.key
                  ? "border-gray-900 bg-gray-900 text-white shadow-sm"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Custom Price Override ── */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400">Custom Price Override</span>
            <p className="mt-0.5 text-[11px] text-gray-400">Override the catalog price for this subscription only.</p>
          </div>
          <button type="button" onClick={() => setUseCustomPrice(v => !v)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              useCustomPrice ? "bg-gray-900" : "bg-gray-200"
            }`}>
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${
              useCustomPrice ? "translate-x-4" : "translate-x-0"
            }`} />
          </button>
        </div>
        {useCustomPrice ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
              <span className="text-sm">⚠️</span>
              <p className="text-[11px] text-amber-700">Overrides catalog price for this subscription only. Group/market pricing is ignored.</p>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-gray-500">
                Custom Amount <span className="text-gray-400">({BILLING_PERIODS.find(p => p.key === billingPeriod)?.label ?? billingPeriod})</span>
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-gray-300">
                <span className="text-sm text-gray-400">{cs}</span>
                <input type="number" min={0} step={0.01} value={customAmount} onChange={e => setCustomAmount(e.target.value)}
                  placeholder="0.00" className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none" />
                <span className="text-xs text-gray-400">{sub.market?.name?.includes("SAR") ? "SAR" : "USD"}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2.5">
            <span className="text-sm">✅</span>
            <p className="text-[11px] text-green-700">Using standard catalog price for this customer's market and group.</p>
          </div>
        )}
      </div>

      {/* ── Auto-renewal toggle ── */}
      {!oneTime && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400">Auto-Renewal</span>
              <p className="mt-0.5 text-[11px] text-gray-400">When enabled, a renewal bill is auto-generated when this subscription expires.</p>
            </div>
            <button type="button" onClick={() => setAutoRenewal(v => !v)}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${autoRenewal ? "bg-emerald-500" : "bg-gray-200"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${autoRenewal ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>
          {autoRenewal && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
              <span className="text-sm">🔄</span>
              <p className="text-[11px] text-emerald-700">A <strong>Renewal: Unpaid</strong> bill will be auto-generated on expiry. Admin still needs to approve activation after payment.</p>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <span className="mb-3 block text-[11px] font-semibold uppercase tracking-widest text-gray-400">Receipt</span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
            {sub.receiptUrl ? "Re-upload" : "Upload Receipt"}
            <input type="file" className="hidden" accept=".pdf,.png,.jpg" />
          </label>
          {sub.receiptUrl
            ? <a href={sub.receiptUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-gray-50">View PDF ↗</a>
            : <span className="text-xs text-gray-400">No receipt yet</span>}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-400">Saving adds a new entry to billing history visible to customer.</p>
        <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
          className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700">
          {saved ? "✓ Saved" : sub.status === "ACTIVE" ? "Update & Record" : "Approve & Activate"}
        </button>
      </div>

      {sub.billingHistory?.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-100">
          <div className="bg-gray-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
            Billing History — visible to customer
          </div>
          <table className="min-w-full text-xs">
            <thead className="border-b text-[11px] text-gray-400">
              <tr>
                {["Period","Type","Qty","Unit Price","Amount","Paid On","Note","Receipt"].map(h => (
                  <th key={h} className="px-4 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {sub.billingHistory.map(h => (
                <tr key={h.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-700">{h.period}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      h.type === "Upgrade" ? "bg-violet-50 text-violet-600" :
                      h.isRenewal ? "bg-blue-50 text-blue-600" : "bg-gray-100 text-gray-500"
                    }`}>{h.type ?? (h.isRenewal ? "Renewal" : "New")}</span>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{h.qty != null ? `${h.qty > 0 ? "+" : ""}${h.qty}` : "—"}</td>
                  <td className="px-4 py-2 text-gray-500">{h.unitPrice != null ? `${cs}${h.unitPrice}` : "—"}</td>
                  <td className="px-4 py-2 font-semibold text-gray-800">{h.amount}</td>
                  <td className="px-4 py-2 text-gray-500">{fmtDate(h.paidAt)}</td>
                  <td className="px-4 py-2 text-gray-400">{h.note || "—"}</td>
                  <td className="px-4 py-2">
                    {h.receiptUrl
                      ? <a href={h.receiptUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">PDF ↗</a>
                      : <span className="text-gray-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── VPS Tab ───────────────────────────────────────────────────────────────────
function VpsTab({ sub }) {
  const tag = getServerTag(sub);
  const server = sub.servers[0];
  const hasServer = sub.servers.length > 0;
  // Detect provider from product tags — not from server record (server may not exist yet)
  const productTags = (sub.product.tags ?? []).map(t => t.key);
  const isOracle  = productTags.includes("or") && (productTags.includes("vps") || productTags.includes("server"));
  const isHetzner = productTags.includes("hz") && (productTags.includes("vps") || productTags.includes("server"));
  // Oracle fields
  const [oracleInstanceId,      setOracleInstanceId]      = useState(server?.oracleInstanceId ?? "");
  const [oracleInstanceRegion,  setOracleInstanceRegion]  = useState(server?.oracleInstanceRegion ?? "");
  const [oracleCompartmentOcid, setOracleCompartmentOcid] = useState(server?.oracleCompartmentOcid ?? "");
  // Hetzner fields
  const [hetznerServerId, setHetznerServerId] = useState(server?.hetznerServerId ?? "");
  const [hetznerApiToken, setHetznerApiToken] = useState("");
  const [locationId,  setLocationId]  = useState("");
  const [templateId,  setTemplateId]  = useState("");
  const [saved,       setSaved]       = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tag.color}`}>
          {tag.icon} {tag.label}
        </span>
        <span className="text-xs text-gray-400">Tagged as <strong>{tag.label}</strong> — {isOracle ? "Oracle Cloud" : isHetzner ? "Hetzner managed" : "Dedicated"}</span>
      </div>

      {hasServer && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="text-lg">✅</span>
          <div>
            <div className="text-sm font-semibold text-emerald-800">{tag.label} assigned</div>
            <div className="font-mono text-xs text-emerald-600">
              {isOracle ? `OCID: ${server.oracleInstanceId}` : `Hetzner ID: ${server.hetznerServerId}`}
            </div>
          </div>
          <a href="#" className="ml-auto rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50">
            View in Servers ↗
          </a>
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <span className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400">{tag.label} Assignment</span>
        <p className="text-[11px] text-gray-400">Blank fields won't clear existing values. Submit only what you want to update.</p>

        {isOracle && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Oracle Instance OCID</label>
              <textarea rows={2} value={oracleInstanceId} onChange={e => setOracleInstanceId(e.target.value)}
                placeholder="ocid1.instance.oc1.je1.abc..."
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Oracle Instance Region</label>
              <textarea rows={2} value={oracleInstanceRegion} onChange={e => setOracleInstanceRegion(e.target.value)}
                placeholder="e.g. me-jeddah-1"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Compartment OCID</label>
              <textarea rows={2} value={oracleCompartmentOcid} onChange={e => setOracleCompartmentOcid(e.target.value)}
                placeholder="ocid1.compartment.oc1..abc..."
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
              <span className="text-xs">🔑</span>
              <p className="text-[11px] text-amber-700">Oracle API credentials (tenancy, user, fingerprint, key) are managed in server environment variables.</p>
            </div>
          </>
        )}

        {isHetzner && (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">Hetzner Server ID</label>
              <textarea rows={2} value={hetznerServerId} onChange={e => setHetznerServerId(e.target.value)}
                placeholder="e.g. 48291037"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-500">API Token <span className="text-gray-400 font-normal">(write-only — never shown again)</span></label>
              <textarea rows={2} type="password" value={hetznerApiToken} onChange={e => setHetznerApiToken(e.target.value)}
                placeholder="Paste Hetzner API token…"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
          </>
        )}

        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
          <span className="text-xs text-gray-400">Location:</span>
          <span className="text-sm text-gray-700">{sub.provisionLocation ?? "—"}</span>
        </div>
      </div>

      {/* ── Location ── */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <span className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400">Location</span>
        <p className="text-[11px] text-gray-400">Where this subscription will be provisioned.</p>
        <select value={locationId} onChange={e => setLocationId(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
          <option value="">— Select location —</option>
          {MOCK_LOCATIONS.map(l => (
            <option key={l.id} value={l.id}>{l.flag} {l.name} · {l.code}</option>
          ))}
        </select>
      </div>

      {/* ── Template ── */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <span className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400">Template</span>
        <p className="text-[11px] text-gray-400">OS / software stack to provision for this subscription.</p>
        <select value={templateId} onChange={e => setTemplateId(e.target.value)}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
          <option value="">— Select template —</option>
          {MOCK_TEMPLATES.map(t => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="flex justify-end">
        <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
          className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700">
          {saved ? "✓ Saved" : hasServer ? `Update ${tag.label}` : `Assign ${tag.label}`}
        </button>
      </div>
    </div>
  );
}

// ── Details Tab ───────────────────────────────────────────────────────────────
function DetailsTab({ sub }) {
  const isAddon = sub.product.type === "addon";
  const [details, setDetails] = useState(sub.productDetails ?? "");
  const [note, setNote]       = useState(sub.productNote ?? "");
  const [parentId, setParentId] = useState(sub.parentSubscriptionId ?? "");
  const [saved, setSaved] = useState(false);
  const parentSub = ALL_PLAN_SUBS.find(p => p.id === parentId);

  return (
    <div className="space-y-4">
      {isAddon && (
        <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
          <div className="mb-2 flex items-center gap-2">
            <span>🔗</span>
            <span className="text-sm font-semibold text-purple-800">Link to Plan Subscription</span>
          </div>
          <p className="mb-3 text-xs text-purple-600">
            This addon must be linked to the customer's active plan subscription. It will appear nested under that plan on their dashboard.
          </p>
          <select value={parentId} onChange={e => setParentId(e.target.value)}
            className="w-full rounded-lg border border-purple-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300">
            <option value="">— Select plan subscription —</option>
            {ALL_PLAN_SUBS.map(p => (
              <option key={p.id} value={p.id}>{p.product.name} ({p.product.key}) · {p.id}</option>
            ))}
          </select>
          {parentSub && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-purple-100 bg-white px-3 py-2">
              <span className="text-[11px] text-purple-400">Linked to:</span>
              <span className="text-xs font-semibold text-purple-800">{parentSub.product.name}</span>
              <span className="font-mono text-[10px] text-purple-300 ml-auto">{parentSub.id}</span>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <span className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400">Customer-Visible Content</span>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Details</label>
          <textarea value={details} onChange={e => setDetails(e.target.value)} rows={3} placeholder="e.g. domain, OS, requirements…"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Note</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Extra instructions, configuration…"
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-300" />
        </div>
      </div>
      <div className="flex justify-end">
        <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
          className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700">
          {saved ? "✓ Saved" : "Save Details"}
        </button>
      </div>
    </div>
  );
}

// ── Renewal Tab ───────────────────────────────────────────────────────────────
function RenewalTab({ sub }) {
  const d = daysUntil(sub.currentPeriodEnd);
  const [newEnd, setNewEnd] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-100 bg-white p-4 space-y-3">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">How Manual Renewal Works</div>
        {[
          { n:"1", t:"Customer pays",         d:"Customer sends payment (bank transfer, etc.)" },
          { n:"2", t:"Admin gets notified",    d:"You check the subscriptions list — expiring ones highlighted in amber/red" },
          { n:"3", t:"Upload receipt",         d:"Go to Billing tab → upload the payment receipt" },
          { n:"4", t:"Set new period dates",   d:"Update Start & End dates in Billing tab" },
          { n:"5", t:"Save & record",          d:"Click 'Update & Record' → auto-added to billing history for customer" },
        ].map(s => (
          <div key={s.n} className="flex items-start gap-3">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-white">{s.n}</span>
            <div>
              <div className="text-xs font-semibold text-gray-700">{s.t}</div>
              <div className="text-[11px] text-gray-400">{s.d}</div>
            </div>
          </div>
        ))}
      </div>

      {sub.status === "ACTIVE" && sub.currentPeriodEnd && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Quick Extend</span>
            {d !== null && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d <= 7 ? "bg-red-100 text-red-700" : d <= 30 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                {d}d left
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500">Current end: <strong>{fmtDate(sub.currentPeriodEnd)}</strong>. Set new end date:</p>
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-medium text-gray-500">New End Date</label>
              <input type="date" value={newEnd} onChange={e => setNewEnd(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" />
            </div>
            {["+1y","+6m","+1m"].map(lbl => (
              <button key={lbl} onClick={() => {
                const base = new Date(sub.currentPeriodEnd);
                if (lbl==="+1y") base.setFullYear(base.getFullYear()+1);
                if (lbl==="+6m") base.setMonth(base.getMonth()+6);
                if (lbl==="+1m") base.setMonth(base.getMonth()+1);
                setNewEnd(base.toISOString().slice(0,10));
              }} className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50">
                {lbl}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <button disabled={!newEnd} onClick={() => { setSent(true); setTimeout(() => setSent(false), 2000); }}
              className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-40">
              {sent ? "✓ Extended" : "Apply Extension"}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Notify Customer</div>
        <p className="mb-3 text-xs text-gray-500">Send a renewal reminder email to the customer.</p>
        <button className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50">
          📧 Send Renewal Reminder
        </button>
      </div>
    </div>
  );
}

// ── Status Tab ────────────────────────────────────────────────────────────────
function StatusTab({ sub, onStatusChange }) {
  const [comment,   setComment]   = useState("");
  const [cancelComment, setCancelComment] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [done,      setDone]      = useState("");

  const s = sub.status;

  const ACTION_MAP = {
    PENDING:   { label: "Approve & Activate", icon: "✅", next: "ACTIVE",    cls: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    ACTIVE:    { label: "Suspend",            icon: "⏸",  next: "SUSPENDED", cls: "bg-orange-500 hover:bg-orange-600 text-white"  },
    SUSPENDED: { label: "Reactivate",         icon: "▶️",  next: "ACTIVE",    cls: "bg-emerald-600 hover:bg-emerald-700 text-white" },
    EXPIRED:   null,
    CANCELLED: null,
  };

  const action = ACTION_MAP[s];

  function applyAction() {
    setDone(action.next);
    setTimeout(() => setDone(""), 2500);
    setComment("");
  }

  function applyCancel() {
    setDone("CANCELLED");
    setTimeout(() => setDone(""), 2500);
    setConfirmCancel(false);
    setCancelComment("");
  }

  return (
    <div className="space-y-4">

      {/* Current status overview */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Current Status</div>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Subscription</div>
            <StatusBadge status={done || s} />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Payment</div>
            <PaymentBadge status={sub.paymentStatus ?? "UNPAID"} />
          </div>
          {sub.activatedAt && (
            <div className="space-y-1">
              <div className="text-[10px] text-gray-400 font-medium uppercase tracking-wide">Activated</div>
              <div className="text-xs font-semibold text-gray-700">{fmtDate(sub.activatedAt)}</div>
            </div>
          )}
        </div>
      </div>

      {done && done !== "CANCELLED" && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-semibold text-green-700">
          ✓ Status updated to {done}
        </div>
      )}
      {done === "CANCELLED" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-700">
          ✓ Subscription cancelled
        </div>
      )}

      {/* ── Primary action (Approve / Suspend / Reactivate) ── */}
      {action && (s !== "CANCELLED") && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Change Status</div>

          {s === "PENDING" && (
            <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
              <span className="text-sm">ℹ️</span>
              <p className="text-[11px] text-blue-700">
                Activating does not affect payment status. You can activate before receiving payment — bill will remain unpaid until recorded in the Billing tab.
              </p>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Comment <span className="text-gray-400">(optional — stored in audit log)</span></label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={2}
              placeholder={
                s === "PENDING"   ? "e.g. Activated before payment — trusted customer" :
                s === "ACTIVE"    ? "e.g. Suspended due to AUP violation" :
                                    "e.g. Customer settled outstanding balance"
              }
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>

          <div className="flex justify-end">
            <button onClick={applyAction}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${action.cls}`}>
              <span>{action.icon}</span> {action.label}
            </button>
          </div>
        </div>
      )}

      {/* ── EXPIRED notice ── */}
      {s === "EXPIRED" && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 flex items-start gap-3">
          <span className="text-xl">⌛</span>
          <div>
            <div className="text-sm font-semibold text-gray-600">Subscription Expired</div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Period ended. To reactivate, trigger a renewal from the Billing tab — a new unpaid bill will be generated and you can approve from here once payment is sorted.
            </p>
          </div>
        </div>
      )}

      {/* ── Cancel section (always shown, except already cancelled) ── */}
      {s !== "CANCELLED" && (
        <div className="rounded-xl border border-red-100 bg-red-50/50 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span>🚫</span>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-red-500">Cancel Subscription</span>
          </div>
          <p className="text-[11px] text-red-500">Immediately cancels. Customer loses access. Cannot be auto-reversed.</p>
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-red-400">Reason <span className="text-red-300">(optional)</span></label>
            <textarea value={cancelComment} onChange={e => setCancelComment(e.target.value)} rows={2}
              placeholder="e.g. Non-payment, customer requested cancellation…"
              className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-red-200" />
          </div>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={confirmCancel} onChange={e => setConfirmCancel(e.target.checked)} className="rounded" />
            <span className="text-xs text-red-600">I understand this cancels the subscription immediately.</span>
          </label>
          <div className="flex justify-end">
            <button disabled={!confirmCancel} onClick={applyCancel}
              className="rounded-lg border border-red-300 bg-red-100 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-200 disabled:opacity-40 transition-colors">
              Cancel Subscription
            </button>
          </div>
        </div>
      )}

      {s === "CANCELLED" && (
        <div className="flex flex-col items-center justify-center py-8 text-center gap-2">
          <div className="text-3xl">🚫</div>
          <div className="text-sm font-semibold text-gray-500">Subscription Cancelled</div>
          <div className="text-xs text-gray-400">No further actions available.</div>
        </div>
      )}
    </div>
  );
}




// ── Subscribe Modal ──────────────────────────────────────────────────────────
function AddonSubscribeModal({ addon, sub, onClose, onDone }) {
  const [billingPeriod, setBillingPeriod] = useState("YEARLY");
  const [units,         setUnits]         = useState(addon.minUnits ?? 10);
  const [startDate,     setStartDate]     = useState(new Date().toISOString().slice(0, 10));
  const [done,          setDone]          = useState(false);

  const isPerUnit = addon.addonPricingType === "per_unit";
  const isPercent = addon.addonPricingType === "percentage";
  const periodMult = billingPeriod === "MONTHLY" ? 1 : billingPeriod === "SIX_MONTHS" ? 6 : 12;
  const planYearlyPrice = sub.billingHistory?.[0] ? parseFloat(sub.billingHistory[0].amount) : 1200;
  const cs = sub.market?.name?.includes("SAR") ? "﷼" : "$";

  // Pro-rating: if parent sub is ACTIVE with a period, addon is pro-rated to match parent expiry
  const parentIsActive = sub.status === "ACTIVE" && sub.currentPeriodEnd && sub.currentPeriodStart;
  const parentRemaining = parentIsActive ? daysRemaining(sub.currentPeriodEnd) : null;
  const parentTotal     = parentIsActive ? totalPeriodDays(sub.currentPeriodStart, sub.currentPeriodEnd) : null;
  const proRateFraction = parentIsActive ? (parentRemaining / parentTotal) : 1;
  const addonExpiry     = parentIsActive ? sub.currentPeriodEnd : null;

  let fullYearPrice = null, computedTotal = null, computedMonthly = null;
  if (!isPercent) {
    const base  = isPerUnit ? (Math.min(Math.max(units, addon.minUnits ?? 1), addon.maxUnits ?? 999) * addon.unitPrice) : addon.price;
    computedMonthly = isPerUnit ? base : (addon.billingPeriod === "MONTHLY" ? base : base / 12);
    fullYearPrice   = isPerUnit ? base * 12 : addon.price;
    computedTotal   = parentIsActive ? +(fullYearPrice * proRateFraction).toFixed(2) : (isPerUnit ? base * periodMult : addon.price);
  } else {
    computedMonthly = (planYearlyPrice / 12) * (addon.percentage / 100);
    fullYearPrice   = computedMonthly * 12;
    computedTotal   = parentIsActive ? +(fullYearPrice * proRateFraction).toFixed(2) : fullYearPrice;
  }

  function handleCreate() {
    setDone(true);
    setTimeout(() => { onDone(); onClose(); }, 900);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <div className="text-base font-bold text-gray-900">{addon.name}</div>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="font-mono text-[11px] text-gray-400">{addon.key}</span>
              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getPriceBadgeCls(addon.addonPricingType)}`}>
                {getPriceTypeLabel(addon.addonPricingType)}
              </span>
              {parentIsActive && (
                <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-700">
                  Pro-rated
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        <div className="space-y-4 px-6 py-5 max-h-[70vh] overflow-y-auto">
          {/* Pre-fill */}
          <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 space-y-1.5">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-blue-400 mb-1">Pre-filled from parent subscription</div>
            {[
              ["Customer",    sub.user.name + " · " + sub.user.email],
              ["Market",      sub.market.name],
              ["Linked plan", sub.product.name + " (" + sub.product.key + ")"],
              ...(parentIsActive ? [["Addon expiry", fmtDate(addonExpiry) + " (matches parent)"]] : []),
            ].map(([label, val]) => (
              <div key={label} className="flex items-center justify-between text-[11px]">
                <span className="text-blue-400 font-medium">{label}</span>
                <span className="font-semibold text-blue-800">{val}</span>
              </div>
            ))}
          </div>

          {/* Pro-rating explanation */}
          {parentIsActive && (
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 space-y-2">
              <div className="flex items-center gap-2">
                <span>📐</span>
                <span className="text-[11px] font-semibold text-violet-800">Pro-rated to match parent plan</span>
              </div>
              <p className="text-[11px] text-violet-600">
                This addon is being added mid-cycle. It will be charged only for the remaining period of the parent plan,
                then renew at full price alongside it.
              </p>
              <div className="font-mono text-[11px] bg-white rounded-lg border border-violet-200 px-3 py-2 text-violet-800 space-y-1">
                <div>{cs}{fullYearPrice?.toFixed(2)} full price × ({parentRemaining}/{parentTotal} days) = <strong>{cs}{computedTotal?.toFixed(2)}</strong></div>
                <div className="text-violet-400">Renews: {fmtDate(addonExpiry)} · Full price: {cs}{fullYearPrice?.toFixed(2)}/yr</div>
              </div>
            </div>
          )}

          {/* Per Unit */}
          {isPerUnit && (
            <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-orange-600">Quantity</span>
                <span className="text-[11px] text-orange-500">{addon.minUnits}–{addon.maxUnits} {addon.unitLabel}</span>
              </div>
              <div className="flex items-center gap-3">
                <input type="range" min={addon.minUnits} max={addon.maxUnits} step={10}
                  value={units} onChange={e => setUnits(Number(e.target.value))}
                  className="flex-1 accent-orange-500" />
                <div className="flex items-center gap-1 rounded-lg border border-orange-200 bg-white px-2 py-1.5">
                  <input type="number" min={addon.minUnits} max={addon.maxUnits}
                    value={units} onChange={e => setUnits(Math.min(Math.max(Number(e.target.value), addon.minUnits), addon.maxUnits))}
                    className="w-16 bg-transparent text-sm font-bold text-orange-700 text-right focus:outline-none" />
                  <span className="text-xs text-orange-400">{addon.unitLabel}</span>
                </div>
              </div>
              <div className="rounded-lg border border-orange-200 bg-white px-3 py-2 flex items-center justify-between">
                <span className="text-[11px] text-gray-500">{units} {addon.unitLabel} × {fmtPrice(addon.unitPrice, addon.currency)} / {addon.unitLabel}</span>
                <span className="text-sm font-bold text-orange-700">{fmtPrice(units * addon.unitPrice, addon.currency)} / mo</span>
              </div>
            </div>
          )}

          {/* Percentage */}
          {isPercent && (
            <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4 space-y-3">
              <span className="block text-[11px] font-semibold uppercase tracking-widest text-violet-600">Price Calculation</span>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-violet-100 bg-white px-3 py-2">
                  <span className="text-[11px] text-gray-500">Plan price (yearly)</span>
                  <span className="text-sm font-semibold text-gray-800">{fmtPrice(planYearlyPrice, addon.currency)}</span>
                </div>
                <div className="flex items-center justify-center text-xs text-violet-400">× {addon.percentage}% ↓</div>
                <div className="flex items-center justify-between rounded-lg border border-violet-200 bg-white px-3 py-2.5">
                  <span className="text-[11px] font-semibold text-violet-700">Addon price / yr</span>
                  <span className="text-base font-bold text-violet-700">{fmtPrice(planYearlyPrice * addon.percentage / 100, addon.currency)}</span>
                </div>
              </div>
              <p className="text-[11px] text-violet-500">⚡ Adjusts automatically if the plan price changes.</p>
            </div>
          )}

          {/* Billing period — not for percentage, and not needed if pro-rated (period = parent's remaining) */}
          {!isPercent && !parentIsActive && (
            <div className="space-y-2">
              <label className="text-[11px] font-medium text-gray-500">Billing Period</label>
              <div className="grid grid-cols-3 gap-2">
                {BILLING_PERIODS.filter(p => p.key !== "ONE_TIME").map(p => (
                  <button key={p.key} type="button" onClick={() => setBillingPeriod(p.key)}
                    className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                      billingPeriod === p.key ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"
                    }`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Start date — locked to today if pro-rated */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">
              Start Date {parentIsActive && <span className="text-gray-400 font-normal">(today — pro-rated from here)</span>}
            </label>
            <input type="date" value={startDate} onChange={e => !parentIsActive && setStartDate(e.target.value)}
              readOnly={parentIsActive}
              className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 ${parentIsActive ? "border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed" : "border-gray-200 bg-white"}`} />
          </div>

          {/* Total bar */}
          {computedTotal !== null && (
            <div className="rounded-xl border border-gray-200 bg-gray-900 px-4 py-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                  {parentIsActive ? "Pro-rated Charge" : "Total Due"}
                </div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  {parentIsActive
                    ? `${parentRemaining} of ${parentTotal} days remaining`
                    : isPercent ? "Billed yearly with plan" : BILLING_PERIODS.find(p => p.key === billingPeriod)?.label + " billing"
                  }
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-white">{fmtPrice(computedTotal, addon.currency)}</div>
                {parentIsActive && fullYearPrice && (
                  <div className="text-[11px] text-gray-400">Full price: {fmtPrice(fullYearPrice, addon.currency)}/yr</div>
                )}
                {!parentIsActive && !isPercent && billingPeriod !== "MONTHLY" && computedMonthly && (
                  <div className="text-[11px] text-gray-400">{fmtPrice(computedMonthly, addon.currency)} / mo</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50">Cancel</button>
          <button onClick={handleCreate}
            className={`rounded-lg px-5 py-2 text-xs font-semibold text-white transition-colors ${done ? "bg-green-600" : "bg-gray-900 hover:bg-gray-700"}`}>
            {done ? "✓ Created!" : "Create Subscription"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Addons Tab ────────────────────────────────────────────────────────────────
function AddonsTab({ sub, allSubs }) {
  const isPlan   = sub.product.type === "plan";
  const attached = getAttachedAddons(sub.id, allSubs);
  const unlinked = getUnlinkedAddons(allSubs).filter(a => a.user.email === sub.user.email);

  const [detaching,      setDetaching]      = useState(null);
  const [attaching,      setAttaching]      = useState(false);
  const [selectId,       setSelectId]       = useState("");
  const [saved,          setSaved]          = useState("");
  const [subscribeAddon, setSubscribeAddon] = useState(null);

  if (!isPlan) return (
    <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
      <div className="text-3xl">🔗</div>
      <div className="text-sm font-semibold text-gray-500">Addons tab is only available on plan subscriptions.</div>
      <div className="text-xs text-gray-400">To link this addon to a plan, use the Details tab.</div>
    </div>
  );

  function mockDetach(id) {
    setDetaching(id);
    setTimeout(() => { setDetaching(null); setSaved("detached"); setTimeout(() => setSaved(""), 2500); }, 700);
  }
  function mockAttach() {
    if (!selectId) return;
    setAttaching(true);
    setTimeout(() => { setAttaching(false); setSelectId(""); setSaved("attached"); setTimeout(() => setSaved(""), 2500); }, 700);
  }

  // Which catalog addons are already owned by this customer (attached or unlinked)
  const ownedKeys = new Set([
    ...attached.map(a => a.product.key),
    ...unlinked.map(a => a.product.key),
  ]);

  return (
    <div className="space-y-4">

      {/* Flash messages */}
      {saved === "detached"    && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-medium text-green-700">✓ Addon detached.</div>}
      {saved === "attached"    && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-medium text-green-700">✓ Addon attached.</div>}
      {saved === "subscribed"  && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-xs font-medium text-green-700">✓ Addon subscription created and linked.</div>}

      {/* ── Attached addons ── */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          Attached Addons
          {attached.length > 0 && <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">{attached.length}</span>}
        </span>
        {attached.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white px-4 py-3">
            <span className="text-gray-300 text-lg">🧩</span>
            <span className="text-xs text-gray-400">No addons attached yet.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {attached.map(a => (
              <div key={a.id} className="flex items-center gap-3 rounded-xl border border-purple-100 bg-white px-4 py-3">
                <span className="text-base">🧩</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{a.product.name}</span>
                    <span className="font-mono text-[10px] text-gray-400">{a.product.key}</span>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="font-mono text-[11px] text-gray-400 mt-0.5">{a.id}</div>
                </div>
                <button onClick={() => mockDetach(a.id)} disabled={detaching === a.id}
                  className="flex-shrink-0 rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-[11px] font-semibold text-red-500 hover:bg-red-100 disabled:opacity-40 transition-colors">
                  {detaching === a.id ? "…" : "Detach"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Attach existing unlinked addon ── */}
      {unlinked.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
          <span className="block text-[11px] font-semibold uppercase tracking-widest text-gray-400">Attach Existing Addon</span>
          <p className="text-[11px] text-gray-400">Unlinked addon subscriptions belonging to this customer.</p>
          <div className="flex items-center gap-2">
            <select value={selectId} onChange={e => setSelectId(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
              <option value="">— Select addon subscription —</option>
              {unlinked.map(a => <option key={a.id} value={a.id}>{a.product.name} ({a.product.key}) · {a.id.slice(0,18)}…</option>)}
            </select>
            <button onClick={mockAttach} disabled={!selectId || attaching}
              className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-40">
              {attaching ? "…" : "Attach"}
            </button>
          </div>
        </div>
      )}

      {/* ── Available catalog addons ── */}
      <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Available Addons</span>
          <div className="flex items-center gap-1.5">
            {["fixed","per_unit","percentage"].map(type => (
              <span key={type} className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getPriceBadgeCls(type)}`}>
                {getPriceTypeLabel(type)}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          {MOCK_CATALOG_ADDONS.map(addon => {
            const owned = ownedKeys.has(addon.key);
            return (
              <div key={addon.id}
                className={`flex items-center gap-3 rounded-xl border bg-white px-4 py-3 transition-all ${owned ? "border-purple-100 opacity-60" : "border-gray-200 hover:border-gray-300 hover:shadow-sm"}`}>
                <span className="text-lg flex-shrink-0">🧩</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{addon.name}</span>
                    <span className="font-mono text-[10px] text-gray-400">{addon.key}</span>
                    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${getPriceBadgeCls(addon.addonPricingType)}`}>
                      {getPriceTypeLabel(addon.addonPricingType)}
                    </span>
                    {owned && <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-600">✓ Subscribed</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[11px] text-gray-400 truncate">{addon.description}</span>
                    <span className={`text-[11px] font-bold flex-shrink-0 ${
                      addon.addonPricingType === "per_unit" ? "text-orange-600" :
                      addon.addonPricingType === "percentage" ? "text-violet-600" : "text-blue-600"
                    }`}>{getPriceLabel(addon)}</span>
                  </div>
                </div>
                {!owned && (
                  <button onClick={() => setSubscribeAddon(addon)}
                    className="flex-shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-colors">
                    Subscribe
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Subscribe modal */}
      {subscribeAddon && (
        <AddonSubscribeModal
          addon={subscribeAddon}
          sub={sub}
          onClose={() => setSubscribeAddon(null)}
          onDone={() => { setSaved("subscribed"); setTimeout(() => setSaved(""), 2500); }}
        />
      )}
    </div>
  );
}

// ── Expanded Panel ────────────────────────────────────────────────────────────
function ExpandedPanel({ sub, allSubs }) {
  const serverTag = getServerTag(sub);
  const oneTime   = isOneTime(sub);

  const isPlan = sub.product.type === "plan";

  const TABS = [
    { id: "billing", label: "Billing",  icon: "💳" },
    ...(serverTag ? [{ id: "vps", label: serverTag.label, icon: serverTag.icon }] : []),
    ...(isPlan ? [{ id: "addons", label: "Addons", icon: "🧩" }] : []),
    { id: "details", label: "Details",  icon: "📝" },
    ...(!oneTime ? [{ id: "renewal", label: "Renewal", icon: "🔄" }] : []),
    { id: "status",  label: "Status",   icon: "🔘" },
  ];

  const [tab, setTab] = useState("billing");

  return (
    <div className="border-t border-gray-100">
      {/* Info bar */}
      <div className="flex flex-wrap items-center gap-2.5 border-b border-gray-100 bg-white px-5 py-2">
        <span className="font-mono text-[11px] text-gray-400">{sub.id}</span>
        <TypeBadge type={sub.product.type} />
        {sub.provisionLocation && <span className="text-[11px] text-gray-500">📍 {sub.provisionLocation}</span>}
        {sub.parentSubscriptionId && (
          <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-600">
            🔗 Addon · linked to {sub.parentSubscriptionId.slice(0,20)}…
          </span>
        )}
        {oneTime && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">🏷️ One-time</span>}
      </div>

      <div className="flex bg-gray-50/40">
        {/* Sidebar */}
        <div className="flex w-32 flex-shrink-0 flex-col border-r border-gray-100 bg-white py-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2.5 text-left text-xs font-medium transition-colors
                ${t.id === "cancel"
                  ? tab === "status" ? "bg-gray-700 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                  : tab === t.id ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                }`}>
              <span className="text-base leading-none">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        {/* Content */}
        <div className="flex-1 overflow-auto p-5" style={{ maxHeight: 500 }}>
          {tab === "billing" && <BillingTab sub={sub} />}
          {tab === "vps"     && <VpsTab     sub={sub} />}
          {tab === "addons"  && <AddonsTab  sub={sub} allSubs={allSubs} />}
          {tab === "details" && <DetailsTab sub={sub} />}
          {tab === "renewal" && <RenewalTab sub={sub} />}
          {tab === "status"  && <StatusTab  sub={sub} />}
        </div>
      </div>
    </div>
  );
}


// ── Create Subscription Modal ─────────────────────────────────────────────────
const MOCK_CUSTOMERS = [
  { id: "usr_01", name: "Ahmed Al-Rashid", email: "ahmed@example.com", market: "Saudi Arabia · SAR", currency: "SAR" },
  { id: "usr_02", name: "Sara Mahmoud",    email: "sara@techco.sa",    market: "Saudi Arabia · SAR", currency: "SAR" },
  { id: "usr_03", name: "John Smith",      email: "john@globalcorp.com", market: "Global · USD",   currency: "USD" },
];

const MOCK_PRODUCTS = [
  { id: "prd_01", name: "Cloud Server 2Core 4GB", key: "CSO-101", type: "plan", catalogPrice: 1200, tags: ["server","or"],  billingPeriods: ["YEARLY","MONTHLY"] },
  { id: "prd_02", name: "Cloud Server 1Core 2GB", key: "CSO-50",  type: "plan", catalogPrice: 600,  tags: ["server","or"],  billingPeriods: ["YEARLY","MONTHLY"] },
  { id: "prd_03", name: "VPS Europe 2Core",        key: "CSG-101", type: "plan", catalogPrice: 240,  tags: ["vps","hz"],     billingPeriods: ["YEARLY","MONTHLY"] },
  { id: "prd_04", name: "Domain Registration .com",key: "DOM-COM", type: "service", catalogPrice: 50, tags: [],             billingPeriods: ["ONE_TIME"] },
];

function CreateSubscriptionModal({ onClose }) {
  const [customerId,     setCustomerId]     = useState("");
  const [productId,      setProductId]      = useState("");
  const [billingPeriod,  setBillingPeriod]  = useState("YEARLY");
  const [startDate,      setStartDate]      = useState(new Date().toISOString().slice(0,10));
  const [locationId,     setLocationId]     = useState("");
  const [templateId,     setTemplateId]     = useState("");
  const [useCustomPrice, setUseCustomPrice] = useState(false);
  const [customPrice,    setCustomPrice]    = useState("");
  const [created,        setCreated]        = useState(false);

  const customer = MOCK_CUSTOMERS.find(c => c.id === customerId);
  const product  = MOCK_PRODUCTS.find(p => p.id === productId);
  const isServer = product ? (product.tags.includes("vps") || product.tags.includes("server")) : false;
  const isOneTimeP = product?.billingPeriods?.includes("ONE_TIME") && product.billingPeriods.length === 1;
  const displayPrice = useCustomPrice ? customPrice : (product?.catalogPrice ?? "—");
  const currency = customer?.currency ?? "SAR";

  function handleCreate() {
    setCreated(true);
    setTimeout(() => { onClose(); }, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <div className="text-base font-bold text-gray-900">New Subscription</div>
            <div className="text-[11px] text-gray-400 mt-0.5">Creates subscription with status: Pending · Payment: Unpaid</div>
          </div>
          <button onClick={onClose} className="text-gray-300 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="space-y-4 px-6 py-5 max-h-[75vh] overflow-y-auto">

          {/* Customer */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Customer *</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
              <option value="">— Select customer —</option>
              {MOCK_CUSTOMERS.map(c => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}
            </select>
          </div>

          {/* Market — auto-filled */}
          {customer && (
            <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5">
              <span className="text-[11px] text-blue-400 font-medium">Market auto-filled:</span>
              <span className="text-[11px] font-semibold text-blue-800">{customer.market}</span>
            </div>
          )}

          {/* Product */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Product *</label>
            <select value={productId} onChange={e => { setProductId(e.target.value); setUseCustomPrice(false); setCustomPrice(""); }}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
              <option value="">— Select product —</option>
              {MOCK_PRODUCTS.map(p => <option key={p.id} value={p.id}>{p.name} ({p.key})</option>)}
            </select>
          </div>

          {/* Billing period */}
          {product && !isOneTimeP && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-gray-500">Billing Period</label>
              <div className="grid grid-cols-3 gap-2">
                {BILLING_PERIODS.filter(p => product.billingPeriods.includes(p.key)).map(p => (
                  <button key={p.key} type="button" onClick={() => setBillingPeriod(p.key)}
                    className={`rounded-xl border py-2 text-xs font-semibold transition-all ${
                      billingPeriod === p.key ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-500 hover:border-gray-400"
                    }`}>{p.label}</button>
                ))}
              </div>
            </div>
          )}

          {/* Location + Template — server/vps only */}
          {isServer && (
            <>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-500">Location</label>
                <select value={locationId} onChange={e => setLocationId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                  <option value="">— Select location —</option>
                  {MOCK_LOCATIONS.map(l => <option key={l.id} value={l.id}>{l.flag} {l.name} · {l.code}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-gray-500">Template</label>
                <select value={templateId} onChange={e => setTemplateId(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300">
                  <option value="">— Select template —</option>
                  {MOCK_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Start date */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-gray-500">Start Date</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>

          {/* Price */}
          {product && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Price</span>
                  <p className="text-[11px] text-gray-400 mt-0.5">Catalog price pre-filled. Override if needed.</p>
                </div>
                <button type="button" onClick={() => setUseCustomPrice(v => !v)}
                  className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${useCustomPrice ? "bg-gray-900" : "bg-gray-200"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${useCustomPrice ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
              {useCustomPrice ? (
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-gray-300">
                  <input type="number" min={0} step={0.01} value={customPrice} onChange={e => setCustomPrice(e.target.value)}
                    placeholder={String(product.catalogPrice)}
                    className="flex-1 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none" />
                  <span className="text-xs text-gray-400">{currency}</span>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <span className="text-[11px] text-gray-500">Catalog price</span>
                  <span className="text-sm font-bold text-gray-900">{product.catalogPrice} {currency}</span>
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {customer && product && (
            <div className="rounded-xl bg-gray-900 px-4 py-3 space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">On Creation</div>
              {[
                ["Subscription status", "Pending"],
                ["Payment status",      "Unpaid"],
                ["Bill generated",      `${useCustomPrice && customPrice ? customPrice : product.catalogPrice} ${currency} — visible to customer`],
              ].map(([l,v]) => (
                <div key={l} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-400">{l}</span>
                  <span className="font-semibold text-white">{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50">Cancel</button>
          <button onClick={handleCreate} disabled={!customerId || !productId}
            className={`rounded-lg px-5 py-2 text-xs font-semibold text-white transition-colors ${created ? "bg-green-600" : "bg-gray-900 hover:bg-gray-700"} disabled:opacity-40`}>
            {created ? "✓ Created!" : "Create Subscription"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function SubscriptionsMockup() {
  const [expandedId, setExpandedId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [fSearch,  setFSearch]  = useState("");
  const [fId,      setFId]      = useState("");
  const [fStatus,  setFStatus]  = useState("");
  const [fType,    setFType]    = useState("");
  const [fExpiry,  setFExpiry]  = useState("");

  const filtered = MOCK_SUBS.filter(s => {
    if (fSearch && !s.user.email.toLowerCase().includes(fSearch.toLowerCase()) && !s.user.name.toLowerCase().includes(fSearch.toLowerCase())) return false;
    if (fId     && !s.id.toLowerCase().includes(fId.toLowerCase())) return false;
    if (fStatus && s.status !== fStatus) return false;
    if (fType   && s.product.type !== fType) return false;
    if (fExpiry) { const d = daysUntil(s.currentPeriodEnd); if (d === null || d > Number(fExpiry)) return false; }
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Subscriptions</h1>
            <p className="text-sm text-gray-400">{MOCK_SUBS.length} total · click any row to manage</p>
          </div>
          <button onClick={() => setShowCreate(true)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">+ Add Subscription</button>
        </div>


        {/* ── Create Subscription Modal ── */}
        {showCreate && <CreateSubscriptionModal onClose={() => setShowCreate(false)} />}
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white px-4 py-3 shadow-sm">
          <input value={fSearch} onChange={e => setFSearch(e.target.value)} placeholder="Search email, name…"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" style={{width:180}} />
          <input value={fId} onChange={e => setFId(e.target.value)} placeholder="Sub ID: sub_…"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-gray-300" style={{width:160}} />
          <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs">
            <option value="">All Statuses</option>
            {Object.entries(SUB_STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={fType} onChange={e => setFType(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs">
            <option value="">All Types</option>
            <option value="plan">Plan</option><option value="addon">Addon</option><option value="service">Service</option>
          </select>
          <select value={fExpiry} onChange={e => setFExpiry(e.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs">
            <option value="">Expiry: All</option><option value="7">Within 7d</option><option value="30">Within 30d</option>
          </select>
          {(fSearch||fId||fStatus||fType||fExpiry) && (
            <button onClick={() => { setFSearch(""); setFId(""); setFStatus(""); setFType(""); setFExpiry(""); }}
              className="text-xs text-gray-400 underline hover:text-gray-600">Clear</button>
          )}
          <span className="ml-auto text-xs text-gray-400">{filtered.length} of {MOCK_SUBS.length}</span>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="grid border-b bg-gray-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400"
            style={{ gridTemplateColumns: "2fr 1.5fr 1.1fr 0.9fr 1fr 1fr 40px" }}>
            <div>Customer</div><div>Product</div><div>Type</div><div>Status</div><div>Payment</div><div>Expiry</div><div />
          </div>

          {filtered.map(sub => {
            const isOpen    = expandedId === sub.id;
            const oneTime   = isOneTime(sub);
            const serverTag = getServerTag(sub);
            const d         = daysUntil(sub.currentPeriodEnd);

            return (
              <div key={sub.id} className="border-b last:border-b-0">
                <div
                  className={`grid cursor-pointer items-center gap-4 px-5 py-3.5 transition-colors hover:bg-gray-50/80 ${isOpen ? "bg-blue-50/30" : ""}`}
                  style={{ gridTemplateColumns: "2fr 1.5fr 0.8fr 1fr 1fr 1fr 40px" }}
                  onClick={() => setExpandedId(isOpen ? null : sub.id)}
                >
                  <div>
                    <a href={`/admin/customers/${sub.user.id ?? "unknown"}/edit`} onClick={e => e.stopPropagation()} className="text-sm font-semibold text-gray-900 hover:text-blue-600 hover:underline">{sub.user.name}</a>
                    <div className="text-xs text-gray-400">{sub.user.email}</div>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-gray-800 truncate max-w-[140px]">{sub.product.name}</span>
                      {serverTag && (
                        <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold flex-shrink-0 ${serverTag.color}`}>
                          {serverTag.label}
                        </span>
                      )}
                      {isPerUnit(sub) && sub.quantity != null && (
                        <span className="rounded-full border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold text-violet-700 flex-shrink-0">
                          {sub.quantity} {sub.product.unitLabel ?? "units"}
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-gray-400">{sub.product.key}</div>
                  </div>
                  <div><TypeBadge type={sub.product.type} /></div>
                  <div><StatusBadge status={sub.status} /></div>
                  <div><PaymentBadge status={sub.paymentStatus ?? "UNPAID"} /></div>
                  <div>
                    {oneTime
                      ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">One-time</span>
                      : !sub.currentPeriodEnd || sub.status !== "ACTIVE"
                        ? <span className="text-xs text-gray-300">—</span>
                        : <span className={`text-xs font-medium ${d !== null && d <= 7 ? "text-red-600" : d !== null && d <= 30 ? "text-amber-600" : "text-gray-700"}`}>
                            {d !== null && d <= 30 && (d <= 7 ? "🔴 " : "🟡 ")}{fmtDate(sub.currentPeriodEnd)}
                          </span>
                    }
                  </div>
                  <div className={`flex items-center justify-center text-gray-300 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
                {isOpen && <ExpandedPanel sub={sub} allSubs={MOCK_SUBS} />}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400">
          <button className="rounded-lg border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40" disabled>← Prev</button>
          <span>Page 1 / 1</span>
          <button className="rounded-lg border px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40" disabled>Next →</button>
        </div>
      </div>
    </div>
  );
}