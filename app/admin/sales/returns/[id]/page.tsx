// app/admin/sales/returns/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";

export default function ReturnDetailPage({ params }: { params: { id: string } }) {
  return <SalesDetailClient docId={params.id} docType="CREDIT_NOTE" backHref="/admin/sales/returns" />;
}
