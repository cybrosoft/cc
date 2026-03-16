// app/admin/sales/page.tsx
import { PageShell } from "@/components/ui/admin-ui";
import SalesDashboardClient from "./SalesDashboardClient";

export default function SalesPage() {
  return (
    <PageShell breadcrumb="ADMIN / SALES" title="Sales">
      <SalesDashboardClient />
    </PageShell>
  );
}
