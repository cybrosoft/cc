// app/admin/crm/leads/[id]/page.tsx
import SalesDetailClient from "@/app/admin/sales/ui/SalesDetailClient";
import { PageShell } from "@/components/ui/admin-ui";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <PageShell breadcrumb="ADMIN / CRM / LEADS" title="Lead">
      <SalesDetailClient docId={id} docType="RFQ" backHref="/admin/crm/leads" />
    </PageShell>
  );
}
