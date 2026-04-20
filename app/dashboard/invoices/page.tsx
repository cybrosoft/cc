// app/dashboard/invoices/page.tsx
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { InvoicesClient } from "./InvoicesClient";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const docs = await prisma.salesDocument.findMany({
    where: {
      customerId: user.id,
      type:       { in: ["INVOICE", "CREDIT_NOTE"] },
      status:     { notIn: ["DRAFT", "WRITTEN_OFF"] },
    },
    orderBy: { issueDate: "desc" },
    select: {
      id:                 true,
      docNum:             true,
      type:               true,
      status:             true,
      currency:           true,
      total:              true,
      issueDate:          true,
      dueDate:            true,
      officialInvoiceUrl: true,
      market: { select: { key: true, name: true } },
      payments: { select: { amountCents: true } },
    },
  });

  const serialized = docs.map(d => ({
    id:                 d.id,
    docNum:             d.docNum,
    type:               String(d.type),
    status:             String(d.status),
    currency:           d.currency,
    total:              d.total,
    amountPaid:         d.payments.reduce((s, p) => s + p.amountCents, 0),
    issueDate:          d.issueDate.toISOString(),
    dueDate:            d.dueDate?.toISOString() ?? null,
    officialInvoiceUrl: d.officialInvoiceUrl ?? null,
    market:             { key: d.market.key, name: d.market.name },
  }));

  return <InvoicesClient docs={serialized} />;
}
