// lib/sales/create-document.ts
// Core document creation logic — called by all document type API routes.

import { prisma } from "@/lib/prisma";
import { SalesDocumentType, SalesDocumentStatus } from "@prisma/client";
import { allocateDocNumber } from "./allocate-doc-number";
import { calcTotals, addDays } from "./document-helpers";

export interface CreateDocumentInput {
  type:       SalesDocumentType;
  marketId:   string;
  customerId: string;
  createdByAdminId: string;

  subject?:            string | null;
  referenceNumber?:    string | null;
  notes?:              string | null;
  internalNote?:       string | null;
  termsAndConditions?: string | null;
  language?:           string;

  issueDate?:  string | Date;
  dueDate?:    string | Date | null;
  validUntil?: string | Date | null;

  originDocId?: string | null;

  rfqTitle?:          string | null;
  rfqFileUrl?:        string | null;
  visibleToCustomer?: boolean; // RFQ only — defaults to false

  lines: Array<{
    productId?:      string | null;
    description:     string;
    descriptionAr?:  string | null;
    billingPeriod?:  string | null;
    productDetails?: string | null;
    detailsAr?:      string | null;
    quantity:        number;
    unitPrice:       number;
    discount:        number;
  }>;
}

export async function createDocument(input: CreateDocumentInput) {
  const market = await prisma.market.findUniqueOrThrow({
    where:  { id: input.marketId },
    select: { defaultCurrency: true, vatPercent: true, legalInfo: true },
  });

  const currency   = market.defaultCurrency;
  const vatPercent = Number(market.vatPercent ?? 0);

  const { subtotal, vatAmount, total } = calcTotals(
    input.lines.map(l => ({ unitPrice: l.unitPrice, quantity: l.quantity, discount: l.discount })),
    vatPercent,
  );

  let validUntil: Date | null = null;
  if (input.type === "QUOTATION") {
    if (input.validUntil) {
      validUntil = new Date(input.validUntil);
    } else {
      const li   = market.legalInfo as Record<string, unknown> | null;
      const days = Number(li?.quotationValidityDays ?? 30);
      validUntil = addDays(new Date(input.issueDate ?? new Date()), days);
    }
  }

  let status: SalesDocumentStatus = "DRAFT";
  if (input.type === "RFQ") status = "PENDING";

  let terms = input.termsAndConditions ?? null;
  if (!terms && input.type !== "RFQ") {
    const li = market.legalInfo as Record<string, unknown> | null;
    terms = String(li?.defaultPaymentTerms ?? "") || null;
  }

  const doc = await prisma.$transaction(async tx => {
    const docNum = await allocateDocNumber(tx, input.marketId, input.type);

    const created = await tx.salesDocument.create({
      data: {
        docNum,
        type:     input.type,
        status,
        marketId: input.marketId,
        customerId: input.customerId,
        originDocId: input.originDocId ?? null,

        currency,
        subtotal,
        vatPercent,
        vatAmount,
        total,

        subject:            input.subject            ?? null,
        referenceNumber:    input.referenceNumber    ?? null,
        notes:              input.notes              ?? null,
        internalNote:       input.internalNote       ?? null,
        termsAndConditions: terms,
        language:           input.language           ?? "en",

        issueDate:  input.issueDate  ? new Date(input.issueDate)  : new Date(),
        dueDate:    input.dueDate    ? new Date(input.dueDate)    : null,
        validUntil: validUntil,

        rfqTitle:          input.rfqTitle          ?? null,
        rfqFileUrl:        input.rfqFileUrl        ?? null,
        visibleToCustomer: input.visibleToCustomer ?? false,

        lines: {
          create: input.lines.map((l, i) => ({
            productId:      l.productId      ?? null,
            description:    l.description,
            descriptionAr:  l.descriptionAr  ?? null,
            billingPeriod:  l.billingPeriod  ?? null,
            productDetails: l.productDetails ?? null,
            detailsAr:      l.detailsAr      ?? null,
            quantity:       l.quantity,
            unitPrice:      l.unitPrice,
            discount:       l.discount,
            lineTotal:      Math.round(l.unitPrice * l.quantity * (1 - l.discount / 100)),
            sortOrder:      i,
          })),
        },
      },
      include: {
        lines:    { orderBy: { sortOrder: "asc" } },
        market:   { select: { id: true, key: true, name: true, defaultCurrency: true } },
        customer: { select: { id: true, fullName: true, email: true, customerNumber: true } },
      },
    });

    return created;
  }, { timeout: 30000 });

  await prisma.auditLog.create({
    data: {
      actorUserId:  input.createdByAdminId,
      action:       "SALES_DOCUMENT_CREATED",
      entityType:   "SalesDocument",
      entityId:     doc.id,
      metadataJson: JSON.stringify({ docNum: doc.docNum, type: input.type, total }),
    },
  });

  return doc;
}
