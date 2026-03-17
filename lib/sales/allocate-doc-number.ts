// lib/sales/allocate-doc-number.ts
// Atomically allocates the next document number for a given market + docType.
// MUST be called inside a prisma.$transaction — pass the tx client.
// Throws a descriptive error if row missing or prefix is blank.

import { PrismaClient, SalesDocumentType } from "@prisma/client";

type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

const DOC_TYPE_LABEL: Record<SalesDocumentType, string> = {
  RFQ:           "RFQ",
  QUOTATION:     "Quotation",
  PO:            "Purchase Order",
  DELIVERY_NOTE: "Delivery Note",
  PROFORMA:      "Proforma Invoice",
  INVOICE:       "Invoice",
  CREDIT_NOTE:   "Credit Note",
};

export async function allocateDocNumber(
  tx:       TxClient,
  marketId: string,
  docType:  SalesDocumentType,
): Promise<string> {
  const label = DOC_TYPE_LABEL[docType] ?? docType;

  const series = await tx.numberSeries.findUnique({
    where: { marketId_docType: { marketId, docType } },
  });

  if (!series) {
    throw new Error(
      `Number series not configured for "${label}". ` +
      `Go to Administrator → Number Series and set a prefix first.`
    );
  }

  if (!series.prefix.trim()) {
    throw new Error(
      `Number series prefix not set for "${label}". ` +
      `Go to Administrator → Number Series and configure it before creating documents.`
    );
  }

  const allocated = series.nextNum;

  await tx.numberSeries.update({
    where: { id: series.id },
    data:  { nextNum: series.nextNum + 1 },
  });

  return `${series.prefix}-${allocated}`;
}
