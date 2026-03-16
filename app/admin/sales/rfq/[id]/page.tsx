// app/admin/sales/rfq/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";

export default function RFQDetailPage({ params }: { params: { id: string } }) {
  return <SalesDetailClient docId={params.id} docType="RFQ" backHref="/admin/sales/rfq" />;
}
