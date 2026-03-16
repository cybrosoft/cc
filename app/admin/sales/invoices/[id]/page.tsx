// app/admin/sales/invoices/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";

export default function InvoiceDetailPage({ params }: { params: { id: string } }) {
  return <SalesDetailClient docId={params.id} docType="INVOICE" backHref="/admin/sales/invoices" />;
}
