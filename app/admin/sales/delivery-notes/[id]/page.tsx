// app/admin/sales/delivery-notes/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";
import { PageShell } from "@/components/ui/admin-ui";

export default async function DeliveryNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PageShell breadcrumb="ADMIN / SALES / DELIVERY NOTES" title="Delivery Note"><SalesDetailClient docId={id} docType="DELIVERY_NOTE" backHref="/admin/sales/delivery-notes" /></PageShell>;
}