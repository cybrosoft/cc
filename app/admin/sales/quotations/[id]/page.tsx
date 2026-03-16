// app/admin/sales/quotations/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";

export default function QuotationDetailPage({ params }: { params: { id: string } }) {
  return <SalesDetailClient docId={params.id} docType="QUOTATION" backHref="/admin/sales/quotations" />;
}
