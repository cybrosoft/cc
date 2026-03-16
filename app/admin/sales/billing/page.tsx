// app/admin/sales/billing/page.tsx
import { PageShell } from "@/components/ui/admin-ui";
import BillingClient from "./BillingClient";

export default function BillingPage() {
  return (
    <PageShell breadcrumb="ADMIN / SALES / BILLING" title="Billing">
      <BillingClient />
    </PageShell>
  );
}
