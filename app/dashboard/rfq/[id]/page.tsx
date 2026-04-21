// app/dashboard/rfq/[id]/page.tsx
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { parseAttachments } from "@/lib/sales/attachments";
import { RFQDetailClient } from "./RFQDetailClient";

export const metadata = { title: "Inquiry Details" };

export default async function RFQDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const doc = await prisma.salesDocument.findFirst({
    where: { id, customerId: user.id, type: "RFQ" },
    select: {
      id:         true,
      docNum:     true,
      status:     true,
      rfqTitle:   true,
      notes:      true,
      rfqFileUrl: true,
      issueDate:  true,
    },
  });

  if (!doc) notFound();

  return (
    <RFQDetailClient
      doc={{
        id:          doc.id,
        docNum:      doc.docNum,
        status:      String(doc.status),
        title:       doc.rfqTitle  ?? null,
        notes:       doc.notes     ?? null,
        attachments: parseAttachments(doc.rfqFileUrl),
        issueDate:   doc.issueDate.toISOString(),
      }}
    />
  );
}
