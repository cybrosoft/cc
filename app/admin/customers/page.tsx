// app/admin/customers/page.tsx
import CustomersTable from "./ui/CustomersTable";
import { AdminHeader } from "@/components/nav/AdminHeader";

export default function AdminCustomersPage() {
  return (
    <>
      <AdminHeader title="Customers" ctaLabel="New Customer" ctaHref="/admin/customers/new" />
      <main style={{ flex: 1, overflowY: "auto", padding: "24px", background: "#f5f5f5" }}>
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: "#9ca3af", letterSpacing: ".05em", marginBottom: 3 }}>ADMIN / CUSTOMERS</p>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>Customers</h1>
        </div>
        <CustomersTable />
      </main>
    </>
  );
}
