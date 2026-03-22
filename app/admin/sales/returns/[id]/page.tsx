// app/admin/sales/returns/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";
import { PageShell } from "@/components/ui/admin-ui";

export default async function CreditNoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PageShell breadcrumb="ADMIN / SALES / INVOICE RETURNS" title="Invoice Return"><SalesDetailClient docId={id} docType="CREDIT_NOTE" backHref="/admin/sales/returns" /></PageShell>;
}