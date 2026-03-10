// components/ui/admin-ui.tsx
// Flat design system — zero border-radius, #318774 primary, #f5f5f5 bg.
// PageShell: breadcrumb in dark header, page title + subtitle in main content.

"use client";
import React from "react";

export const CLR = {
  primary:   "#318774",
  primaryBg: "#eaf4f2",
  border:    "#d1d5db",
  pageBg:    "#f5f5f5",
  text:      "#111827",
  muted:     "#6b7280",
  faint:     "#9ca3af",
  header:    "#222222",
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
export function StatusBadge({ active, trueLabel = "Active", falseLabel = "Inactive" }: {
  active: boolean; trueLabel?: string; falseLabel?: string;
}) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontSize: 11, fontWeight: 600, padding: "2px 8px",
      background: active ? "#dcfce7" : "#f3f4f6",
      color:      active ? "#15803d" : CLR.muted,
      border:     `1px solid ${active ? "#86efac" : "#d1d5db"}`,
    }}>{active ? trueLabel : falseLabel}</span>
  );
}

// ─── Type badge ───────────────────────────────────────────────────────────────
const TYPE_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  plan:        { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  addon:       { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  service:     { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  product:     { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  active:      { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
  inactive:    { bg: "#f3f4f6", color: "#6b7280", border: "#d1d5db" },
  coming_soon: { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
  OS:          { bg: "#f9fafb", color: "#374151", border: "#d1d5db" },
  App:         { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  BUSINESS:    { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  PERSONAL:    { bg: "#f9fafb", color: "#374151", border: "#d1d5db" },
};
export function TypeBadge({ value }: { value: string | null | undefined }) {
  const s = TYPE_STYLES[value] ?? { bg: "#f9fafb", color: "#374151", border: "#d1d5db" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      fontSize: 11, fontWeight: 600, padding: "2px 8px",
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>{(value ?? "—").replace(/_/g, " ")}</span>
  );
}

// ─── Tag Pill ─────────────────────────────────────────────────────────────────
export function TagPill({ label, onRemove, color = "primary" }: {
  label: string; onRemove?: () => void; color?: "primary" | "gray";
}) {
  const isPrimary = color === "primary";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 11, fontWeight: 500, padding: "2px 7px",
      background: isPrimary ? CLR.primaryBg : "#f3f4f6",
      color:      isPrimary ? CLR.primary   : CLR.muted,
      border:     `1px solid ${isPrimary ? "#a7d9d1" : "#d1d5db"}`,
    }}>
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} style={{
          background: "none", border: "none", cursor: "pointer",
          padding: 0, fontSize: 10, color: "inherit", lineHeight: 1, opacity: 0.7,
        }}>✕</button>
      )}
    </span>
  );
}

// ─── Page Shell ───────────────────────────────────────────────────────────────
// Renders AdminHeader (cy-topbar) + scrollable main area.
// Matches dashboard pattern: breadcrumb → h1 title → children.
// action prop maps to AdminHeader ctaLabel/ctaOnClick.
export function PageShell({ breadcrumb, title, ctaLabel, ctaOnClick, children }: {
  breadcrumb: string;
  title: string;
  ctaLabel?: string;
  ctaOnClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminHeaderBar ctaLabel={ctaLabel} ctaOnClick={ctaOnClick} />
      <main style={{ flex: 1, overflowY: "auto", background: CLR.pageBg }}>
        <div style={{ padding: 24 }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-end", marginBottom: 20,
            flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <p style={{ fontSize: 11, color: CLR.faint, letterSpacing: ".05em", marginBottom: 3 }}>
                {breadcrumb}
              </p>
              <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: CLR.text }}>
                {title}
              </h1>
            </div>
          </div>
          {children}
        </div>
      </main>
    </>
  );
}

