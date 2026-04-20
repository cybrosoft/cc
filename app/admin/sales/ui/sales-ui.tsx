// app/admin/sales/ui/sales-ui.tsx
// Sales module shared UI — zero border-radius, #318774 primary, Geist font.
"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { CLR } from "@/components/ui/admin-ui";
import { Icon } from "@/components/ui/Icon";
import type { SalesDocumentType } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PERIOD_LABEL: Record<string, string> = {
  MONTHLY:    "Monthly",
  SIX_MONTHS: "6 Months",
  YEARLY:     "Yearly",
  ONE_TIME:   "One-time",
};
const PERIOD_ORDER = ["MONTHLY", "SIX_MONTHS", "YEARLY", "ONE_TIME"];

const TYPE_LABEL: Record<string, string> = {
  RFQ: "RFQ", QUOTATION: "Quotation", PO: "Purchase Order",
  DELIVERY_NOTE: "Delivery Note", PROFORMA: "Proforma Invoice",
  INVOICE: "Invoice", CREDIT_NOTE: "Credit Note / Return",
};

const ENDPOINT_MAP: Record<string, string> = {
  RFQ:           "/api/admin/sales/rfq",
  QUOTATION:     "/api/admin/sales/quotations",
  PO:            "/api/admin/sales/po",
  DELIVERY_NOTE: "/api/admin/sales/delivery-notes",
  PROFORMA:      "/api/admin/sales/proforma",
  INVOICE:       "/api/admin/sales/invoices",
  CREDIT_NOTE:   "/api/admin/sales/returns",
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  fullName: string | null;
  email: string;
  customerNumber: string | null;
  market: {
    id: string; key: string; name: string;
    defaultCurrency: string;
    vatPercent?: number | string | null;
  };
}

export interface EligibleProduct {
  id: string;
  key: string;
  name: string;
  nameAr?: string | null;
  productDetails?: string | null;
  detailsAr?: string | null;
  type: string;
  billingPeriods: string[];
  prices: { billingPeriod: string; priceCents: number; currency: string; isOverride: boolean }[];
  unitLabel: string | null;
}

