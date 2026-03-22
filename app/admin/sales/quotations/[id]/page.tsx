// app/admin/sales/quotations/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";
import { PageShell } from "@/components/ui/admin-ui";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
return <PageShell breadcrumb="ADMIN / SALES / QUOTATIONS" title="Quotation"><SalesDetailClient docId={id} docType="QUOTATION" backHref="/admin/sales/quotations" /></PageShell>;
}