// Internal topbar used by PageShell
function AdminHeaderBar({ ctaLabel, ctaOnClick }: { ctaLabel?: string; ctaOnClick?: () => void }) {
  return (
    <header style={{
      height: 56, minHeight: 56, background: "#222222",
      borderBottom: "1px solid #2a2a2a",
      display: "flex", alignItems: "center",
      gap: 10, padding: "0 20px", flexShrink: 0,
    }}>
      {/* Search */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        background: "#2c2c2c", border: "1px solid #383838",
        padding: "0 12px", height: 34, flex: 1, maxWidth: 520,
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input style={{
          flex: 1, fontSize: 13, color: "#d1d5db", background: "none",
          border: "none", outline: "none", fontFamily: "inherit",
        }} placeholder="Search customers, invoices, subscriptions…" />
        <kbd style={{ fontSize: 10, color: "#555", background: "#1a1a1a", border: "1px solid #333", padding: "1px 5px" }}>⌘K</kbd>
      </div>

      <div style={{ flex: 1 }} />

      {/* Market pills */}
      {(["SA · SAR", "GL · USD"] as const).map((m, i) => (
        <span key={m} style={{
          fontSize: 11, fontWeight: 600, padding: "3px 10px",
          background: i === 0 ? "rgba(49,135,116,.2)" : "rgba(255,255,255,.06)",
          color:      i === 0 ? "#5dbfad" : "#6b7280",
          border:     `1px solid ${i === 0 ? "rgba(49,135,116,.4)" : "#333"}`,
        }}>{m}</span>
      ))}

      {/* Bell */}
      <button style={{ width: 32, height: 32, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
      </button>

      {/* CTA button */}
      {ctaLabel && (
        <button type="button" onClick={ctaOnClick} style={{
          background: CLR.primary, color: "#fff", border: "none",
          padding: "0 16px", height: 34, fontSize: 12.5, fontWeight: 600,
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          fontFamily: "inherit", whiteSpace: "nowrap",
        }}>
          + {ctaLabel}
        </button>
      )}
    </header>
  );
}

// ─── White card ───────────────────────────────────────────────────────────────
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: "#fff", border: `1px solid ${CLR.border}`, ...style }}>{children}</div>;
}

// ─── Card header row ──────────────────────────────────────────────────────────
export function CardHeader({ title, count, action }: { title: string; count?: number; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "13px 18px", borderBottom: `1px solid ${CLR.border}`, gap: 10 }}>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: CLR.text }}>{title}</span>
      {count !== undefined && (
        <span style={{ fontSize: 11, fontWeight: 600, padding: "1px 8px", background: "#f3f4f6", color: CLR.muted, border: `1px solid ${CLR.border}` }}>
          {count}
        </span>
      )}
      {action}
    </div>
  );
}

// ─── Flat table ───────────────────────────────────────────────────────────────
export function Table({ cols, children }: { cols: string[]; children: React.ReactNode }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
        <thead>
          <tr style={{ background: "#f9fafb" }}>
            {cols.map(c => (
              <th key={c} style={{
                padding: "9px 16px", textAlign: "left", fontSize: 11, fontWeight: 600,
                color: CLR.faint, letterSpacing: "0.04em", textTransform: "uppercase",
                borderBottom: `1px solid ${CLR.border}`, whiteSpace: "nowrap",
              }}>{c}</th>
            ))}
          </tr>
        </thead>
        {children}
      </table>
    </div>
  );
}

// ─── Table row ────────────────────────────────────────────────────────────────
export function TR({ children, onClick, highlight, style }: {
  children: React.ReactNode; onClick?: () => void;
  highlight?: boolean; style?: React.CSSProperties;
}) {
  const [hov, setHov] = React.useState(false);
  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderBottom: `1px solid ${CLR.border}`,
        background: highlight ? CLR.primaryBg : hov && onClick ? "#fafafa" : "#fff",
        cursor: onClick ? "pointer" : "default",
        ...style,
      }}
    >{children}</tr>
  );
}

// ─── Table cell ───────────────────────────────────────────────────────────────
export function TD({ children, right, muted, mono, style }: {
  children?: React.ReactNode; right?: boolean; muted?: boolean;
  mono?: boolean; style?: React.CSSProperties;
}) {
  return (
    <td style={{
      padding: "10px 16px",
      textAlign: right ? "right" : "left",
      color: muted ? CLR.muted : CLR.text,
      fontFamily: mono ? "'Courier New', monospace" : "inherit",
      fontSize: mono ? 12 : 13.5,
      verticalAlign: "middle",
      ...style,
    }}>{children}</td>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────
type BtnVariant = "primary" | "outline" | "ghost" | "danger";
export function Btn({ children, onClick, variant = "outline", size = "sm", disabled, type = "button", style }: {
  children: React.ReactNode; onClick?: () => void; variant?: BtnVariant;
  size?: "sm" | "md"; disabled?: boolean; type?: "button" | "submit";
  style?: React.CSSProperties;
}) {
  const pad = size === "sm" ? "5px 12px" : "8px 18px";
  const fs  = size === "sm" ? 12 : 13.5;
  const map: Record<BtnVariant, { bg: string; color: string; border: string }> = {
    primary: { bg: CLR.primary, color: "#fff",    border: CLR.primary },
    outline: { bg: "#fff",      color: "#374151", border: "#d1d5db" },
    ghost:   { bg: "none",      color: CLR.muted, border: "transparent" },
    danger:  { bg: "#fff",      color: "#dc2626", border: "#fca5a5" },
  };
  const c = map[variant];
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      padding: pad, fontSize: fs, fontWeight: 500, cursor: disabled ? "not-allowed" : "pointer",
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      fontFamily: "inherit", opacity: disabled ? 0.5 : 1,
      display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap",
      ...style,
    }}>{children}</button>
  );
}

