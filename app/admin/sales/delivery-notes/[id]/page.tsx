// app/admin/sales/delivery-notes/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";

export default function DeliveryNoteDetailPage({ params }: { params: { id: string } }) {
  return <SalesDetailClient docId={params.id} docType="DELIVERY_NOTE" backHref="/admin/sales/delivery-notes" />;
}
