// app/api/admin/sales/shared/create-document.ts
import { prisma } from "@/lib/prisma";
import { allocateDocNumber } from "@/lib/sales/allocate-doc-number";
import type { SalesDocumentType } from "@prisma/client";

export interface LineItemInput {
  productId?:     string | null;
  description:    string;
  billingPeriod?: string | null;
  quantity:       number;
  unitPrice:      number;   // cents
  discount?:      number;   // 0–100
  sortOrder?:     number;
}

export interface CreateDocInput {
  type:                SalesDocumentType;
  customerId:          string;
  marketId:            string;
  lines:               LineItemInput[];
  subject?:            string | null;
  referenceNumber?:    string | null;
  notes?:              string | null;
  internalNote?:       string | null;
  termsAndConditions?: string | null;
  issueDate?:          string;
  dueDate?:            string | null;
  status?:             string;
  originDocId?:        string | null;
  rfqTitle?:           string | null;
  rfqFileUrl?:         string | null;
}

function calcLineTotal(unitPrice: number, quantity: number, discount = 0): number {
  return Math.round(unitPrice * quantity * (1 - discount / 100));
}

export async function createSalesDocument(input: CreateDocInput) {
  const market = await prisma.market.findUniqueOrThrow({
    where:  { id: input.marketId },
    select: { key: true, defaultCurrency: true, vatPercent: true },
  });

  const vatPct    = market.vatPercent ? Number(market.vatPercent) : 0;
  const subtotal  = input.lines.reduce((s, l) => s + calcLineTotal(l.unitPrice, l.quantity, l.discount), 0);
  const vatAmount = Math.round((subtotal * vatPct) / 100);
  const total     = subtotal + vatAmount;

  const doc = await prisma.$transaction(async (tx) => {
    const docNum = await allocateDocNumber(tx as any, input.marketId, market.key, input.type);

    const defaultStatus =
      input.status ? input.status : input.type === "INVOICE" ? "ISSUED" : "DRAFT";

    return tx.salesDocument.create({
      data: {
        docNum,
        type:               input.type,
        status:             defaultStatus as any,
        marketId:           input.marketId,
        customerId:         input.customerId,
        originDocId:        input.originDocId        ?? null,
        currency:           market.defaultCurrency,
        vatPercent:         vatPct,
        subtotal,
        vatAmount,
        total,
        subject:            input.subject            ?? null,
        referenceNumber:    input.referenceNumber    ?? null,
        notes:              input.notes              ?? null,
        internalNote:       input.internalNote       ?? null,
        termsAndConditions: input.termsAndConditions ?? null,
        issueDate:          input.issueDate ? new Date(input.issueDate) : undefined,
        dueDate:            input.dueDate   ? new Date(input.dueDate)   : null,
        rfqTitle:           input.rfqTitle  ?? null,
        rfqFileUrl:         input.rfqFileUrl ?? null,
        lines: {
          create: input.lines.map((l, i) => ({
            productId:     l.productId     ?? null,
            description:   l.description,
            billingPeriod: l.billingPeriod ?? null,
            quantity:      l.quantity,
            unitPrice:     l.unitPrice,
            discount:      l.discount ?? 0,
            lineTotal:     calcLineTotal(l.unitPrice, l.quantity, l.discount),
            sortOrder:     l.sortOrder ?? i,
          })),
        },
      },
      include: {
        lines:    true,
        customer: { select: { id: true, fullName: true, email: true, customerNumber: true } },
        market:   { select: { key: true, name: true, defaultCurrency: true } },
      },
    });
  });

  return doc;
}
