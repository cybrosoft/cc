"use client";
// app/admin/catalog/page.tsx
import Link from "next/link";
import { PageShell } from "@/components/ui/admin-ui";

const SECTIONS = [
  { href: "/admin/catalog/categories", icon: "🗂", title: "Categories",   desc: "Create & enable / disable product categories" },
  { href: "/admin/catalog/tags",       icon: "🏷", title: "Tags",          desc: "Provider detection, addon rules, price-hide, 2FA exclude" },
  { href: "/admin/catalog/products",   icon: "📦", title: "Products",      desc: "Plans, addons, services — full CRUD + bilingual" },
  { href: "/admin/catalog/pricing",    icon: "💰", title: "Pricing",       desc: "Per product × market × customer group × period" },
  { href: "/admin/catalog/locations",  icon: "📍", title: "Locations",     desc: "Data-centre locations with tag include / exclude rules" },
  { href: "/admin/catalog/templates",  icon: "💿", title: "OS Templates",  desc: "OS & application templates matched via product tags" },
];

export default function AdminCatalogHome() {
  return (
    <PageShell breadcrumb="ADMIN / CATALOG" title="Catalog">
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: 1, background: "#e5e7eb",
          border: "1px solid #e5e7eb",
        }}>
          {SECTIONS.map(s => (
            <Link key={s.href} href={s.href} style={{ textDecoration: "none" }}>
              <div style={{
                background: "#fff", padding: "18px 20px",
                transition: "background 0.1s",
                display: "flex", alignItems: "flex-start", gap: 12,
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={e => (e.currentTarget.style.background = "#fff")}
              >
                <span style={{ fontSize: 20, lineHeight: 1, marginTop: 1 }}>{s.icon}</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 3 }}>{s.title}</div>
                  <div style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.4 }}>{s.desc}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
    </PageShell>
  );
}