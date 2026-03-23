// app/admin/sales/rfq/[id]/page.tsx
import { redirect } from "next/navigation";
export default async function RFQDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/crm/leads/${id}`);
}
