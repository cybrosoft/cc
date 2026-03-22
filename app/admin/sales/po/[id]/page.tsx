// app/admin/sales/po/[id]/page.tsx
import SalesDetailClient from "../../ui/SalesDetailClient";
import { PageShell } from "@/components/ui/admin-ui";

export default async function PODetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PageShell breadcrumb="ADMIN / SALES / ISSUED PO" title="Issued PO"><SalesDetailClient docId={id} docType="PO" backHref="/admin/sales/po" /></PageShell>;
}