// ─── Header search (dark bg) ──────────────────────────────────────────────────
export function HeaderSearch({ value, onChange, placeholder = "Search…" }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [focused, setFocused] = React.useState(false);
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%", height: 34, padding: "0 12px", fontSize: 13, fontFamily: "inherit",
        background: "#2e2e2e", border: `1px solid ${focused ? CLR.primary : "#3d3d3d"}`,
        color: "#f3f4f6", outline: "none", transition: "border-color 0.12s",
      }}
    />
  );
}

// ─── Form input ───────────────────────────────────────────────────────────────
export function Input({ value, onChange, placeholder, type = "text", style, dir, readOnly }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; style?: React.CSSProperties; dir?: string; readOnly?: boolean;
}) {
  return (
    <input
      type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} dir={dir} readOnly={readOnly}
      className="cy-input" style={style}
    />
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────
export function Select({ value, onChange, children, style }: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="cy-input" style={style}>
      {children}
    </select>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────
export function Textarea({ value, onChange, placeholder, rows = 3, dir }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number; dir?: string;
}) {
  return (
    <textarea
      value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} rows={rows} dir={dir}
      className="cy-input" style={{ resize: "vertical" }}
    />
  );
}

// ─── Form field wrapper ───────────────────────────────────────────────────────
export function Field({ label, hint, children, required }: {
  label: string; hint?: string; children: React.ReactNode; required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.04em", textTransform: "uppercase" }}>
        {label}{required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
      </label>
      {children}
      {hint && <span style={{ fontSize: 11, color: CLR.faint }}>{hint}</span>}
    </div>
  );
}

// ─── Alert ────────────────────────────────────────────────────────────────────
export function Alert({ type, children }: { type: "error" | "success" | "info"; children: React.ReactNode }) {
  const map = {
    error:   { bg: "#fee2e2", color: "#991b1b", border: "#fca5a5" },
    success: { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
    info:    { bg: "#eff6ff", color: "#1e40af", border: "#bfdbfe" },
  };
  const c = map[type];
  return (
    <div style={{ padding: "10px 14px", fontSize: 13, fontWeight: 500, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
      {children}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────
export function Empty({ message = "No records found." }: { message?: string }) {
  return (
    <div style={{ padding: "48px 20px", textAlign: "center", color: CLR.faint, fontSize: 13.5 }}>{message}</div>
  );
}

// ─── Filters bar ──────────────────────────────────────────────────────────────
export function FiltersBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="cy-filters" style={{
      display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8,
      padding: "11px 16px", background: "#fff", borderBottom: `1px solid ${CLR.border}`,
    }}>{children}</div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
export function Pagination({ page, total, onPrev, onNext }: {
  page: number; total: number; onPrev: () => void; onNext: () => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "10px 16px", borderTop: `1px solid ${CLR.border}`, background: "#fff",
    }}>
      <Btn onClick={onPrev} disabled={page <= 1}>← Prev</Btn>
      <span style={{ fontSize: 12, color: CLR.muted }}>Page {page} of {total}</span>
      <Btn onClick={onNext} disabled={page >= total}>Next →</Btn>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
export function Modal({ open, onClose, title, width = 500, children }: {
  open: boolean; onClose: () => void; title: string;
  width?: number; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", width: "100%", maxWidth: width, maxHeight: "90vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        border: `1px solid ${CLR.border}`, boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "13px 18px", borderBottom: `1px solid ${CLR.border}`, flexShrink: 0 }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: CLR.text }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: CLR.faint, lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>{children}</div>
      </div>
    </div>
  );
}

// ─── Inline panel (table row expansion) ──────────────────────────────────────
export function InlinePanel({ colSpan = 99, children }: { colSpan?: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} style={{
        background: "#f9fafb", borderBottom: `1px solid ${CLR.border}`,
        padding: "18px 24px",
      }}>
        {children}
      </td>
    </tr>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: CLR.muted, textTransform: "uppercase", letterSpacing: "0.05em", padding: "10px 0 6px" }}>
      {children}
    </div>
  );
}

// ─── Save / Cancel row ────────────────────────────────────────────────────────
export function SaveRow({ onCancel, onSave, saving, saveLabel = "Save" }: {
  onCancel: () => void; onSave: () => void; saving?: boolean; saveLabel?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8 }}>
      <Btn variant="outline" onClick={onCancel}>Cancel</Btn>
      <Btn variant="primary" disabled={saving} onClick={onSave}>{saving ? "Saving…" : saveLabel}</Btn>
    </div>
  );
}

// ─── Toggle chip ──────────────────────────────────────────────────────────────
export function ToggleChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "5px 12px", fontSize: 12, fontWeight: 500,
      background: on ? CLR.primaryBg : "#fff",
      color: on ? CLR.primary : "#6b7280",
      border: `1px solid ${on ? CLR.primary : "#d1d5db"}`,
      cursor: "pointer", fontFamily: "inherit",
    }}>{label}</button>
  );
}