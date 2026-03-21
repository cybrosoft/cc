// app/admin/sales/quotations/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SalesDetailClient docId={id} docType="QUOTATION" backHref="/admin/sales/quotations" />;
}
