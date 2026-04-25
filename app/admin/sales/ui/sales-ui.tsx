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
  REPLIED:        { bg: "#e0f2fe", color: "#0369a1", border: "#7dd3fc" },
};

export function SalesStatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", background: s.bg, color: s.color, border: `1px solid ${s.border}`, letterSpacing: "0.04em", whiteSpace: "nowrap" as const }}>
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
    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", background: s.bg, color: s.color, border: `1px solid ${s.border}`, letterSpacing: "0.04em", whiteSpace: "nowrap" as const }}>
      {TYPE_LABEL[type] ?? type}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRow helper
// ─────────────────────────────────────────────────────────────────────────────

function TRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderTop: bold ? "2px solid #111827" : "1px solid #f3f4f6", fontWeight: bold ? 700 : 400, fontSize: bold ? 15 : 13 }}>
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
            <tr key={d.id} style={{ borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
              onClick={() => onOpen(d.id)}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <Td><span style={{ fontWeight: 600, color: CLR.primary, fontFamily: "monospace" }}>{d.docNum}</span></Td>
              {showType && <Td><DocTypeBadge type={d.type} /></Td>}
              <Td>
                <div style={{ fontWeight: 500 }}>{d.customer.fullName ?? d.customer.email}</div>
                <div style={{ fontSize: 11, color: CLR.faint }}>{d.customer.customerNumber}</div>
              </Td>
              <Td><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", background: "#f3f4f6", border: "1px solid #e5e7eb", color: CLR.muted }}>{d.market.key}</span></Td>
              <Td><SalesStatusBadge status={d.status} /></Td>
              <Td style={{ fontWeight: 600 }}>{fmtAmount(d.total, d.currency)}</Td>
              <Td style={{ color: CLR.muted }}>{fmtDate(d.issueDate)}</Td>
              <Td style={{ color: CLR.faint }}>{d.dueDate ? fmtDate(d.dueDate) : "—"}</Td>
              <Td style={{ color: CLR.faint, fontSize: 11 }}>{d.originDoc ? `${d.originDoc.type} ${d.originDoc.docNum}` : "—"}</Td>
              <Td>{onConvert && <ABtn onClick={() => onConvert(d.id)}>Convert</ABtn>}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
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
// Convert Modal
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
  onConverted: (redirectTo: string) => void;
}) {
  const options = CONVERT_OPTIONS[docType] ?? [];
  const [selected, setSelected] = useState<SalesDocumentType | "">("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function convert() {
    if (!selected) return;
    setLoading(true); setError("");
    try {
      const res  = await fetch(`/api/admin/sales/${docId}/convert`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType: selected }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Conversion failed");
      onConverted(data.redirectTo ?? "/admin/sales");
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <Overlay onClose={onClose}>
      <ModalBox title={`Convert ${docNum}`}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 13, color: CLR.muted }}>Select the document type to convert this {docType.replace(/_/g, " ")} into:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {options.map(opt => (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: `1px solid ${selected === opt ? CLR.primary : "#e5e7eb"}`, background: selected === opt ? CLR.primaryBg : "#fff", cursor: "pointer" }}>
                <input type="radio" name="convertType" value={opt} checked={selected === opt} onChange={() => setSelected(opt)} style={{ accentColor: CLR.primary }} />
                <DocTypeBadge type={opt} />
                <span style={{ fontSize: 13 }}>{TYPE_LABEL[opt]}</span>
              </label>
            ))}
          </div>
          {error && <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 12 }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <GhostBtn onClick={onClose} disabled={loading}>Cancel</GhostBtn>
            <PrimaryBtn onClick={convert} disabled={loading || !selected}>
              {loading ? "Converting…" : "Convert"}
            </PrimaryBtn>
          </div>
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
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: "1px 7px", background: CLR.primary, color: "#fff" }}>{value.market.key} · {value.market.defaultCurrency}</span>
          </div>
          <button onClick={() => { onChange(null); setQuery(""); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: CLR.muted, padding: "0 4px" }}>✕</button>
        </div>
      ) : (
        <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          placeholder="Search by name, email or customer #…" style={inp} />
      )}
      {open && !value && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 400, background: "#fff", border: "1px solid #d1d5db", borderTop: "none", maxHeight: 280, overflowY: "auto", boxShadow: "0 6px 20px rgba(0,0,0,0.12)" }}>
          {loading
            ? <div style={{ padding: "12px 14px", fontSize: 12, color: CLR.faint }}>Searching…</div>
            : results.length === 0
              ? <div style={{ padding: "12px 14px", fontSize: 12, color: CLR.faint }}>No customers found</div>
              : results.map(c => (
                <div key={c.id} onMouseDown={() => { onChange(c); setOpen(false); setQuery(""); }}
                  style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f3f4f6" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                  onMouseLeave={e => (e.currentTarget.style.background = "")}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{c.fullName ?? c.email}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", background: c.market.key === "SAUDI" ? "#dcfce7" : "#eff6ff", color: c.market.key === "SAUDI" ? "#15803d" : "#1d4ed8", border: `1px solid ${c.market.key === "SAUDI" ? "#86efac" : "#bfdbfe"}` }}>{c.market.key}</span>
                  </div>
                  <div style={{ fontSize: 11, color: CLR.faint, marginTop: 2 }}>{c.email} {c.customerNumber ? `· #${c.customerNumber}` : ""}</div>
                </div>
              ))
          }
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Product ID / Description cells
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
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Key…" style={{ width: "100%", padding: "6px 7px", fontSize: 11, fontFamily: "monospace", border: "1px solid #d1d5db", background: "#fff", outline: "none", boxSizing: "border-box" as const, ...(inputStyle ?? {}) }} />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 500, background: "#fff", border: "1px solid #d1d5db", minWidth: 280, maxHeight: 220, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
          {filtered.map(p => (
            <div key={p.id} onMouseDown={() => { onSelect(p); setOpen(false); }} style={{ padding: "7px 10px", cursor: "pointer", fontSize: 12 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <span style={{ fontFamily: "monospace", color: CLR.primary, fontWeight: 700, marginRight: 8 }}>{p.key}</span>{p.name}
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
      <input value={value} onChange={e => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(value.trim().length > 1)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Description…" style={{ width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const, ...(inputStyle ?? {}) }} />
      {open && filtered.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 500, background: "#fff", border: "1px solid #d1d5db", minWidth: 280, maxHeight: 200, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }}>
          {filtered.map(p => (
            <div key={p.id} onMouseDown={() => { onSelect(p); setOpen(false); }} style={{ padding: "7px 10px", cursor: "pointer", fontSize: 12 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
              <span style={{ fontFamily: "monospace", color: CLR.primary, fontWeight: 700, marginRight: 8 }}>{p.key}</span>{p.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Billing Period Select
// ─────────────────────────────────────────────────────────────────────────────

function BillingPeriodSelect({ value, prod, currency, readOnly, onChange, selectStyle }: {
  value: string; prod?: EligibleProduct; currency: string; readOnly?: boolean;
  onChange: (p: string) => void; selectStyle?: React.CSSProperties;
}) {
  useEffect(() => {
    if (value) return;
    const firstPriced = PERIOD_ORDER.find(p => prod?.prices.find(pr => pr.billingPeriod === p));
    const firstPeriod = firstPriced ?? prod?.billingPeriods?.[0] ?? "";
    if (firstPeriod) onChange(firstPeriod);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prod?.id]);

  const selectedPriceRow = prod?.prices.find(pr => pr.billingPeriod === value);

  if (readOnly) return <span style={{ fontSize: 11, color: value ? CLR.muted : CLR.faint }}>{value ? (PERIOD_LABEL[value] ?? value) : "N/A"}</span>;

  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "6px 5px", fontSize: 11, border: `1px solid ${selectedPriceRow ? "#86efac" : "#d1d5db"}`, fontFamily: "inherit", background: selectedPriceRow ? "#f0fdf4" : "#fff", color: selectedPriceRow ? "#15803d" : CLR.text, fontWeight: selectedPriceRow ? 600 : 400, ...(selectStyle ?? {}) }}>
      <option value="">N/A</option>
      {PERIOD_ORDER.map(p => {
        const pr = prod?.prices.find(pr2 => pr2.billingPeriod === p);
        return <option key={p} value={p} style={{ color: pr ? "#15803d" : "#9ca3af", fontWeight: pr ? 600 : 400 }}>
          {pr ? "✓ " : ""}{PERIOD_LABEL[p]}{pr ? ` — ${fmtAmount(pr.priceCents, currency)}` : "  (no price)"}
        </option>;
      })}
    </select>
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
  const filtered    = q.trim() ? catalogOnly.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.key.toLowerCase().includes(q.toLowerCase())) : catalogOnly;
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
                onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")} onMouseLeave={e => (e.currentTarget.style.background = "")}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontFamily: "monospace", fontSize: 11, color: CLR.primary, fontWeight: 700 }}>{p.key}</span>
                    <span style={{ fontSize: 10, padding: "1px 5px", background: "#f3f4f6", color: CLR.muted, border: "1px solid #e5e7eb" }}>{p.type}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
                  {p.nameAr && <div style={{ fontSize: 11, color: CLR.muted, direction: "rtl", textAlign: "right" as const }}>{p.nameAr}</div>}
                  <div style={{ fontSize: 10, color: "#b45309", marginTop: 2 }}>No pricing for this customer — manual price required</div>
                </div>
                <button style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" as const }}>+ Add</button>
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

export function LineItemsEditor({ lines, onChange, currency, vatPercent, eligibleProducts, allProducts, readOnly }: LineEditorProps) {
  const [showCatalogPicker, setShowCatalogPicker] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 768); }
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  function addLine(nonInventory = false) { onChange([...lines, emptyLine(nonInventory)]); }

  function addAllEligible() {
    const newLines: LineItem[] = eligibleProducts.map(p => {
      const firstPeriod = p.billingPeriods[0] ?? "";
      const price = p.prices.find(pr => pr.billingPeriod === firstPeriod)?.priceCents ?? 0;
      return { ...emptyLine(false), productId: p.id, productKey: p.key, description: p.name, descriptionAr: p.nameAr ?? "", productDetails: p.productDetails ?? "", detailsAr: p.detailsAr ?? "", billingPeriod: firstPeriod, unitPrice: price, lineTotal: calcLineTotal(price, 1, 0) };
    });
    onChange([...lines, ...newLines]);
  }

  function addFromCatalog(p: EligibleProduct) {
    const firstPriced = PERIOD_ORDER.find(per => p.prices.find(pr => pr.billingPeriod === per));
    const firstPeriod = firstPriced ?? p.billingPeriods[0] ?? "";
    const price = p.prices.find(pr => pr.billingPeriod === firstPeriod)?.priceCents ?? 0;
    onChange([...lines, { ...emptyLine(false), productId: p.id, productKey: p.key, description: p.name, descriptionAr: p.nameAr ?? "", productDetails: p.productDetails ?? "", detailsAr: p.detailsAr ?? "", billingPeriod: firstPeriod, unitPrice: price, lineTotal: calcLineTotal(price, 1, 0) }]);
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
    patchLine(i, { productId: p.id, productKey: p.key, description: p.name, descriptionAr: p.nameAr ?? "", productDetails: p.productDetails ?? "", detailsAr: p.detailsAr ?? "", billingPeriod: firstPeriod, unitPrice: price });
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

  const numInp: React.CSSProperties = { width: "100%", padding: "6px 7px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "inherit", textAlign: "right" as const, background: readOnly ? "#f9fafb" : "#fff", MozAppearance: "textfield" as any, appearance: "textfield" as any };
  const txtInp: React.CSSProperties = { width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const, background: readOnly ? "#f9fafb" : "#fff" };

  const cols = "80px 1fr 26px 130px 90px 80px 80px 90px 30px";

  return (
    <div>
      {lines.length > 0 && (
        <>
          {!isMobile && (
            <div style={{ display: "grid", gridTemplateColumns: cols, gap: 4, padding: "4px 4px", background: "#f9fafb", border: "1px solid #e5e7eb", borderBottom: "none" }}>
              {["Product","Description","","Period","Qty","Unit Price","Disc %","Total",""].map((h, i) => (
                <span key={i} style={{ fontSize: 10, fontWeight: 700, color: CLR.muted, textTransform: "uppercase", letterSpacing: "0.04em", padding: "2px 4px" }}>{h}</span>
              ))}
            </div>
          )}
          <div style={{ border: "1px solid #e5e7eb" }}>
            {lines.map((line, i) => {
              const searchPool = line.isNonInventory ? [] : eligibleProducts;
              const lookupPool = [...eligibleProducts, ...allProducts];
              const prod = lookupPool.find(p => p.id === line.productId);

              if (isMobile) {
                return (
                  <React.Fragment key={i}>
                    <div style={{ borderBottom: "2px solid #a9a9a9", background: line.showDetails ? "#fffef9" : "#fff", marginBottom: 25, paddingBottom: 25 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div style={{ flex: 1, marginRight: 8 }}>
                          {line.isNonInventory
                            ? <input value={line.productKey} onChange={e => patchLine(i, { productKey: e.target.value })} placeholder="Product ID…" style={{ width: "100%", padding: "9px 12px", fontSize: 13, fontFamily: "monospace", border: "1px solid #d1d5db", background: "#fff", outline: "none", boxSizing: "border-box" as const }} />
                            : readOnly
                              ? <span style={{ fontSize: 11, fontFamily: "monospace", color: CLR.primary, fontWeight: 700 }}>{line.productKey || "—"}</span>
                              : <ProductIDCell value={line.productKey} products={searchPool} onSelect={p => onProductSelect(i, p)} onChange={v => patchLine(i, { productKey: v })} inputStyle={{ padding: "9px 12px", fontSize: 13 }} />
                          }
                        </div>
                        {!readOnly && <button onClick={() => removeLine(i)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#dc2626", lineHeight: 1, padding: "0 4px" }}>✕</button>}
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        {line.isNonInventory
                          ? <input value={line.description} onChange={e => patchLine(i, { description: e.target.value })} placeholder="Description…" style={{ width: "100%", padding: "9px 12px", fontSize: 13, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }} />
                          : readOnly
                            ? <span style={{ fontSize: 13 }}>{line.description || "—"}</span>
                            : <DescriptionCell value={line.description} products={searchPool} onSelect={p => onProductSelect(i, p)} onChange={v => patchLine(i, { description: v })} inputStyle={{ padding: "9px 12px", fontSize: 13 }} />
                        }
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 6 }}>
                        <div><span style={{ fontSize: 10, color: CLR.muted, display: "block", marginBottom: 2 }}>QTY</span><input type="number" value={line.quantity} onChange={e => patchLine(i, { quantity: Number(e.target.value) })} disabled={readOnly} style={{ ...numInp, padding: "9px 12px", fontSize: 13 }} /></div>
                        <div><span style={{ fontSize: 10, color: CLR.muted, display: "block", marginBottom: 2 }}>UNIT PRICE</span><input type="number" value={line.unitPrice / 100} onChange={e => patchLine(i, { unitPrice: Math.round(Number(e.target.value) * 100) })} disabled={readOnly} style={{ ...numInp, padding: "9px 12px", fontSize: 13 }} /></div>
                        <div><span style={{ fontSize: 10, color: CLR.muted, display: "block", marginBottom: 2 }}>DISC %</span><input type="number" value={line.discount} onChange={e => patchLine(i, { discount: Number(e.target.value) })} disabled={readOnly} style={{ ...numInp, padding: "9px 12px", fontSize: 13 }} /></div>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <BillingPeriodSelect value={line.billingPeriod} prod={prod} currency={currency} readOnly={readOnly} onChange={p => onPeriodChange(i, p)} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: CLR.primary }}>{fmtAmount(line.lineTotal, currency)}</span>
                      </div>
                      {line.showDetails && (
                        <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                          <div><span style={{ fontSize: 10, color: CLR.muted }}>AR NAME</span><input value={line.descriptionAr} onChange={e => patchLine(i, { descriptionAr: e.target.value })} disabled={readOnly} dir="rtl" placeholder="الاسم بالعربية" style={{ ...txtInp, padding: "9px 12px", fontSize: 13 }} /></div>
                          <div><span style={{ fontSize: 10, color: CLR.muted }}>DETAILS EN</span><textarea value={line.productDetails} onChange={e => patchLine(i, { productDetails: e.target.value })} disabled={readOnly} rows={2} style={{ ...txtInp, resize: "vertical", padding: "9px 12px", fontSize: 13 }} /></div>
                          <div style={{ gridColumn: "1/-1" }}><span style={{ fontSize: 10, color: CLR.muted }}>DETAILS AR</span><textarea value={line.detailsAr} onChange={e => patchLine(i, { detailsAr: e.target.value })} disabled={readOnly} rows={2} dir="rtl" style={{ ...txtInp, resize: "vertical", padding: "9px 12px", fontSize: 13 }} /></div>
                        </div>
                      )}
                      {!readOnly && <button onClick={() => patchLine(i, { showDetails: !line.showDetails })} style={{ marginTop: 6, fontSize: 11, color: CLR.muted, background: "none", border: "none", cursor: "pointer", padding: 0 }}>{line.showDetails ? "▲ Hide details" : "▼ Show AR + details"}</button>}
                    </div>
                  </React.Fragment>
                );
              }

              // Desktop
              return (
                <React.Fragment key={i}>
                  <div style={{ display: "grid", gridTemplateColumns: cols, gap: 4, padding: "4px", borderBottom: line.showDetails ? "none" : "1px solid #f3f4f6", alignItems: "center", background: line.showDetails ? "#fffef9" : undefined }}>
                    <div style={{ padding: "5px 5px", position: "relative" }}>
                      {readOnly ? <span style={{ fontSize: 11, fontFamily: "monospace", color: CLR.primary, fontWeight: 700 }}>{line.productKey || "—"}</span>
                        : line.isNonInventory ? <input value={line.productKey} onChange={e => patchLine(i, { productKey: e.target.value })} placeholder="—" style={{ width: "100%", padding: "6px 7px", fontSize: 11, fontFamily: "monospace", border: "1px solid #d1d5db", background: "#fff", outline: "none", boxSizing: "border-box" as const }} />
                        : <ProductIDCell value={line.productKey} products={searchPool} onSelect={p => onProductSelect(i, p)} onChange={v => patchLine(i, { productKey: v })} />}
                    </div>
                    <div style={{ padding: "5px 4px", position: "relative" }}>
                      {readOnly ? <span style={{ fontSize: 12 }}>{line.description || "—"}</span>
                        : line.isNonInventory ? <input value={line.description} onChange={e => patchLine(i, { description: e.target.value })} placeholder="Custom item description…" style={{ width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #d1d5db", fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const }} />
                        : <DescriptionCell value={line.description} products={searchPool} onSelect={p => onProductSelect(i, p)} onChange={v => patchLine(i, { description: v })} />}
                    </div>
                    <div style={{ padding: "5px 2px", textAlign: "center" as const }}>
                      <button onClick={() => patchLine(i, { showDetails: !line.showDetails })} title="Toggle Arabic name and product details" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: line.showDetails ? CLR.primary : CLR.faint, padding: 0, lineHeight: 1 }}>
                        {line.showDetails ? "▲" : "▼"}
                      </button>
                    </div>
                    <div style={{ padding: "5px 4px" }}><BillingPeriodSelect value={line.billingPeriod} prod={prod} currency={currency} readOnly={readOnly} onChange={p => onPeriodChange(i, p)} /></div>
                    <div style={{ padding: "5px 4px" }}><input type="number" value={line.quantity} onChange={e => patchLine(i, { quantity: Number(e.target.value) })} disabled={readOnly} min={1} style={numInp} /></div>
                    <div style={{ padding: "5px 4px" }}><input type="number" value={line.unitPrice / 100} onChange={e => patchLine(i, { unitPrice: Math.round(Number(e.target.value) * 100) })} disabled={readOnly} min={0} step={0.01} style={numInp} /></div>
                    <div style={{ padding: "5px 4px" }}><input type="number" value={line.discount} onChange={e => patchLine(i, { discount: Number(e.target.value) })} disabled={readOnly} min={0} max={100} step={0.1} style={numInp} /></div>
                    <div style={{ padding: "5px 4px", textAlign: "right" as const, fontWeight: 600, fontSize: 12, color: CLR.primary }}>{fmtAmount(line.lineTotal, currency)}</div>
                    <div style={{ padding: "5px 2px", textAlign: "center" as const }}>
                      {!readOnly && <button onClick={() => removeLine(i)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#dc2626", lineHeight: 1, padding: 0 }}>✕</button>}
                    </div>
                  </div>
                  {line.showDetails && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "8px 10px 10px", background: "#fffef9", borderBottom: "1px solid #f3f4f6" }}>
                      <div><span style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, display: "block", marginBottom: 3 }}>AR NAME</span><input value={line.descriptionAr} onChange={e => patchLine(i, { descriptionAr: e.target.value })} disabled={readOnly} dir="rtl" placeholder="الاسم بالعربية" style={txtInp} /></div>
                      <div><span style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, display: "block", marginBottom: 3 }}>DETAILS EN</span><textarea value={line.productDetails} onChange={e => patchLine(i, { productDetails: e.target.value })} disabled={readOnly} rows={2} placeholder="Product details (English)…" style={{ ...txtInp, resize: "vertical" }} /></div>
                      <div><span style={{ fontSize: 10, fontWeight: 600, color: CLR.muted, display: "block", marginBottom: 3 }}>DETAILS AR</span><textarea value={line.detailsAr} onChange={e => patchLine(i, { detailsAr: e.target.value })} disabled={readOnly} rows={2} dir="rtl" placeholder="تفاصيل المنتج بالعربية…" style={{ ...txtInp, resize: "vertical" }} /></div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </>
      )}

      {/* Add buttons */}
      {!readOnly && (
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button onClick={() => addLine(false)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", background: CLR.primaryBg, color: CLR.primary, border: `1px solid ${CLR.primary}44`, cursor: "pointer", fontFamily: "inherit" }}>+ Add Product Line</button>
          <button onClick={() => addLine(true)} style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", background: "#fffbeb", color: "#b45309", border: "1px solid #fcd34d", cursor: "pointer", fontFamily: "inherit" }}>+ Add Non-Inventory Item</button>
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
        <CatalogPickerModal allProducts={allProducts} eligibleProducts={eligibleProducts} currency={currency}
          onSelect={p => { addFromCatalog(p); setShowCatalogPicker(false); }}
          onClose={() => setShowCatalogPicker(false)} />
      )}

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <div style={{ minWidth: 300 }}>
          <TRow label="Subtotal" value={fmtAmount(subtotal, currency)} />
          {vatPercent > 0 && <TRow label={`VAT (${vatPercent}%)`} value={fmtAmount(vatAmount, currency)} />}
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
  const [customer,      setCustomer]      = useState<Customer | null>(null);
  const [eligibleProducts, setEligible]   = useState<EligibleProduct[]>([]);
  const [allProducts,   setAllProducts]   = useState<EligibleProduct[]>([]);
  const [loadingProds,  setLoadingProds]  = useState(false);

  const currency   = customer?.market.defaultCurrency ?? "USD";
  const marketId   = customer?.market.id ?? "";
  const vatPercent = customer ? Number(customer.market.vatPercent ?? 0) : 0;

  const [subject,           setSubject]           = useState("");
  const [issueDate,         setIssueDate]         = useState(todayISO());
  const [dueDate,           setDueDate]           = useState("");
  const [validUntil,        setValidUntil]        = useState("");
  const [refNum,            setRefNum]            = useState("");
  const [lines,             setLines]             = useState<LineItem[]>([]);
  const [notes,             setNotes]             = useState("");
  const [intNote,           setIntNote]           = useState("");
  const [terms,             setTerms]             = useState("");
  const [files,             setFiles]             = useState<File[]>([]);
  const [visibleToCustomer, setVisibleToCustomer] = useState(false); // RFQ only — default hidden
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    if (!customer) { setEligible([]); return; }
    setLoadingProds(true);
    fetch(`/api/admin/subscriptions/eligible-products?customerId=${customer.id}&rich=1`)
      .then(r => r.json())
      .then(d => { if (d.ok) setEligible([...(d.plans ?? []), ...(d.addons ?? []), ...(d.services ?? []), ...(d.products ?? [])]); })
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
      const groups: any[]     = metaResp.data?.groups ?? [];
      const stdGroup           = groups.find((g: any) => g.key === "standard") ?? groups[0];
      const stdGroupId: string = stdGroup?.id ?? "";
      const pricingRows: any[] = pricingResp.data ?? [];
      const stdMap = new Map<string, number>();
      for (const row of pricingRows) {
        if (row.customerGroupId === stdGroupId && row.marketId === marketId) stdMap.set(`${row.productId}:${row.billingPeriod}`, row.priceCents);
      }
      setAllProducts((catalog.data ?? []).filter((p: any) => p.isActive).map((p: any) => {
        const periodsFromProduct: string[] = p.billingPeriods ?? [];
        const periodsFromPricing = pricingRows.filter((r: any) => r.productId === p.id && r.customerGroupId === stdGroupId && r.marketId === marketId).map((r: any) => r.billingPeriod);
        const periods = periodsFromProduct.length > 0 ? periodsFromProduct : periodsFromPricing;
        const prices = periods.map((period: string) => {
          const cents = stdMap.get(`${p.id}:${period}`);
          if (cents === undefined) return null;
          return { billingPeriod: period, priceCents: cents, currency, isOverride: false };
        }).filter(Boolean) as EligibleProduct["prices"];
        return { id: p.id, key: p.key, name: p.name, nameAr: p.nameAr ?? null, productDetails: p.productDetails ?? null, detailsAr: p.detailsAr ?? null, type: p.type, billingPeriods: periods, prices, unitLabel: p.unitLabel ?? null };
      }));
    });
  }, [marketId, currency]);

  useEffect(() => {
    if (!customer) return;
    fetch("/api/admin/markets")
      .then(r => r.json())
      .then(d => {
        const m = (d.data ?? []).find((m: any) => m.id === customer.market.id);
        const t = (m?.legalInfo as any)?.defaultPaymentTerms ?? "";
        if (t) setTerms(t);
      }).catch(() => {});
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
      const uploadedKeys: string[] = [];
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("docType", docType);
        const uploadRes  = await fetch("/api/admin/sales/upload", { method: "POST", body: fd });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error ?? "Upload failed");
        uploadedKeys.push(uploadData.key ?? uploadData.url);
      }
      const rfqFileUrl = uploadedKeys.length > 0 ? JSON.stringify(uploadedKeys) : null;

      const body: Record<string, unknown> = {
        customerId: customer.id, marketId,
        rfqFileUrl: rfqFileUrl,
        subject: subject || null, referenceNumber: refNum || null,
        notes: notes || null, internalNote: intNote || null,
        termsAndConditions: terms || null,
        issueDate, dueDate: dueDate || null,
        ...(docType === "QUOTATION" ? { validUntil: validUntil || null } : {}),
        ...(docType === "RFQ" ? { visibleToCustomer } : {}),
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
                  <span style={{ color: CLR.faint, marginLeft: 4, fontSize: 11 }}>{vatPercent === 0 ? "(no tax)" : `(${currency} · ${vatPercent}% VAT)`}</span>
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
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder={`e.g. Cloud services for ${customer?.fullName ?? "customer"}…`} style={inp} />
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
                <input value={refNum} onChange={e => setRefNum(e.target.value)} placeholder="Customer PO#, ref, ticket…" style={inp} />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div style={sec}>
            <p style={st}>Line Items</p>
            <LineItemsEditor lines={lines} onChange={setLines} currency={currency} vatPercent={vatPercent} eligibleProducts={eligibleProducts} allProducts={allProducts} />
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
            <textarea value={terms} onChange={e => setTerms(e.target.value)} rows={8} placeholder="Enter terms and conditions for this document…" style={{ ...inp, resize: "vertical" }} />
          </div>

          {/* Attachments */}
          <div style={sec}>
            <p style={st}>Attachments</p>
            {files.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{(f.size / 1024).toFixed(0)} KB</span>
                    <button type="button" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 16, lineHeight: 1, flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            <div onClick={() => fileRef.current?.click()}
              style={{ border: "2px dashed #d1d5db", padding: "14px", textAlign: "center", cursor: "pointer", background: "#fafafa" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = CLR.primary)}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "#d1d5db")}>
              <p style={{ fontSize: 13, color: CLR.muted }}>{files.length ? "Click to add more files" : "Click to attach files"}</p>
              <p style={{ fontSize: 11, color: CLR.faint, marginTop: 3 }}>PDF, image, Word, Excel — max 10 MB each · multiple allowed</p>
            </div>
            <input ref={fileRef} type="file" multiple style={{ display: "none" }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
              onChange={e => { setFiles(prev => [...prev, ...Array.from(e.target.files ?? [])]); e.target.value = ""; }} />
          </div>

          {/* Visibility toggle — RFQ only */}
          {docType === "RFQ" && (
            <div style={sec}>
              <p style={st}>Customer Portal Visibility</p>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
                <div onClick={() => setVisibleToCustomer(v => !v)}
                  style={{ width: 38, height: 20, borderRadius: 10, background: visibleToCustomer ? CLR.primary : "#d1d5db", position: "relative", transition: "background 0.2s", flexShrink: 0, cursor: "pointer" }}>
                  <div style={{ position: "absolute", top: 2, left: visibleToCustomer ? 20 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                </div>
                <span style={{ fontSize: 13, color: visibleToCustomer ? CLR.primary : "#6b7280", fontWeight: visibleToCustomer ? 600 : 400 }}>
                  {visibleToCustomer ? "Visible to customer" : "Hidden from customer (default)"}
                </span>
              </label>
              <p style={{ fontSize: 11, color: CLR.faint, marginTop: 6 }}>
                When hidden, this lead will not appear in the customer's portal. Customer-submitted RFQs are always visible.
              </p>
            </div>
          )}

          {error && <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13 }}>{error}</div>}

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
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "0px 16px 32px 16px", overflowY: "auto" }}
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
        {onClose && <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 20, lineHeight: 1, padding: "0 4px" }}>✕</button>}
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
// ─────────────────────────────────────────────────────────────────────────────

export interface SendEmailModalProps {
  docId: string; docNum: string; docType: string; docStatus: string;
  customerEmail: string; reminderEnabled: boolean; reminderCount: number;
  defaultCC?: string; defaultBCC?: string;
  mode: "reminder" | "custom";
  onClose: () => void;
  onSent: (result: { emailSentAt: string; emailSentCount: number; reminderCount?: number; reminderEnabled?: boolean }) => void;
}

export function SendEmailModal({ docId, docNum, docType, docStatus, customerEmail, reminderEnabled, reminderCount, defaultCC, defaultBCC, mode, onClose, onSent }: SendEmailModalProps) {
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

  const inp: React.CSSProperties = { width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #e5e7eb", outline: "none", fontFamily: "inherit", color: "#111827", background: "#fff", boxSizing: "border-box" as const };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" as const, letterSpacing: "0.04em", marginBottom: 5 };

  async function toggleReminder(enable: boolean) {
    setEnabling(true); setError("");
    try {
      const res  = await fetch(`/api/admin/sales/${docId}/reminder`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: enable }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSent({ emailSentAt: new Date().toISOString(), emailSentCount: 0, reminderEnabled: enable, reminderCount: enable ? 0 : reminderCount });
    } catch (e: any) { setError(e.message); }
    setEnabling(false);
  }

  async function sendEmail() {
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/admin/sales/${docId}/send-email`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, to, cc: cc || null, bcc: bcc || null, customSubject: customSubject || null, customBody: customBody || null, saveDefaults }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      onSent({ emailSentAt: data.emailSentAt ?? new Date().toISOString(), emailSentCount: data.emailSentCount ?? 1 });
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <Overlay onClose={onClose}>
      <ModalBox title={mode === "reminder" ? "Send Payment Reminder" : "Send Email"} onClose={onClose}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "reminder" && (
            <div style={{ padding: "10px 14px", background: canRemind ? "#fffbeb" : "#f9fafb", border: `1px solid ${canRemind ? "#fcd34d" : "#e5e7eb"}`, fontSize: 13 }}>
              {!canRemind ? (
                <p style={{ color: CLR.muted }}>Reminders are only available for unpaid invoices.</p>
              ) : maxReached ? (
                <p style={{ color: "#dc2626", fontWeight: 600 }}>Maximum 4 reminders reached.</p>
              ) : (
                <>
                  <p style={{ fontWeight: 600, color: "#b45309", marginBottom: 6 }}>Weekly Reminder — {reminderCount}/4 sent</p>
                  <p style={{ fontSize: 12, color: CLR.muted, marginBottom: 10 }}>
                    {reminderEnabled ? "Reminders are active. The system will send one per week until paid or 4 total." : "Enable weekly reminders or send one now."}
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => toggleReminder(!reminderEnabled)} disabled={enabling}
                      style={{ padding: "6px 14px", fontSize: 12, fontWeight: 600, background: reminderEnabled ? "#fef2f2" : "#f0fdf4", color: reminderEnabled ? "#dc2626" : "#15803d", border: `1px solid ${reminderEnabled ? "#fecaca" : "#86efac"}`, cursor: enabling ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                      {enabling ? "…" : reminderEnabled ? "Disable auto-reminders" : "Enable auto-reminders"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          <div>
            <label style={lbl}>To</label>
            <input value={to} onChange={e => setTo(e.target.value)} style={inp} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={lbl}>CC</label><input value={cc} onChange={e => setCc(e.target.value)} placeholder="Optional" style={inp} /></div>
            <div><label style={lbl}>BCC</label><input value={bcc} onChange={e => setBcc(e.target.value)} placeholder="Optional" style={inp} /></div>
          </div>
          {mode === "custom" && (
            <>
              <div><label style={lbl}>Subject</label><input value={customSubject} onChange={e => setCustomSubject(e.target.value)} style={inp} /></div>
              <div><label style={lbl}>Message Body (optional)</label><textarea value={customBody} onChange={e => setCustomBody(e.target.value)} rows={6} placeholder="Leave blank to use the default template…" style={{ ...inp, resize: "vertical" }} /></div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: CLR.muted, cursor: "pointer" }}>
                <input type="checkbox" checked={saveDefaults} onChange={e => setSaveDefaults(e.target.checked)} />
                Save CC/BCC as defaults for this document type
              </label>
            </>
          )}
          {error && <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 12 }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <GhostBtn onClick={onClose} disabled={loading}>Cancel</GhostBtn>
            <PrimaryBtn onClick={sendEmail} disabled={loading || !to}>
              {loading ? "Sending…" : "Send"}
            </PrimaryBtn>
          </div>
        </div>
      </ModalBox>
    </Overlay>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusChangeModal
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_TRANSITIONS_ALL: Record<string, string[]> = {
  DRAFT:          ["ISSUED", "VOID"],
  PENDING:        ["IN_REVIEW", "REPLIED", "QUOTED", "CLOSED", "VOID"],
  IN_REVIEW:      ["REPLIED", "QUOTED", "CLOSED", "VOID"],
  QUOTED:         ["REPLIED", "CONVERTED", "CLOSED", "VOID"],
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
  REPLIED:   ["IN_REVIEW", "QUOTED", "CONVERTED", "CLOSED", "VOID"],
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
  REPLIED:     { bg: "#e0f2fe", color: "#0369a1", border: "#7dd3fc" },
  DEFAULT:     { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" },
};

export interface StatusChangeModalProps {
  docId: string; docNum: string; docType: string; docStatus: string;
  onClose: () => void; onChanged: (newStatus: string) => void;
}

export function StatusChangeModal({ docId, docNum, docType, docStatus, onClose, onChanged }: StatusChangeModalProps) {
  const [selected, setSelected] = useState("");
  const [note,     setNote]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const restrictedTypes = ["INVOICE", "CREDIT_NOTE"];
  const restrictedStatuses = restrictedTypes.includes(docType)
    ? STATUS_TRANSITIONS_ALL[docStatus]?.filter(s => ["DRAFT","ISSUED","VOID"].includes(s)) ?? []
    : STATUS_TRANSITIONS_ALL[docStatus] ?? [];

  const transitions = restrictedStatuses;

  async function changeStatus() {
    if (!selected) return;
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/admin/sales/${docId}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: selected, note: note || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onChanged(selected);
      onClose();
    } catch (e: any) { setError(e.message); }
    setLoading(false);
  }

  return (
    <Overlay onClose={onClose}>
      <ModalBox title={`Change Status — ${docNum}`} onClose={onClose}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <p style={{ fontSize: 12, color: CLR.muted, marginBottom: 10 }}>Current status: <strong>{docStatus.replace(/_/g, " ")}</strong></p>
            {transitions.length === 0 ? (
              <p style={{ fontSize: 13, color: CLR.faint, padding: "12px 0" }}>No status transitions available for this document.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {transitions.map(s => {
                  const sc = STATUS_CLR[s] ?? STATUS_CLR.DEFAULT;
                  return (
                    <label key={s} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: `1px solid ${selected === s ? sc.border : "#e5e7eb"}`, background: selected === s ? sc.bg : "#fff", cursor: "pointer" }}>
                      <input type="radio" name="status" value={s} checked={selected === s} onChange={() => setSelected(s)} style={{ accentColor: CLR.primary }} />
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}>{s.replace(/_/g, " ")}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          {selected && (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: CLR.muted, marginBottom: 5, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>Note (optional)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #e5e7eb", fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" as const }}
                placeholder="Reason for status change…" />
            </div>
          )}
          {error && <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 12 }}>{error}</div>}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <GhostBtn onClick={onClose} disabled={loading}>Cancel</GhostBtn>
            {selected && <PrimaryBtn onClick={changeStatus} disabled={loading}>{loading ? `Setting ${selected.replace(/_/g, " ")}…` : `Set ${selected.replace(/_/g, " ")}`}</PrimaryBtn>}
          </div>
        </div>
      </ModalBox>
    </Overlay>
  );
}
