// app/dashboard/sales/[id]/page.tsx
import { redirect, notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { SalesDocClient } from "./SalesDocClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.salesDocument.findUnique({
    where: { id }, select: { docNum: true },
  });
  return { title: doc?.docNum ?? "Document" };
}

export default async function SalesDocPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const doc = await prisma.salesDocument.findFirst({
    where: {
      id,
      customerId: user.id,
      status: { notIn: ["DRAFT", "WRITTEN_OFF"] },
    },
    include: {
      lines: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true, description: true, descriptionAr: true,
          billingPeriod: true, quantity: true, unitPrice: true,
          discount: true, lineTotal: true, sortOrder: true,
          product: { select: { id: true, name: true, key: true } },
        },
      },
      payments: {
        orderBy: { paidAt: "desc" },
        select: {
          id: true, method: true, amountCents: true,
          currency: true, reference: true, paidAt: true,
        },
      },
      // Fetch payment notification logs for this invoice
      logs: {
        where:   { field: "payment_notification" },
        orderBy: { createdAt: "desc" },
        select: {
          id:        true,
          note:      true,
          newValue:  true,
          createdAt: true,
        },
      },
      originDoc:   { select: { id: true, docNum: true, type: true, status: true } },
      derivedDocs: {
        where:  { status: { notIn: ["DRAFT", "VOID", "WRITTEN_OFF"] } },
        select: { id: true, docNum: true, type: true, status: true },
      },
      market: {
        select: {
          name: true, key: true, defaultCurrency: true,
          legalInfo: true, vatPercent: true,
          paymentMethods: true,
          showPayOnline:  true,
          stripePublicKey: true,
        },
      },
      customer: {
        select: {
          fullName: true, companyName: true, accountType: true, email: true,
          addressLine1: true, addressLine2: true, district: true,
          city: true, province: true, country: true,
          vatTaxId: true, commercialRegistrationNumber: true,
        },
      },
    },
  });

  if (!doc) notFound();

  const amountPaid = doc.payments.reduce((s, p) => s + p.amountCents, 0);
  const li = (doc.market.legalInfo ?? {}) as Record<string, any>;

  // Parse payment notification logs into structured objects
  const paymentNotifications = doc.logs.map(log => {
    const lines     = (log.note ?? "").split("\n");
    const get       = (prefix: string) => lines.find(l => l.startsWith(prefix))?.slice(prefix.length).trim() ?? null;
    const receiptKey = log.newValue && log.newValue !== "no-receipt" ? log.newValue : null;
    return {
      id:         log.id,
      amount:     get("Amount: "),
      date:       get("Date: "),
      reference:  get("Reference: "),
      notes:      get("Notes: "),
      receiptKey,
      submittedAt: log.createdAt.toISOString(),
    };
  });

  const serialized = {
    id:                 doc.id,
    docNum:             doc.docNum,
    type:               String(doc.type),
    status:             String(doc.status),
    currency:           doc.currency,
    subtotal:           doc.subtotal,
    vatPercent:         Number(doc.vatPercent),
    vatAmount:          doc.vatAmount,
    total:              doc.total,
    amountPaid,
    balance:            doc.total - amountPaid,
    subject:            doc.subject            ?? null,
    notes:              doc.notes              ?? null,
    termsAndConditions: doc.termsAndConditions ?? null,
    referenceNumber:    doc.referenceNumber    ?? null,
    rfqTitle:           doc.rfqTitle           ?? null,
    pdfKey:             doc.pdfKey             ?? null,
    officialInvoiceUrl: doc.officialInvoiceUrl ?? null,
    language:           doc.language,
    issueDate:          doc.issueDate.toISOString(),
    dueDate:            doc.dueDate?.toISOString()    ?? null,
    validUntil:         doc.validUntil?.toISOString() ?? null,
    paidAt:             doc.paidAt?.toISOString()     ?? null,
    createdAt:          doc.createdAt.toISOString(),
    paymentNotifications,
    market: {
      name:            doc.market.name,
      key:             doc.market.key,
      currency:        doc.market.defaultCurrency,
      vatPercent:      Number(doc.market.vatPercent ?? 0),
      legalInfo:       doc.market.legalInfo as Record<string, any> | null,
      paymentMethods:  doc.market.paymentMethods ?? [],
      showPayOnline:   doc.market.showPayOnline  ?? false,
      stripePublicKey: doc.market.stripePublicKey ?? null,
      bankDetails:     li.bankDetails ?? null,
    },
    customer: {
      fullName:    doc.customer.fullName    ?? null,
      companyName: doc.customer.companyName ?? null,
      accountType: String(doc.customer.accountType ?? "BUSINESS"),
      email:       doc.customer.email,
      addressLine1:doc.customer.addressLine1 ?? null,
      addressLine2:doc.customer.addressLine2 ?? null,
      district:    doc.customer.district     ?? null,
      city:        doc.customer.city         ?? null,
      province:    doc.customer.province     ?? null,
      country:     doc.customer.country      ?? null,
      vatTaxId:    doc.customer.vatTaxId     ?? null,
      crn:         doc.customer.commercialRegistrationNumber ?? null,
    },
    lines: doc.lines.map(l => ({
      id:            l.id,
      description:   l.description,
      descriptionAr: l.descriptionAr ?? null,
      billingPeriod: l.billingPeriod ?? null,
      quantity:      Number(l.quantity),
      unitPrice:     l.unitPrice,
      discount:      Number(l.discount),
      lineTotal:     l.lineTotal,
      product:       l.product ? { id: l.product.id, name: l.product.name, key: l.product.key } : null,
    })),
    payments: doc.payments.map(p => ({
      id:          p.id,
      method:      String(p.method),
      amountCents: p.amountCents,
      currency:    p.currency,
      reference:   p.reference ?? null,
      paidAt:      p.paidAt.toISOString(),
    })),
    originDoc: doc.originDoc ? {
      id: doc.originDoc.id, docNum: doc.originDoc.docNum,
      type: String(doc.originDoc.type), status: String(doc.originDoc.status),
    } : null,
    derivedDocs: doc.derivedDocs.map(d => ({
      id: d.id, docNum: d.docNum, type: String(d.type), status: String(d.status),
    })),
  };

  return <SalesDocClient doc={serialized} />;
}
