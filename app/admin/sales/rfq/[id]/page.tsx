// app/admin/sales/rfq/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";
import { PageShell } from "@/components/ui/admin-ui";

export default async function RFQDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PageShell breadcrumb="ADMIN / SALES / RFQ" title="RFQ"><SalesDetailClient docId={id} docType="RFQ" backHref="/admin/sales/rfq" /></PageShell>;
}
