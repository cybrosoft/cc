// app/admin/system/pages/page.tsx
import { AdminHeader } from "@/components/nav/AdminHeader";

export default function Page() {
  return (
    <>
      <AdminHeader />
      <main style={{ flex: 1, overflowY: "auto", padding: "24px", background: "#f5f5f5" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 3 }}>ADMIN / SYSTEM / PAGES</p>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: "#111827", margin: 0 }}>Pages CMS</h1>
          </div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "64px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: "#374151", marginBottom: 8 }}>Pages CMS</p>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>This section is under construction — coming in the next build.</p>
        </div>
      </main>
    </>
  );
}