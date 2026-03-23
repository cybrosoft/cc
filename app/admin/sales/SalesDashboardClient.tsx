// app/admin/sales/SalesDashboardClient.tsx
"use client";
import { useRouter } from "next/navigation";
import { CLR } from "@/components/ui/admin-ui";

const SECTIONS = [
  {
    href: "/admin/sales/quotations",
    icon: "📋",
    title: "Quotations",
    description: "Create and manage price quotations (draft & issued).",
    color: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8",
  },
  {
    href: "/admin/sales/po",
    icon: "🧾",
    title: "Issued PO",
    description: "Customer purchase orders received by your team.",
    color: "#f5f3ff", border: "#ddd6fe", text: "#7c3aed",
  },
  {
    href: "/admin/sales/delivery-notes",
    icon: "📦",
    title: "Delivery Notes",
    description: "Track service and goods delivery confirmations.",
    color: "#f0fdf4", border: "#bbf7d0", text: "#15803d",
  },
  {
    href: "/admin/sales/proforma",
    icon: "📄",
    title: "Proforma Invoices",
    description: "Pre-invoice documents for customer approval.",
    color: "#f9fafb", border: "#e5e7eb", text: "#374151",
  },
  {
    href: "/admin/sales/invoices",
    icon: "🧾",
    title: "Invoices",
    description: "Issued tax invoices with KSA e-invoice QR support.",
    color: "#dcfce7", border: "#86efac", text: "#15803d",
  },
  {
    href: "/admin/sales/returns",
    icon: "↩️",
    title: "Invoice Returns",
    description: "Credit notes and sales return documents.",
    color: "#fef2f2", border: "#fecaca", text: "#dc2626",
  },
  {
    href: "/admin/sales/billing",
    icon: "💳",
    title: "Billing",
    description: "View and record all payments across all documents.",
    color: "#eaf4f2", border: "#a7d9d1", text: CLR.primary,
  },
];

export default function SalesDashboardClient() {
  const router = useRouter();

  return (
    <div>
      {/* Document flow diagram */}
      <div style={{
        background: "#fff", border: "1px solid #e5e7eb",
        padding: "16px 20px", marginBottom: 24,
      }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.05em", marginBottom: 10 }}>
          DOCUMENT FLOW
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 12 }}>
          {["Lead (CRM)", "→", "Quotation", "→", "Proforma", "→", "Invoice", "→", "Payment"].map((item, i) => (
            <span key={i} style={{
              fontWeight: item === "→" ? 400 : 600,
              color: item === "→" ? CLR.faint : CLR.text,
              background: item === "→" ? "none" : "#f9fafb",
              border: item === "→" ? "none" : "1px solid #e5e7eb",
              padding: item === "→" ? 0 : "3px 10px",
            }}>{item}</span>
          ))}
          <span style={{ color: CLR.faint, fontSize: 11, marginLeft: 8 }}>or any shortcut path</span>
        </div>
      </div>

      {/* Section cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 16,
      }}>
        {SECTIONS.map((s) => (
          <button
            key={s.href}
            onClick={() => router.push(s.href)}
            style={{
              textAlign: "left", padding: "20px", cursor: "pointer",
              background: "#fff", border: "1px solid #e5e7eb",
              fontFamily: "inherit", transition: "border-color 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = CLR.primary)}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
              <span style={{
                width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center",
                background: s.color, border: `1px solid ${s.border}`, fontSize: 18,
              }}>{s.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: CLR.text }}>{s.title}</span>
            </div>
            <p style={{ fontSize: 12, color: CLR.muted, lineHeight: 1.5 }}>{s.description}</p>
          </button>
        ))}
      </div>

      {/* Number series info */}
      <div style={{
        marginTop: 24, background: "#fff", border: "1px solid #e5e7eb", padding: "16px 20px",
      }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: CLR.muted, letterSpacing: "0.05em", marginBottom: 10 }}>
          DOCUMENT NUMBERING
        </p>
        <div style={{ display: "flex", gap: 32, flexWrap: "wrap", fontSize: 12 }}>
          {[
            { market: "Saudi (SA)", example: "CY-INV-5250", start: "5250" },
            { market: "Global (GL)", example: "CYB-INV-10250", start: "10250" },
          ].map((m) => (
            <div key={m.market}>
              <span style={{ fontWeight: 600, color: CLR.text }}>{m.market}</span>
              <span style={{ color: CLR.muted }}> — starts at </span>
              <code style={{
                fontFamily: "monospace", fontSize: 12, padding: "1px 6px",
                background: CLR.primaryBg, color: CLR.primary, border: `1px solid ${CLR.primary}33`,
              }}>{m.example}</code>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 11, color: CLR.faint, marginTop: 6 }}>
          Number series can be configured in Administrator → Settings → Number Series.
        </p>
      </div>
    </div>
  );
}
