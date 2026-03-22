// app/admin/sales/proforma/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";
import { PageShell } from "@/components/ui/admin-ui";

export default async function ProformaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PageShell breadcrumb="ADMIN / SALES / PROFORMA INVOICES" title="Proforma Invoice"><SalesDetailClient docId={id} docType="PROFORMA" backHref="/admin/sales/proforma" /></PageShell>;
}