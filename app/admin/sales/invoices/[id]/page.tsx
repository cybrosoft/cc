// app/admin/sales/invoices/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";
import { PageShell } from "@/components/ui/admin-ui";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PageShell breadcrumb="ADMIN / SALES / INVOICES" title="Invoice"><SalesDetailClient docId={id} docType="INVOICE" backHref="/admin/sales/invoices" /></PageShell>;
}
