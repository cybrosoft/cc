// app/admin/sales/proforma/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";

export default function ProformaDetailPage({ params }: { params: { id: string } }) {
  return <SalesDetailClient docId={params.id} docType="PROFORMA" backHref="/admin/sales/proforma" />;
}
