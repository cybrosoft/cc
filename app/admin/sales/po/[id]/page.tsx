// app/admin/sales/po/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";

export default function PODetailPage({ params }: { params: { id: string } }) {
  return <SalesDetailClient docId={params.id} docType="PO" backHref="/admin/sales/po" />;
}
