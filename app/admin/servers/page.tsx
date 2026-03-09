// app/admin/servers/page.tsx
import ServersTable from "./serversTable";
import { AdminHeader } from "@/components/nav/AdminHeader";

export default function AdminServersPage() {
  return (
    <>
      <AdminHeader title="Servers" ctaLabel="Assign Server" />
      <main style={{ flex: 1, overflowY: "auto", padding: "24px", background: "#f5f5f5" }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 3 }}>ADMIN / SERVERS</p>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Servers</h1>
        </div>
        <ServersTable />
      </main>
    </>
  );
}