export interface LineItem {
  id?: string;
  productId: string | null;
  productKey: string;
  description: string;
  descriptionAr: string;
  productDetails: string;
  detailsAr: string;
  billingPeriod: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  isNonInventory: boolean;
  showDetails: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function fmtAmount(cents: number, currency: string) {
  const amount = cents / 100;
  if (currency === "SAR")
    return `SAR ${amount.toLocaleString("en-SA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function todayISO() { return new Date().toISOString().split("T")[0]; }
function calcLineTotal(u: number, q: number, d = 0) { return Math.round(u * q * (1 - d / 100)); }

function emptyLine(nonInventory = false): LineItem {
  return {
    productId: null, productKey: "", description: "",
    descriptionAr: "", productDetails: "", detailsAr: "",
    billingPeriod: "", quantity: 1, unitPrice: 0, discount: 0,
    lineTotal: 0, isNonInventory: nonInventory, showDetails: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Badges
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  DRAFT:          { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" },
  ISSUED:         { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  SENT:           { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  ACCEPTED:       { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  REJECTED:       { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  CONVERTED:      { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  PAID:           { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
  PARTIALLY_PAID: { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
  PARTIAL:        { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
  OVERDUE:        { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5" },
  VOID:           { bg: "#f3f4f6", color: "#6b7280", border: "#d1d5db" },
  PENDING:        { bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
  IN_REVIEW:      { bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd" },
  QUOTED:         { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  REVISED:        { bg: "#fdf4ff", color: "#7e22ce", border: "#e9d5ff" },
  EXPIRED:        { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },
  CLOSED:         { bg: "#f3f4f6", color: "#374151", border: "#d1d5db" },
  DELIVERED:      { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  CANCELLED:      { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  WRITTEN_OFF:    { bg: "#fdf4ff", color: "#7e22ce", border: "#e9d5ff" },
  PROCESSING:     { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  APPLIED:        { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
};

export function SalesStatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px",
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      letterSpacing: "0.04em", whiteSpace: "nowrap" as const,
    }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

const TYPE_BADGE_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  RFQ:           { bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
  QUOTATION:     { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  PO:            { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  DELIVERY_NOTE: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  PROFORMA:      { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" },
  INVOICE:       { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
  CREDIT_NOTE:   { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
};

export function DocTypeBadge({ type }: { type: string }) {
  const s = TYPE_BADGE_STYLE[type] ?? { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 8px",
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      letterSpacing: "0.04em", whiteSpace: "nowrap" as const,
    }}>
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRow helper (used in CreateDocModal totals)
// ─────────────────────────────────────────────────────────────────────────────

function TRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", padding: "5px 0",
      borderTop: bold ? "2px solid #111827" : "1px solid #f3f4f6",
      fontWeight: bold ? 700 : 400, fontSize: bold ? 15 : 13,
    }}>
      <span style={{ color: bold ? CLR.text : CLR.muted }}>{label}</span>
      <span style={{ color: bold ? CLR.primary : CLR.text }}>{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sales Document Table
// ─────────────────────────────────────────────────────────────────────────────

export interface SalesDocRow {
  id: string; docNum: string; type: string; status: string;
  currency: string; total: number; issueDate: string; dueDate?: string | null;
  emailSentCount?: number | null;
  customer: { fullName?: string | null; email: string; customerNumber?: string | null };
  market: { key: string; name: string };
  originDoc?: { docNum: string; type: string } | null;
}

export function SalesDocTable({ docs, loading, onOpen, onConvert, showType }: {
  docs: SalesDocRow[]; loading: boolean; onOpen: (id: string) => void;
  onConvert?: (id: string) => void; showType?: boolean;
}) {
  if (loading) return <div style={{ padding: "48px 24px", textAlign: "center", color: CLR.faint, fontSize: 13 }}>Loading…</div>;
  if (!docs.length) return (
    <div style={{ padding: "64px 24px", textAlign: "center", border: "1px solid #e5e7eb", background: "#fff" }}>
      <p style={{ fontSize: 14, color: CLR.muted, fontWeight: 500 }}>No documents found</p>
      <p style={{ fontSize: 12, color: CLR.faint, marginTop: 4 }}>Documents will appear here once created.</p>
    </div>
  );
  return (
    <div style={{ border: "1px solid #e5e7eb", background: "#fff", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
            <Th>Doc #</Th>{showType && <Th>Type</Th>}<Th>Customer</Th>
            <Th>Market</Th><Th>Status</Th><Th>Total</Th>
            <Th>Date</Th><Th>Due</Th><Th>Origin</Th><Th />
          </tr>
        </thead>
        <tbody>
          {docs.map(d => (
            <tr key={d.id}
              style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
              onClick={() => onOpen(d.id)}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <Td><span style={{ fontWeight: 600, color: CLR.primary, fontFamily: "monospace" }}>{d.docNum}</span></Td>
              {showType && <Td><DocTypeBadge type={d.type} /></Td>}
              <Td>
                <div style={{ fontWeight: 500 }}>{d.customer.fullName ?? d.customer.email}</div>
                <div style={{ fontSize: 11, color: CLR.faint }}>{d.customer.customerNumber}</div>
              </Td>
              <Td>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", background: "#f3f4f6", border: "1px solid #e5e7eb", color: CLR.muted }}>
                  {d.market.key}
                </span>
              </Td>
              <Td><SalesStatusBadge status={d.status} /></Td>
              <Td style={{ fontWeight: 600 }}>{fmtAmount(d.total, d.currency)}</Td>
              <Td style={{ color: CLR.muted }}>{fmtDate(d.issueDate)}</Td>
              <Td style={{ color: CLR.faint }}>{d.dueDate ? fmtDate(d.dueDate) : "—"}</Td>
              <Td>
                {d.originDoc && (
                  <span style={{ fontSize: 11, color: CLR.faint, fontFamily: "monospace" }}>
                    {d.originDoc.docNum}
                  </span>
                )}
              </Td>
              <Td>
                {onConvert && d.status !== "VOID" && d.status !== "CONVERTED" && (
                  <button onClick={e => { e.stopPropagation(); onConvert(d.id); }}
                    style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: CLR.primaryBg, color: CLR.primary, border: `1px solid ${CLR.primary}22`, cursor: "pointer", fontFamily: "inherit" }}>
                    Convert
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em", textTransform: "uppercase" as const, whiteSpace: "nowrap" }}>{children}</th>;
}
function Td({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return <td style={{ padding: "11px 14px", verticalAlign: "middle", ...style }}>{children}</td>;
}
function ABtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: CLR.primaryBg, color: CLR.primary, border: `1px solid ${CLR.primary}22`, cursor: "pointer", fontFamily: "inherit" }}>{children}</button>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filters Bar
// ─────────────────────────────────────────────────────────────────────────────

export function SalesFilters({ q, setQ, status, setStatus, marketKey, setMarketKey, statuses }: {
  q: string; setQ: (v: string) => void; status: string; setStatus: (v: string) => void;
  marketKey: string; setMarketKey: (v: string) => void; statuses: string[];
}) {
  const inp: React.CSSProperties = { padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", background: "#fff", fontFamily: "inherit", outline: "none" };
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search doc # or customer…" style={{ ...inp, flex: 1, minWidth: 220 }} />
      <select value={status} onChange={e => setStatus(e.target.value)} style={inp}>
        <option value="">All Statuses</option>
        {statuses.map(s => <option key={s}>{s}</option>)}
      </select>
      <select value={marketKey} onChange={e => setMarketKey(e.target.value)} style={inp}>
        <option value="">All Markets</option>
        <option value="SAUDI">Saudi Arabia (SAR)</option>
        <option value="GLOBAL">Global (USD)</option>
      </select>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Convert Modal — updated: onConverted receives redirectTo from API
// ─────────────────────────────────────────────────────────────────────────────

const CONVERT_OPTIONS: Record<string, SalesDocumentType[]> = {
  RFQ:           ["QUOTATION","PROFORMA","DELIVERY_NOTE","INVOICE"],
  QUOTATION:     ["PROFORMA","DELIVERY_NOTE","INVOICE"],
  PO:            ["INVOICE"],
  DELIVERY_NOTE: ["PROFORMA","INVOICE"],
  PROFORMA:      ["DELIVERY_NOTE","INVOICE"],
  INVOICE:       ["CREDIT_NOTE"],
};

export function ConvertModal({ docId, docNum, docType, onClose, onConverted }: {
  docId: string; docNum: string; docType: string;
  onClose: () => void;
  // redirectTo: the full path to redirect to (e.g. /admin/sales/invoices/NEW_ID?edit=1)
  onConverted: (redirectTo: string) => void;
}) {
  const [target, setTarget]   = useState<SalesDocumentType | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const options = CONVERT_OPTIONS[docType] ?? [];

  async function submit() {
    if (!target) return;
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/admin/sales/${docId}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetType: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onConverted(data.redirectTo ?? `/admin/sales/${data.doc.id}?edit=1`);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <Overlay onClose={onClose}>
      <ModalBox title={`Convert ${docNum}`}>
        <p style={{ fontSize: 13, color: CLR.muted, marginBottom: 16 }}>
          Select target type. Source will be marked <em>Converted</em>. New document opens as a draft for review.
        </p>
        {options.length === 0
          ? <p style={{ color: "#dc2626", fontSize: 13 }}>No conversion options available.</p>
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {options.map(o => (
                <label key={o} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px",
                  border: `1px solid ${target === o ? CLR.primary : "#e5e7eb"}`,
                  background: target === o ? CLR.primaryBg : "#fff",
                  cursor: "pointer",
                }}>
                  <input type="radio" name="target" value={o} checked={target === o}
                    onChange={() => setTarget(o)} style={{ accentColor: CLR.primary }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{TYPE_LABEL[o]}</span>
                </label>
              ))}
            </div>
          )}
        {error && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 10 }}>{error}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <GhostBtn onClick={onClose} disabled={loading}>Cancel</GhostBtn>
          <PrimaryBtn onClick={submit} disabled={loading || !target}>
            {loading ? "Converting…" : "Convert"}
          </PrimaryBtn>
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer Search
// ─────────────────────────────────────────────────────────────────────────────

function CustomerSearch({ value, onChange }: { value: Customer | null; onChange: (c: Customer | null) => void }) {
  const [query,   setQuery]   = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none" };

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}&role=CUSTOMER&pageSize=10`);
        const d   = await res.json();
        setResults(d.data ?? []);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div style={{ position: "relative" }}>
      {value ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 12px", border: `1px solid ${CLR.primary}`, background: CLR.primaryBg, fontSize: 13 }}>
          <div>
            <span style={{ fontWeight: 600 }}>{value.fullName ?? value.email}</span>
            <span style={{ color: CLR.muted, marginLeft: 8, fontSize: 11 }}>#{value.customerNumber}</span>
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "1px 7px", background: CLR.primary, color: "#fff" }}>
              {value.market.key} · {value.market.defaultCurrency}
            </span>
          </div>
          <button onClick={() => { onChange(null); setQuery(""); }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: CLR.muted, padding: "0 4px" }}>✕</button>
        </div>
      ) : (
        <input value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search by name, email or customer #…"
          style={inp} />
      )}
      {open && !value && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 400, background: "#fff", border: "1px solid #d1d5db", borderTop: "none", maxHeight: 280, overflowY: "auto", boxShadow: "0 6px 20px rgba(0,0,0,0.12)" }}>
          {loading
            ? <div style={{ padding: "12px 14px", fontSize: 12, color: CLR.faint }}>Searching…</div>
            : results.length === 0
              ? <div style={{ padding: "12px 14px", fontSize: 12, color: CLR.faint }}>No customers found</div>
              : results.map(c => (
                <div key={c.id}
                  onMouseDown={() => { onChange(c); setOpen(false); setQuery(""); }}
                  style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{c.fullName ?? c.email}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "1px 6px",
                      background: c.market.key === "SAUDI" ? "#dcfce7" : "#eff6ff",
                      color: c.market.key === "SAUDI" ? "#15803d" : "#1d4ed8",
                      border: `1px solid ${c.market.key === "SAUDI" ? "#86efac" : "#bfdbfe"}`,
                    }}>{c.market.key}</span>
                  </div>
                  <div style={{ fontSize: 11, color: CLR.faint, marginTop: 2 }}>
                    {c.email} {c.customerNumber ? `· #${c.customerNumber}` : ""}
                  </div>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product ID / Description cells for line editor
// ─────────────────────────────────────────────────────────────────────────────

function ProductIDCell({ value, products, onSelect, onChange, inputStyle }: {
  value: string; products: EligibleProduct[];
  onSelect: (p: EligibleProduct) => void; onChange: (v: string) => void;
  inputStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const filtered = value.trim()
    ? products.filter(p => p.key.toLowerCase().includes(value.toLowerCase()) || p.name.toLowerCase().includes(value.toLowerCase()))
    : products.slice(0, 8);

  return (
    <div style={{ position: "relative" }}>
      <input value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Key…"
        style={{ width: "100%", padding: "6px 7px", fontSize: 11, fontFamily: "monospace", border: "1px solid #d1d5db", background: "#fff", outline: "none", boxSizing: "border-box" as const, ...(inputStyle ?? {}) }} />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 500, background: "#fff", border: "1px solid #d1d5db", minWidth: 280, maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
          {filtered.map(p => (
            <div key={p.id} onMouseDown={() => { onSelect(p); setOpen(false); }}
              style={{ padding: "7px 10px", cursor: "pointer", fontSize: 12 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <span style={{ fontFamily: "monospace", color: CLR.primary, fontWeight: 700, marginRight: 8 }}>{p.key}</span>
              {p.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DescriptionCell({ value, products, onSelect, onChange, inputStyle }: {
  value: string; products: EligibleProduct[];
  onSelect: (p: EligibleProduct) => void; onChange: (v: string) => void;
  inputStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const filtered = value.trim().length > 1
    ? products.filter(p => p.name.toLowerCase().includes(value.toLowerCase()) || p.key.toLowerCase().includes(value.toLowerCase()))
    : [];

  return (
    <div style={{ position: "relative" }}>
      <input value={value}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(value.trim().length > 1)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Description…"
        style={{ width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const, ...(inputStyle ?? {}) }} />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 500, background: "#fff", border: "1px solid #d1d5db", minWidth: 280, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
          {filtered.map(p => (
            <div key={p.id} onMouseDown={() => { onSelect(p); setOpen(false); }}
              style={{ padding: "7px 10px", cursor: "pointer", fontSize: 12 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <span style={{ fontFamily: "monospace", color: CLR.primary, fontWeight: 700, marginRight: 8 }}>{p.key}</span>
              {p.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog Picker Modal
// ─────────────────────────────────────────────────────────────────────────────

function CatalogPickerModal({ allProducts, eligibleProducts, currency, onSelect, onClose }: {
  allProducts: EligibleProduct[]; eligibleProducts: EligibleProduct[];
  currency: string; onSelect: (p: EligibleProduct) => void; onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const eligibleIds = new Set(eligibleProducts.map(p => p.id));
  const catalogOnly = allProducts.filter(p => !eligibleIds.has(p.id));
  const filtered    = q.trim()
    ? catalogOnly.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.key.toLowerCase().includes(q.toLowerCase()))
    : catalogOnly;

  return (
    <Overlay onClose={onClose}>
      <ModalBox title="Add from Full Catalog">
        <div style={{ marginBottom: 12 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products…"
            style={{ width: "100%", padding: "8px 12px", fontSize: 13, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }} />
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: "24px", textAlign: "center", color: CLR.faint, fontSize: 13 }}>
            {catalogOnly.length === 0 ? "All catalog products are already in the eligible list." : "No products match your search."}
          </div>
        ) : (
          <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid #e5e7eb" }}>
            {filtered.map(p => (
              <div key={p.id} onClick={() => onSelect(p)}
                style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                onMouseLeave={e => (e.currentTarget.style.background = "")}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: CLR.primary, fontWeight: 700 }}>{p.key}</span>
                    <span style={{ fontSize: 10, padding: "1px 5px", background: "#f3f4f6", color: CLR.muted, border: "1px solid #e5e7eb" }}>{p.type}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                  {p.nameAr && <div style={{ fontSize: 11, color: CLR.muted, direction: "rtl", textAlign: "right" as const }}>{p.nameAr}</div>}
                  <div style={{ fontSize: 10, color: "#b45309", marginTop: 2 }}>No pricing for this customer — manual price required</div>
                </div>
                <button style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" as const }}>
                  + Add
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <GhostBtn onClick={onClose} disabled={false}>Close</GhostBtn>
        </div>
      </ModalBox>
    </Overlay>
  );
}


// ── Shared Product Picker Popup ──────────────────────────────────────────────

function ProductPicker({ products, onSelect, onClose }: {
  products: EligibleProduct[];
  onSelect: (p: EligibleProduct) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);

  const filtered = products.filter(p =>
    !q
    || p.key.toLowerCase().includes(q.toLowerCase())
    || p.name.toLowerCase().includes(q.toLowerCase())
    || (p.nameAr ?? "").includes(q)
  ).slice(0, 15);

  return (
    <div ref={ref} style={{
      position: "absolute", top: "100%", left: 0,
      zIndex: 600, width: 340, background: "#fff",
      border: "1px solid #d1d5db", boxShadow: "0 8px 24px rgba(0,0,0,0.13)",
    }}>
      <input
        autoFocus value={q} onChange={e => setQ(e.target.value)}
        placeholder="Search ID or name…"
        style={{ width: "100%", padding: "8px 10px", fontSize: 12, border: "none", borderBottom: "1px solid #e5e7eb", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }}
      />
      <div style={{ maxHeight: 220, overflowY: "auto" }}>
        {filtered.length === 0
          ? <div style={{ padding: "10px 12px", fontSize: 11, color: CLR.faint }}>No products</div>
          : filtered.map(p => (
            <div key={p.id}
              onMouseDown={() => { onSelect(p); onClose(); }}
              style={{ padding: "8px 12px", cursor: "pointer", borderBottom: "1px solid #f9fafb" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: CLR.primary, fontWeight: 700 }}>{p.key}</span>
                <span style={{ fontSize: 10, padding: "1px 5px", background: "#f3f4f6", color: CLR.muted, border: "1px solid #e5e7eb" }}>{p.type}</span>
              </div>
              <div style={{ fontSize: 12, fontWeight: 500, color: CLR.text, marginTop: 1 }}>{p.name}</div>
              {p.nameAr && <div style={{ fontSize: 11, color: CLR.muted, direction: "rtl", textAlign: "right" as const }}>{p.nameAr}</div>}
              <div style={{ fontSize: 10, color: CLR.faint, marginTop: 2 }}>
                {p.prices.length === 0 ? "No pricing" : p.prices.map(pr => (
                  <span key={pr.billingPeriod} style={{ marginRight: 6 }}>
                    {PERIOD_LABEL[pr.billingPeriod] ?? pr.billingPeriod}: {fmtAmount(pr.priceCents, pr.currency)}
                  </span>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

// ── Period cell ─────────────────────────────────────────────────────────────

function PeriodCell({ value, prod, currency, readOnly, onChange, selectStyle }: {
  value: string; prod?: EligibleProduct;
  currency: string; readOnly?: boolean;
  onChange: (p: string) => void;
  selectStyle?: React.CSSProperties;
}) {
  useEffect(() => {
    if (value) return;
    const firstPriced = PERIOD_ORDER.find(p => prod?.prices.find(pr => pr.billingPeriod === p));
    const firstPeriod = firstPriced ?? prod?.billingPeriods?.[0] ?? "";
    if (firstPeriod) onChange(firstPeriod);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prod?.id]);

  const selectedPriceRow = prod?.prices.find(pr => pr.billingPeriod === value);

  if (readOnly) {
    return (
      <span style={{ fontSize: 11, color: value ? CLR.muted : CLR.faint }}>
        {value ? (PERIOD_LABEL[value] ?? value) : "N/A"}
      </span>
    );
  }

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        width: "100%", padding: "6px 5px", fontSize: 11,
        border: `1px solid ${selectedPriceRow ? "#86efac" : "#d1d5db"}`,
        fontFamily: "inherit",
        background: selectedPriceRow ? "#f0fdf4" : "#fff",
        color: selectedPriceRow ? "#15803d" : CLR.text,
        fontWeight: selectedPriceRow ? 600 : 400,
        ...(selectStyle ?? {}),
      }}
    >
      <option value="">N/A</option>
      {PERIOD_ORDER.map(p => {
        const pr = prod?.prices.find(pr2 => pr2.billingPeriod === p);
        return (
          <option key={p} value={p} style={{ color: pr ? "#15803d" : "#9ca3af", fontWeight: pr ? 600 : 400 }}>
            {pr ? "✓ " : ""}{PERIOD_LABEL[p]}{pr ? ` — ${fmtAmount(pr.priceCents, currency)}` : "  (no price)"}
          </option>
        );
      })}
    </select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Line Items Editor
// ─────────────────────────────────────────────────────────────────────────────

export interface LineEditorProps {
  lines: LineItem[];
  onChange: (lines: LineItem[]) => void;
  currency: string;
  vatPercent: number;
  eligibleProducts: EligibleProduct[];
  allProducts: EligibleProduct[];
  readOnly?: boolean;
}

export function LineItemsEditor({
  lines, onChange, currency, vatPercent, eligibleProducts, allProducts, readOnly,
}: LineEditorProps) {

  function addLine(nonInventory = false) {
    onChange([...lines, emptyLine(nonInventory)]);
  }

  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function addAllEligible() {
    const newLines: LineItem[] = eligibleProducts.map(p => {
      const firstPeriod = p.billingPeriods[0] ?? "";
      const price = p.prices.find(pr => pr.billingPeriod === firstPeriod)?.priceCents ?? 0;
      return {
        ...emptyLine(false),
        productId: p.id, productKey: p.key, description: p.name,
        descriptionAr: p.nameAr ?? "", productDetails: p.productDetails ?? "",
        detailsAr: p.detailsAr ?? "", billingPeriod: firstPeriod,
        unitPrice: price, lineTotal: calcLineTotal(price, 1, 0),
      };
    });
    onChange([...lines, ...newLines]);
  }

  function addFromCatalog(p: EligibleProduct) {
    const firstPriced = PERIOD_ORDER.find(per => p.prices.find(pr => pr.billingPeriod === per));
    const firstPeriod = firstPriced ?? p.billingPeriods[0] ?? "";
    const price = p.prices.find(pr => pr.billingPeriod === firstPeriod)?.priceCents ?? 0;
    onChange([...lines, {
      ...emptyLine(false),
      productId: p.id, productKey: p.key, description: p.name,
      descriptionAr: p.nameAr ?? "", productDetails: p.productDetails ?? "",
      detailsAr: p.detailsAr ?? "", billingPeriod: firstPeriod,
      unitPrice: price, lineTotal: calcLineTotal(price, 1, 0),
    }]);
  }

  function removeLine(i: number) { onChange(lines.filter((_, idx) => idx !== i)); }

  function patchLine(i: number, patch: Partial<LineItem>) {
    onChange(lines.map((l, idx) => {
      if (idx !== i) return l;
      const next = { ...l, ...patch };
      next.lineTotal = calcLineTotal(next.unitPrice, next.quantity, next.discount);
      return next;
    }));
  }

  function onProductSelect(i: number, p: EligibleProduct) {
    const firstPeriod = p.billingPeriods[0] ?? "";
    const price = p.prices.find(pr => pr.billingPeriod === firstPeriod)?.priceCents ?? 0;
    patchLine(i, {
      productId: p.id, productKey: p.key,
      description: p.name, descriptionAr: p.nameAr ?? "",
      productDetails: p.productDetails ?? "", detailsAr: p.detailsAr ?? "",
      billingPeriod: firstPeriod, unitPrice: price,
    });
  }

  function onPeriodChange(i: number, period: string) {
    const line = lines[i];
    const prod = [...eligibleProducts, ...allProducts].find(p => p.id === line.productId);
    const price = prod?.prices.find(pr => pr.billingPeriod === period)?.priceCents;
    patchLine(i, { billingPeriod: period, ...(price !== undefined ? { unitPrice: price } : {}) });
  }

  const subtotal  = lines.reduce((s, l) => s + l.lineTotal, 0);
  const vatAmount = Math.round((subtotal * vatPercent) / 100);
  const total     = subtotal + vatAmount;

  const mobileInp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", fontSize: 13,
    border: "1px solid #d1d5db", fontFamily: "inherit",
    textAlign: "right" as const, background: readOnly ? "#f9fafb" : "#fff",
    MozAppearance: "textfield" as any,
    appearance: "textfield" as any,
  };
  const numInp: React.CSSProperties = {
    width: "100%", padding: "6px 7px", fontSize: 12,
    border: "1px solid #d1d5db", fontFamily: "inherit",
    textAlign: "right" as const, background: readOnly ? "#f9fafb" : "#fff",
    MozAppearance: "textfield" as any,
    appearance: "textfield" as any,
  };
  const txtInp: React.CSSProperties = {
    width: "100%", padding: "6px 8px", fontSize: 12,
    border: "1px solid #d1d5db", fontFamily: "inherit",
    background: readOnly ? "#f9fafb" : "#fff",
  };

  // Desktop: Product ID | Description | toggle | Period | Qty | Unit Price | Disc% | Total | Remove
  // Mobile:  Product ID | Description | toggle | Period | Qty | Unit Price | Total | Remove
  const grid = isMobile
    ? "70px 1fr 22px 90px 46px 80px 72px 24px"
    : "88px 1fr 22px 110px 58px 100px 58px 100px 24px";

  return (
    <div>
      {/* Header */}
      {!isMobile && <div style={{
        display: "grid", gridTemplateColumns: grid, gap: "0 2px",
        padding: "7px 8px", background: "#f9fafb",
        border: "1px solid #e5e7eb", borderBottom: "none",
        fontSize: 10, fontWeight: 700, color: CLR.muted,
        letterSpacing: "0.05em", textTransform: "uppercase" as const,
      }}>
        <span>PRODUCT ID</span>
        <span>DESCRIPTION</span>
        <span />
        <span>PERIOD</span>
        <span style={{ textAlign: "right" as const }}>QTY</span>
        <span style={{ textAlign: "right" as const }}>UNIT PRICE</span>
        <span style={{ textAlign: "right" as const }}>DISC %</span>
        <span style={{ textAlign: "right" as const }}>TOTAL</span>
        <span />
      </div>}

      {/* Lines */}
      <div style={{ border: "1px solid #e5e7eb" }}>
        {lines.length === 0 && (
          <div style={{ padding: "18px", fontSize: 12, color: CLR.faint, textAlign: "center" }}>
            No items — use the buttons below to add products or custom items.
          </div>
        )}

        {lines.map((line, i) => {
          const searchPool = line.isNonInventory ? [] : eligibleProducts;
          const lookupPool = [...eligibleProducts, ...allProducts];
          const prod = lookupPool.find(p => p.id === line.productId);

          if (isMobile) {
            // ── Mobile card layout ───────────────────────────────────────
            return (
              <React.Fragment key={i}>
                <div style={{
                  borderBottom: "2px solid #a9a9a9", borderRadius: 0,
                  background: line.showDetails ? "#fffef9" : "#fff",
                  marginBottom: 25, paddingBottom: 25,
                }}>
                  {/* Row 1: Product ID + Remove */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ flex: 1, marginRight: 8 }}>
                      {line.isNonInventory
                        ? <input value={line.productKey} onChange={e => patchLine(i, { productKey: e.target.value })}
                            placeholder="Product ID…" style={{ width: "100%", padding: "9px 12px", fontSize: 13, fontFamily: "monospace", border: "1px solid #d1d5db", background: "#fff", outline: "none", boxSizing: "border-box" as const }} />
                        : readOnly
                          ? <span style={{ fontSize: 11, fontFamily: "monospace", color: CLR.primary, fontWeight: 700 }}>{line.productKey || "—"}</span>
                          : <ProductIDCell value={line.productKey} products={searchPool} onSelect={p => onProductSelect(i, p)} onChange={v => patchLine(i, { productKey: v })} inputStyle={{ padding: "9px 12px", fontSize: 13 }} />
                      }
                    </div>
                    {!readOnly && (
                      <button onClick={() => removeLine(i)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#dc2626", lineHeight: 1, padding: "0 4px" }}>✕</button>
                    )}
                  </div>

                  {/* Row 2: Description */}
                  <div style={{ marginBottom: 6 }}>
                    {line.isNonInventory
                      ? <input value={line.description} onChange={e => patchLine(i, { description: e.target.value })}
                          placeholder="Description…" style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }} />
                      : readOnly
                        ? <span style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{line.description || "—"}</span>
                        : <DescriptionCell value={line.description} products={searchPool} onSelect={p => onProductSelect(i, p)} onChange={v => patchLine(i, { description: v })} inputStyle={{ padding: "9px 12px", fontSize: 13 }} />
                    }
                  </div>

                  {/* Row 3: Period */}
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, textTransform: "uppercase" as const, letterSpacing: "0.04em", display: "block", marginBottom: 3 }}>Period</span>
                    <PeriodCell value={line.billingPeriod} prod={prod} currency={currency} readOnly={readOnly} onChange={period => onPeriodChange(i, period)} selectStyle={{ padding: "9px 12px", fontSize: 13 }} />
                  </div>

                  {/* Row 4: Qty + Unit Price + Total */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 6 }}>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, textTransform: "uppercase" as const, letterSpacing: "0.04em", display: "block", marginBottom: 3 }}>Qty</span>
                      <input type="number" min={1} value={line.quantity}
                        onChange={e => patchLine(i, { quantity: Math.max(1, Number(e.target.value)) })}
                        disabled={readOnly} style={{ ...mobileInp, textAlign: "left" as const }} />
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, textTransform: "uppercase" as const, letterSpacing: "0.04em", display: "block", marginBottom: 3 }}>Unit Price</span>
                      <input type="number" min={0} step={0.01}
                        value={line.unitPrice === 0 ? "" : line.unitPrice / 100}
                        onChange={e => patchLine(i, { unitPrice: Math.round(Number(e.target.value || "0") * 100) })}
                        disabled={readOnly} style={mobileInp} />
                    </div>
                    <div>
                      <span style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, textTransform: "uppercase" as const, letterSpacing: "0.04em", display: "block", marginBottom: 3 }}>Total</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: CLR.primary }}>{fmtAmount(line.lineTotal, currency)}</span>
                    </div>
                  </div>

                  {/* Expand toggle */}
                  <button onClick={() => patchLine(i, { showDetails: !line.showDetails })}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: line.showDetails ? CLR.primary : CLR.muted, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
                    {line.showDetails ? "▲ Hide details" : "▼ Disc % & more"}
                  </button>

                  {/* Expand panel */}
                  {line.showDetails && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #f3f4f6" }}>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const }}>Discount %</label>
                        <input type="number" min={0} max={100} step={0.1} value={line.discount}
                          onChange={e => patchLine(i, { discount: Number(e.target.value) })}
                          disabled={readOnly} style={{ ...mobileInp, width: 100 }} />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const }}>Arabic Name</label>
                        <input value={line.descriptionAr} onChange={e => patchLine(i, { descriptionAr: e.target.value })}
                          disabled={readOnly} dir="rtl" placeholder="الاسم بالعربية…" style={{ ...txtInp, padding: "9px 12px", fontSize: 13 }} />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const }}>Details EN</label>
                        <textarea value={line.productDetails} onChange={e => patchLine(i, { productDetails: e.target.value })}
                          disabled={readOnly} rows={2} placeholder="Product details in English…"
                          style={{ ...txtInp, padding: "9px 12px", fontSize: 13, resize: "vertical" }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const }}>Details AR</label>
                        <textarea value={line.detailsAr} onChange={e => patchLine(i, { detailsAr: e.target.value })}
                          disabled={readOnly} rows={2} dir="rtl" placeholder="تفاصيل المنتج بالعربية…"
                          style={{ ...txtInp, padding: "9px 12px", fontSize: 13, resize: "vertical" }} />
                      </div>
                    </div>
                  )}
                </div>
              </React.Fragment>
            );
          }

          // ── Desktop grid layout ────────────────────────────────────────
          return (
            <React.Fragment key={i}>
              <div style={{
                display: "grid", gridTemplateColumns: grid, gap: "0 2px",
                borderBottom: line.showDetails ? "none" : "1px solid #f3f4f6",
                alignItems: "center",
                background: line.showDetails ? "#fffef9" : undefined,
              }}>
                {/* Product ID */}
                <div style={{ padding: "5px 5px", position: "relative" }}>
                  {readOnly
                    ? <span style={{ fontSize: 11, fontFamily: "monospace", color: CLR.primary, fontWeight: 700 }}>{line.productKey || "—"}</span>
                    : line.isNonInventory
                      ? <input value={line.productKey} onChange={e => patchLine(i, { productKey: e.target.value })}
                          placeholder="—" style={{ width: "100%", padding: "6px 7px", fontSize: 11, fontFamily: "monospace", border: "1px solid #d1d5db", background: "#fff", outline: "none", boxSizing: "border-box" as const }} />
                      : <ProductIDCell value={line.productKey} products={searchPool} onSelect={p => onProductSelect(i, p)} onChange={v => patchLine(i, { productKey: v })} />
                  }
                </div>

                {/* Description */}
                <div style={{ padding: "5px 4px", position: "relative" }}>
                  {readOnly
                    ? <span style={{ fontSize: 12 }}>{line.description || "—"}</span>
                    : line.isNonInventory
                      ? <input value={line.description} onChange={e => patchLine(i, { description: e.target.value })}
                          placeholder="Custom item description…" style={{ width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }} />
                      : <DescriptionCell value={line.description} products={searchPool} onSelect={p => onProductSelect(i, p)} onChange={v => patchLine(i, { description: v })} />
                  }
                </div>

                {/* Details toggle */}
                <div style={{ padding: "5px 2px", textAlign: "center" as const }}>
                  <button onClick={() => patchLine(i, { showDetails: !line.showDetails })}
                    title="Toggle Arabic name and product details"
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: line.showDetails ? CLR.primary : CLR.faint, padding: 0, lineHeight: 1 }}>
                    {line.showDetails ? "▲" : "▼"}
                  </button>
                </div>

                {/* Period */}
                <div style={{ padding: "5px 4px" }}>
                  <PeriodCell value={line.billingPeriod} prod={prod} currency={currency} readOnly={readOnly} onChange={period => onPeriodChange(i, period)} />
                </div>

                {/* Qty */}
                <div style={{ padding: "5px 3px" }}>
                  <input type="number" min={1} value={line.quantity}
                    onChange={e => patchLine(i, { quantity: Math.max(1, Number(e.target.value)) })}
                    disabled={readOnly} style={numInp} />
                </div>

                {/* Unit price */}
                <div style={{ padding: "5px 3px" }}>
                  <input type="number" min={0} step={0.01}
                    value={line.unitPrice === 0 ? "" : line.unitPrice / 100}
                    onChange={e => patchLine(i, { unitPrice: Math.round(Number(e.target.value || "0") * 100) })}
                    disabled={readOnly} style={numInp} />
                </div>

                {/* Discount */}
                <div style={{ padding: "5px 3px" }}>
                  <input type="number" min={0} max={100} step={0.1} value={line.discount}
                    onChange={e => patchLine(i, { discount: Number(e.target.value) })}
                    disabled={readOnly} style={numInp} />
                </div>

                {/* Total */}
                <div style={{ padding: "5px 5px", fontWeight: 600, fontSize: 12, textAlign: "right" as const }}>
                  {fmtAmount(line.lineTotal, currency)}
                </div>

                {/* Remove */}
                <div style={{ padding: "5px 3px", textAlign: "center" as const }}>
                  {!readOnly && (
                    <button onClick={() => removeLine(i)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#dc2626", lineHeight: 1 }}>✕</button>
                  )}
                </div>
              </div>

              {/* Expandable details panel */}
              {line.showDetails && (
                <div style={{ borderBottom: "1px solid #f3f4f6", background: "#fffef9", padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: CLR.primary, letterSpacing: "0.04em", marginBottom: 10, textTransform: "uppercase" as const }}>
                    Line-level overrides — these edits apply to this document only and will NOT change the product catalog
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const }}>Arabic Name (this line only)</label>
                      <input value={line.descriptionAr} onChange={e => patchLine(i, { descriptionAr: e.target.value })}
                        disabled={readOnly} dir="rtl" placeholder="الاسم بالعربية…" style={txtInp} />
                    </div>
                    <div>
                      <label style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const }}>Details EN (this line only)</label>
                      <textarea value={line.productDetails} onChange={e => patchLine(i, { productDetails: e.target.value })}
                        disabled={readOnly} rows={2} placeholder="Product details in English…"
                        style={{ ...txtInp, resize: "vertical" }} />
                    </div>
                    <div style={{ gridColumn: "1/-1" }}>
                      <label style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, display: "block", marginBottom: 3, textTransform: "uppercase" as const }}>Details AR (this line only)</label>
                      <textarea value={line.detailsAr} onChange={e => patchLine(i, { detailsAr: e.target.value })}
                        disabled={readOnly} rows={2} dir="rtl" placeholder="تفاصيل المنتج بالعربية…"
                        style={{ ...txtInp, resize: "vertical" }} />
                    </div>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Add buttons */}
      {!readOnly && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={() => addLine(false)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", background: CLR.primaryBg, color: CLR.primary, border: `1px solid ${CLR.primary}44`, cursor: "pointer", fontFamily: "inherit" }}>
            + Add Product Line
          </button>
          <button onClick={() => addLine(true)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", background: "#fffbeb", color: "#b45309", border: "1px solid #fcd34d", cursor: "pointer", fontFamily: "inherit" }}>
            + Add Non-Inventory Item
          </button>
          {eligibleProducts.length > 0 && (
            <button onClick={addAllEligible} title="Add all products available for this customer's market & group"
              style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", cursor: "pointer", fontFamily: "inherit" }}>
              + Add All Available ({eligibleProducts.length})
            </button>
          )}
          <button onClick={() => setShowCatalogPicker(true)} title="Pick a product from the full catalog"
            style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", cursor: "pointer", fontFamily: "inherit" }}>
            + From Full Catalog
          </button>
        </div>
      )}

      {showCatalogPicker && (
        <CatalogPickerModal
          allProducts={allProducts}
          eligibleProducts={eligibleProducts}
          currency={currency}
          onSelect={p => { addFromCatalog(p); setShowCatalogPicker(false); }}
          onClose={() => setShowCatalogPicker(false)}
        />
      )}

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <div style={{ minWidth: 300 }}>
          <TRow label="Subtotal" value={fmtAmount(subtotal, currency)} />
          {vatPercent > 0 && (
            <TRow label={`VAT (${vatPercent}%)`} value={fmtAmount(vatAmount, currency)} />
          )}
          <TRow label="Grand Total" value={fmtAmount(total, currency)} bold />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create Document Modal
// ─────────────────────────────────────────────────────────────────────────────

export function CreateDocModal({ docType, onClose, onCreated }: {
  docType: SalesDocumentType; onClose: () => void;
  onCreated: (docNum?: string, docId?: string) => void;
}) {
  const [customer, setCustomer]         = useState<Customer | null>(null);
  const [eligibleProducts, setEligible] = useState<EligibleProduct[]>([]);
  const [allProducts, setAllProducts]   = useState<EligibleProduct[]>([]);
  const [loadingProds, setLoadingProds] = useState(false);

  const currency   = customer?.market.defaultCurrency ?? "USD";
  const marketId   = customer?.market.id ?? "";
  const vatPercent = customer ? Number(customer.market.vatPercent ?? 0) : 0;

  const [subject, setSubject]       = useState("");
  const [issueDate, setIssueDate]   = useState(todayISO());
  const [dueDate, setDueDate]       = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [refNum, setRefNum]         = useState("");
  const [lines, setLines]           = useState<LineItem[]>([]);
  const [notes, setNotes]           = useState("");
  const [intNote, setIntNote]       = useState("");
  const [terms, setTerms]           = useState("");
  const [file, setFile]             = useState<File | null>(null);
  const fileRef                     = useRef<HTMLInputElement>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState("");

  useEffect(() => {
    if (!customer) { setEligible([]); return; }
    setLoadingProds(true);
    fetch(`/api/admin/subscriptions/eligible-products?customerId=${customer.id}&rich=1`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          setEligible([
            ...(d.plans    ?? []),
            ...(d.addons   ?? []),
            ...(d.services ?? []),
            ...(d.products ?? []),
          ]);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingProds(false));
  }, [customer]);

  useEffect(() => {
    if (!marketId) return;
    Promise.all([
      fetch("/api/admin/catalog/products").then(r => r.json()).catch(() => ({ data: [] })),
      fetch("/api/admin/catalog/pricing").then(r => r.json()).catch(() => ({ data: [] })),
      fetch("/api/admin/catalog/pricing/meta").then(r => r.json()).catch(() => ({ data: { groups: [] } })),
    ]).then(([catalog, pricingResp, metaResp]) => {
      const groups: any[] = metaResp.data?.groups ?? [];
      const stdGroup   = groups.find((g: any) => g.key === "standard") ?? groups[0];
      const stdGroupId = stdGroup?.id ?? "";
      const pricingRows: any[] = pricingResp.data ?? [];
      const stdMap = new Map<string, number>();
      for (const row of pricingRows) {
        if (row.customerGroupId === stdGroupId && row.marketId === marketId) {
          stdMap.set(`${row.productId}:${row.billingPeriod}`, row.priceCents);
        }
      }
      setAllProducts((catalog.data ?? []).filter((p: any) => p.isActive).map((p: any) => {
        const periodsFromProduct: string[] = p.billingPeriods ?? [];
        const periodsFromPricing = pricingRows
          .filter((r: any) => r.productId === p.id && r.customerGroupId === stdGroupId && r.marketId === marketId)
          .map((r: any) => r.billingPeriod);
        const periods: string[] = periodsFromProduct.length > 0 ? periodsFromProduct : periodsFromPricing;
        const prices = periods
          .map((period: string) => {
            const cents = stdMap.get(`${p.id}:${period}`);
            if (cents === undefined) return null;
            return { billingPeriod: period, priceCents: cents, currency, isOverride: false };
          })
          .filter(Boolean) as EligibleProduct["prices"];
        return {
          id: p.id, key: p.key, name: p.name, nameAr: p.nameAr ?? null,
          productDetails: p.productDetails ?? null, detailsAr: p.detailsAr ?? null,
          type: p.type, billingPeriods: periods, prices,
          unitLabel: p.unitLabel ?? null,
        };
      }));
    });
  }, [marketId]);

  useEffect(() => { setLines([]); }, [customer?.id]);

  useEffect(() => {
    if (!customer) return;
    setTerms("");
    fetch("/api/admin/settings/markets")
      .then(r => r.json())
      .then(d => {
        const m = (d.markets ?? []).find((m: any) => m.id === customer.market.id);
        const t = (m?.legalInfo as any)?.defaultPaymentTerms ?? "";
        if (t) setTerms(t);
      })
      .catch(() => {});
  }, [customer?.id]);

  useEffect(() => {
    if (docType !== "QUOTATION") return;
    if (validUntil) return;
    if (!issueDate) return;
    const d = new Date(issueDate);
    d.setDate(d.getDate() + 30);
    setValidUntil(d.toISOString().split("T")[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueDate, docType]);

  const label = TYPE_LABEL[docType] ?? docType;

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none" };
  const fl:  React.CSSProperties = { fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em", marginBottom: 4, display: "block", textTransform: "uppercase" as const };
  const sec: React.CSSProperties = { background: "#fff", border: "1px solid #e5e7eb", padding: "16px 18px" };
  const st:  React.CSSProperties = { fontSize: 11, fontWeight: 700, color: CLR.muted, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 14 };
  const [modalMobile, setModalMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  useEffect(() => {
    const h = () => setModalMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  async function submit() {
    if (!customer)          { setError("Select a customer."); return; }
    if (lines.length === 0) { setError("Add at least one line item."); return; }
    setLoading(true); setError("");
    try {
      let rfqFileUrl: string | undefined;
      if (file) {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("docType", docType);
        const uploadRes  = await fetch("/api/admin/sales/upload", { method: "POST", body: fd });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error ?? "Upload failed");
        rfqFileUrl = uploadData.url;
      }

      const body: Record<string, unknown> = {
        customerId: customer.id, marketId,
        rfqFileUrl: rfqFileUrl ?? null,
        subject: subject || null, referenceNumber: refNum || null,
        notes: notes || null, internalNote: intNote || null,
        termsAndConditions: terms || null,
        issueDate, dueDate: dueDate || null,
        ...(docType === "QUOTATION" ? { validUntil: validUntil || null } : {}),
        lines: lines.map(l => ({
          productId:      l.productId ?? null,
          description:    l.description,
          descriptionAr:  l.descriptionAr  || null,
          productDetails: l.productDetails || null,
          detailsAr:      l.detailsAr      || null,
          billingPeriod:  l.billingPeriod  || null,
          quantity:       l.quantity,
          unitPrice:      l.unitPrice,
          discount:       l.discount,
        })),
      };
      const res  = await fetch(ENDPOINT_MAP[docType], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onCreated(data.doc?.docNum, data.doc?.id);
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <Overlay onClose={onClose} blockOutsideClick>
      <ModalBox title={`New ${label}`} wide onClose={onClose}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Customer */}
          <div style={sec}>
            <p style={st}>Customer</p>
            <CustomerSearch value={customer} onChange={setCustomer} />
            {customer && (
              <div style={{ display: "flex", gap: 20, marginTop: 10, padding: "8px 12px", background: CLR.primaryBg, border: `1px solid ${CLR.primary}33`, fontSize: 12, flexWrap: "wrap" }}>
                <span><span style={{ color: CLR.muted }}>Market: </span><strong>{customer.market.name}</strong></span>
                <span><span style={{ color: CLR.muted }}>Currency: </span><strong style={{ color: CLR.primary }}>{currency}</strong></span>
                <span>
                  <span style={{ color: CLR.muted }}>VAT: </span>
                  <strong style={{ color: vatPercent > 0 ? "#b45309" : CLR.muted }}>{vatPercent}%</strong>
                  <span style={{ color: CLR.faint, marginLeft: 4, fontSize: 11 }}>
                    {vatPercent === 0 ? "(no tax)" : `(${currency} · ${vatPercent}% VAT)`}
                  </span>
                </span>
                {loadingProds && <span style={{ color: CLR.faint }}>Loading products…</span>}
                {!loadingProds && eligibleProducts.length > 0 && (
                  <span style={{ color: CLR.primary, fontWeight: 600 }}>{eligibleProducts.length} products available</span>
                )}
              </div>
            )}
          </div>

          {/* Document Info */}
          <div style={sec}>
            <p style={st}>Document Info</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={fl}>Subject / Title</label>
                <input value={subject} onChange={e => setSubject(e.target.value)}
                  placeholder={`e.g. Cloud services for ${customer?.fullName ?? "customer"}…`}
                  style={inp} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: modalMobile ? "1fr" : `repeat(${docType === "QUOTATION" ? 3 : 2}, 1fr)`, gap: 10 }}>
                <div>
                  <label style={fl}>Date</label>
                  <input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} style={inp} />
                </div>
                <div>
                  <label style={fl}>Due Date (optional)</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inp} />
                </div>
                {docType === "QUOTATION" && (
                  <div>
                    <label style={fl}>Valid Until</label>
                    <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} style={inp} />
                    <p style={{ fontSize: 11, color: CLR.faint, marginTop: 3 }}>Auto-set to 30 days from issue date. Edit to override.</p>
                  </div>
                )}
              </div>
              <div>
                <label style={fl}>Reference Number</label>
                <input value={refNum} onChange={e => setRefNum(e.target.value)}
                  placeholder="Customer PO#, ref, ticket…" style={inp} />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div style={sec}>
            <p style={st}>Line Items</p>
            <LineItemsEditor
              lines={lines} onChange={setLines}
              currency={currency} vatPercent={vatPercent}
              eligibleProducts={eligibleProducts}
              allProducts={allProducts}
            />
          </div>

          {/* Notes */}
          <div style={sec}>
            <p style={st}>Notes</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={fl}>Customer-visible notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} />
              </div>
              <div>
                <label style={fl}>Internal note (admin only)</label>
                <textarea value={intNote} onChange={e => setIntNote(e.target.value)} rows={3} style={{ ...inp, resize: "vertical", background: "#fffbeb" }} />
              </div>
            </div>
          </div>

          {/* Terms */}
          <div style={sec}>
            <p style={st}>Terms &amp; Conditions</p>
            <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={8}
              placeholder="Enter terms and conditions for this document…"
              style={{ ...inp, resize: "vertical" }} />
          </div>

          {/* Attachment */}
          <div style={sec}>
            <p style={st}>Attachment</p>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: "2px dashed #d1d5db", padding: "18px", textAlign: "center", cursor: "pointer", background: file ? CLR.primaryBg : "#fafafa" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = CLR.primary)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#d1d5db")}>
              {file ? (
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: CLR.primary }}>{file.name}</p>
                  <p style={{ fontSize: 11, color: CLR.muted, marginTop: 2 }}>
                    {(file.size / 1024).toFixed(1)} KB ·
                    <button onClick={e => { e.stopPropagation(); setFile(null); }}
                      style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11, marginLeft: 4 }}>Remove</button>
                  </p>
                </div>
              ) : (
                <>
                  <p style={{ fontSize: 13, color: CLR.muted }}>Click to attach a file</p>
                  <p style={{ fontSize: 11, color: CLR.faint, marginTop: 3 }}>PDF, image, Word, Excel — max 10 MB</p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" style={{ display: "none" }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={e => setFile(e.target.files?.[0] ?? null)} />
          </div>

          {error && (
            <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <GhostBtn onClick={onClose} disabled={loading}>Cancel</GhostBtn>
            <PrimaryBtn onClick={submit} disabled={loading || !customer || lines.length === 0}>
              {loading ? `Creating ${label}…` : `Create ${label}`}
            </PrimaryBtn>
          </div>
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

export function Overlay({ children, onClose, blockOutsideClick }: { children: React.ReactNode; onClose: () => void; blockOutsideClick?: boolean }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "0px 16px 32px 16px", overflowY: "auto" }}
      onClick={blockOutsideClick ? undefined : onClose}>
      <div onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}

export function ModalBox({ title, children, wide, onClose }: { title: string; children: React.ReactNode; wide?: boolean; onClose?: () => void }) {
  return (
    <div style={{ background: "#fff", width: wide ? "min(1100px, 98vw)" : "min(480px, 96vw)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
      <div style={{ padding: "16px 20px", borderTop: "4px solid #318774", fontSize: 15, fontWeight: 600, color: "#d9d9d9", position: "sticky", top: 0, background: "#151515", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>{title}</span>
        {onClose && (
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 20, lineHeight: 1, padding: "0 4px" }}>✕</button>
        )}
      </div>
      <div style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

export function PrimaryBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: "9px 20px", fontSize: 13, fontWeight: 600, background: disabled ? "#9ca3af" : CLR.primary, color: "#fff", border: "none", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
      {children}
    </button>
  );
}

export function GhostBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: "9px 20px", fontSize: 13, fontWeight: 600, background: "#fff", color: CLR.text, border: "1px solid #d1d5db", cursor: disabled ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SendEmailModal
// Handles "Send Reminder" and "Send Custom" dropdown options.
// "Send" and "Resend" fire directly without a modal.
// ─────────────────────────────────────────────────────────────────────────────

export interface SendEmailModalProps {
  docId:           string;
  docNum:          string;
  docType:         string;
  docStatus:       string;
  customerEmail:   string;
  reminderEnabled: boolean;
  reminderCount:   number;
  defaultCC?:      string;
  defaultBCC?:     string;
  mode:            "reminder" | "custom";
  onClose:         () => void;
  onSent: (result: {
    emailSentAt: string;
    emailSentCount: number;
    reminderCount?: number;
    reminderEnabled?: boolean;
  }) => void;
}

export function SendEmailModal({
  docId, docNum, docType, docStatus,
  customerEmail, reminderEnabled, reminderCount,
  defaultCC, defaultBCC, mode,
  onClose, onSent,
}: SendEmailModalProps) {
  const [to,            setTo]            = useState(customerEmail);
  const [cc,            setCc]            = useState(defaultCC  ?? "");
  const [bcc,           setBcc]           = useState(defaultBCC ?? "");
  const [customSubject, setCustomSubject] = useState(`${TYPE_LABEL[docType] ?? docType} ${docNum}`);
  const [customBody,    setCustomBody]    = useState("");
  const [saveDefaults,  setSaveDefaults]  = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [enabling,      setEnabling]      = useState(false);
  const [error,         setError]         = useState("");

  const canRemind  = docType === "INVOICE" && ["ISSUED","SENT","PARTIALLY_PAID","OVERDUE"].includes(docStatus);
  const maxReached = reminderCount >= 4;

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 10px", fontSize: 13,
    border: "1px solid #e5e7eb", outline: "none",
    fontFamily: "inherit", color: "#111827", background: "#fff",
    boxSizing: "border-box" as const,
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 600,
    color: "#6b7280", textTransform: "uppercase" as const,
    letterSpacing: "0.04em", marginBottom: 5,
  };

  async function toggleReminder(enable: boolean) {
    setEnabling(true); setError("");
    try {
      const res  = await fetch(`/api/admin/sales/${docId}/reminder`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: enable }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSent({ emailSentAt: new Date().toISOString(), emailSentCount: 0, reminderEnabled: enable, reminderCount: enable ? 0 : reminderCount });
      onClose();
    } catch (e: any) { setError(e.message); }
    setEnabling(false);
  }

  async function sendNow() {
    setLoading(true); setError("");
    try {
      const body: Record<string, any> = { mode };
      if (mode === "custom") {
        body.customSubject = customSubject;
        body.customBody    = customBody;
        body.to            = to;
        if (cc)  body.cc  = cc;
        if (bcc) body.bcc = bcc;
        body.saveDefaults = saveDefaults;
      }
      const res  = await fetch(`/api/admin/sales/${docId}/send-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSent({ emailSentAt: data.emailSentAt, emailSentCount: data.emailSentCount, reminderCount: data.reminderCount });
      onClose();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <Overlay onClose={onClose}>
      <ModalBox title={mode === "reminder" ? `Send Reminder — ${docNum}` : `Custom Send — ${docNum}`}>

        {/* ── REMINDER MODE ── */}
        {mode === "reminder" && (
          <div>
            {!canRemind && (
              <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", fontSize: 13, color: "#dc2626", marginBottom: 16 }}>
                Reminders are only available for unpaid invoices (Issued, Sent, Partially Paid, Overdue).
              </div>
            )}
            {canRemind && maxReached && (
              <div style={{ padding: "10px 14px", background: "#fef9c3", border: "1px solid #fcd34d", fontSize: 13, color: "#92400e", marginBottom: 16 }}>
                Maximum 4 reminders have been sent for this invoice.
              </div>
            )}
            {canRemind && !maxReached && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Weekly Auto-Reminder</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 8px",
                      background: reminderEnabled ? "#dcfce7" : "#f3f4f6",
                      color: reminderEnabled ? "#15803d" : "#6b7280",
                      border: `1px solid ${reminderEnabled ? "#86efac" : "#d1d5db"}`,
                    }}>
                      {reminderEnabled ? "ACTIVE" : "OFF"}
                    </span>
                  </div>
                  <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px", lineHeight: 1.6 }}>
                    {reminderEnabled
                      ? `Reminder ${reminderCount} of 4 sent. Next will be sent automatically in ~7 days.`
                      : "Enable to automatically send weekly reminders. Up to 4 total."}
                  </p>
                  {/* Progress bars */}
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    {[1,2,3,4].map(n => (
                      <div key={n} style={{ width: 28, height: 6, background: n <= reminderCount ? CLR.primary : "#e5e7eb" }} />
                    ))}
                    <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>{reminderCount}/4</span>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!reminderEnabled ? (
                    <button onClick={() => toggleReminder(true)} disabled={enabling}
                      style={{ flex: 1, padding: "9px 16px", fontSize: 13, fontWeight: 600, background: CLR.primary, color: "#fff", border: "none", cursor: enabling ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                      {enabling ? "Enabling…" : "Enable Weekly Reminders"}
                    </button>
                  ) : (
                    <button onClick={() => toggleReminder(false)} disabled={enabling}
                      style={{ flex: 1, padding: "9px 16px", fontSize: 13, fontWeight: 600, background: "#fff", color: "#dc2626", border: "1px solid #fecaca", cursor: enabling ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                      {enabling ? "Stopping…" : "Stop Reminders"}
                    </button>
                  )}
                  <button onClick={sendNow} disabled={loading}
                    style={{ flex: 1, padding: "9px 16px", fontSize: 13, fontWeight: 600, background: "#fffbeb", color: "#b45309", border: "1px solid #fcd34d", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                    {loading ? "Sending…" : "Send Now"}
                  </button>
                </div>
              </div>
            )}
            {error && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>{error}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
              <GhostBtn onClick={onClose} disabled={loading || enabling}>Close</GhostBtn>
            </div>
          </div>
        )}

        {/* ── CUSTOM MODE ── */}
        {mode === "custom" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={lbl}>To</label>
              <input style={inp} value={to} onChange={e => setTo(e.target.value)} placeholder="customer@example.com" />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={lbl}>CC</label>
                <input style={inp} value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@example.com" />
              </div>
              <div>
                <label style={lbl}>BCC</label>
                <input style={inp} value={bcc} onChange={e => setBcc(e.target.value)} placeholder="bcc@example.com" />
              </div>
            </div>
            <div>
              <label style={lbl}>Subject</label>
              <input style={inp} value={customSubject} onChange={e => setCustomSubject(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Message</label>
              <textarea style={{ ...inp, height: 100, resize: "vertical" }}
                value={customBody} onChange={e => setCustomBody(e.target.value)}
                placeholder="Optional message — appears before line items table." />
            </div>
            {(cc || bcc) && (
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#374151", cursor: "pointer" }}>
                <input type="checkbox" checked={saveDefaults} onChange={e => setSaveDefaults(e.target.checked)} style={{ accentColor: CLR.primary }} />
                Save CC/BCC as default for future sends
              </label>
            )}
            {error && <p style={{ fontSize: 12, color: "#dc2626" }}>{error}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <GhostBtn onClick={onClose} disabled={loading}>Cancel</GhostBtn>
              <PrimaryBtn onClick={sendNow} disabled={loading || !to}>
                {loading ? "Sending…" : "Send"}
              </PrimaryBtn>
            </div>
          </div>
        )}

      </ModalBox>
    </Overlay>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusChangeModal
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_TRANSITIONS_ALL: Record<string, string[]> = {
  DRAFT:          ["ISSUED", "VOID"],
  PENDING:        ["IN_REVIEW", "QUOTED", "CLOSED", "VOID"],
  IN_REVIEW:      ["QUOTED", "CLOSED", "VOID"],
  QUOTED:         ["CONVERTED", "CLOSED", "VOID"],
  ISSUED:         ["SENT", "ACCEPTED", "REJECTED", "VOID"],
  SENT:           ["ACCEPTED", "REJECTED", "REVISED", "VOID"],
  REVISED:        ["ACCEPTED", "REJECTED", "VOID"],
  ACCEPTED:       ["CONVERTED", "VOID"],
  REJECTED:       ["VOID"],
  PARTIALLY_PAID: ["PAID", "OVERDUE", "VOID"],
  OVERDUE:        ["PAID", "WRITTEN_OFF", "VOID"],
  DELIVERED:      ["CONVERTED", "VOID"],
  EXPIRED:        ["VOID"],
  PROCESSING:     ["CONVERTED", "VOID"],
  CONVERTED: [], PAID: [], WRITTEN_OFF: [], APPLIED: [], CLOSED: [], VOID: [], CANCELLED: [],
};

const STATUS_CLR: Record<string, { bg: string; color: string; border: string }> = {
  ISSUED:      { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  SENT:        { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  ACCEPTED:    { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  REJECTED:    { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  CONVERTED:   { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  PAID:        { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
  OVERDUE:     { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5" },
  VOID:        { bg: "#f3f4f6", color: "#6b7280", border: "#d1d5db" },
  WRITTEN_OFF: { bg: "#fdf4ff", color: "#7e22ce", border: "#e9d5ff" },
  IN_REVIEW:   { bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd" },
  QUOTED:      { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  CLOSED:      { bg: "#f3f4f6", color: "#374151", border: "#d1d5db" },
  REVISED:     { bg: "#fdf4ff", color: "#7e22ce", border: "#e9d5ff" },
  DEFAULT:     { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" },
};

export interface StatusChangeModalProps {
  docId:     string;
  docNum:    string;
  docType:   string;
  docStatus: string;
  onClose:   () => void;
  onChanged: (newStatus: string) => void;
}

export function StatusChangeModal({ docId, docNum, docType, docStatus, onClose, onChanged }: StatusChangeModalProps) {
  const [selected, setSelected] = useState("");
  const [note,     setNote]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  // INVOICE and CREDIT_NOTE: manual status change restricted to DRAFT, ISSUED, VOID only.
// SENT → via send email. PAID/PARTIALLY_PAID → via Record Payment. CONVERTED → via Convert button.
const INVOICE_MANUAL_STATUSES = ["DRAFT", "ISSUED", "VOID"];
const options = ["INVOICE", "CREDIT_NOTE"].includes(docType)
  ? INVOICE_MANUAL_STATUSES.filter(s => s !== docStatus)
  : (STATUS_TRANSITIONS_ALL[docStatus] ?? []);

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 10px", fontSize: 13,
    border: "1px solid #e5e7eb", outline: "none",
    fontFamily: "inherit", color: "#111827", background: "#fff",
    boxSizing: "border-box" as const,
  };

  async function apply() {
    if (!selected) return;
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/admin/sales/${docId}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selected, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onChanged(selected);
      onClose();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <Overlay onClose={onClose}>
      <ModalBox title={`Change Status — ${docNum}`}>
        <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
          Current: <strong style={{ color: "#111827" }}>{docStatus.replace(/_/g, " ")}</strong>
        </p>
        {options.length === 0 ? (
          <p style={{ fontSize: 13, color: "#6b7280" }}>No status changes available for {docStatus}.</p>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {options.map(s => {
                const c = STATUS_CLR[s] ?? STATUS_CLR.DEFAULT;
                const active = selected === s;
                return (
                  <button key={s} onClick={() => setSelected(s)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "10px 14px", cursor: "pointer", fontFamily: "inherit",
                      background: active ? c.bg : "#fff",
                      border: `1px solid ${active ? c.border : "#e5e7eb"}`,
                      textAlign: "left" as const,
                    }}>
                    <div style={{
                      width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${active ? c.color : "#d1d5db"}`,
                      background: active ? c.color : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {active && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff" }} />}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? c.color : "#374151" }}>
                      {s.replace(/_/g, " ")}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 5 }}>
                Note (optional — saved to audit log)
              </label>
              <textarea style={{ ...inp, height: 72, resize: "vertical" }}
                value={note} onChange={e => setNote(e.target.value)}
                placeholder="Reason for status change…" />
            </div>
          </>
        )}
        {error && <p style={{ fontSize: 12, color: "#1b1b1b", marginBottom: 10 }}>{error}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <GhostBtn onClick={onClose} disabled={loading}>Cancel</GhostBtn>
          <PrimaryBtn onClick={apply} disabled={loading || !selected}>
            {loading ? "Saving…" : "Change Status"}
          </PrimaryBtn>
        </div>
      </ModalBox>
    </Overlay>
  );
}