// app/admin/subscriptions/page.tsx
import SubscriptionsTable from "./subscriptionsTable";
import { AdminHeader } from "@/components/nav/AdminHeader";

export default function AdminSubscriptionsPage() {
  return (
    <>
      <AdminHeader title="Subscriptions" ctaLabel="New Subscription" ctaHref="/admin/subscriptions/new" />
      <main style={{ flex: 1, overflowY: "auto", padding: "24px", background: "#f5f5f5" }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 3 }}>ADMIN / SUBSCRIPTIONS</p>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Subscriptions</h1>
        </div>
        <SubscriptionsTable />
      </main>
    </>
  );
}
