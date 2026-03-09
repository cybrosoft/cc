// app/admin/system/pages/page.tsx
import { AdminHeader } from "@/components/nav/AdminHeader";

export default function Page() {
  return (
    <>
      <AdminHeader title="Pages CMS" />
      <main style={{ flex: 1, overflowY: "auto", padding: "24px", background: "#f5f5f5" }}>
        <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 3 }}>ADMIN / SYSTEM / PAGES CMS</p>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 24 }}>Pages CMS</h1>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", padding: "64px 24px", textAlign: "center" }}>
          <p style={{ fontSize: 15, fontWeight: 500, color: "#374151", marginBottom: 8 }}>Pages CMS</p>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>This section is under construction — coming in the next build.</p>
        </div>
      </main>
    </>
  );
}
