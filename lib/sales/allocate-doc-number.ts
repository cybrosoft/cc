// lib/sales/allocate-doc-number.ts
// Atomically allocates the next document number for a given market + type.
// Must be called inside a Prisma transaction to prevent races.
//
// Prefix is READ from the NumberSeries row — not hardcoded.
// If the row doesn't exist or prefix is blank, throws an error that
// surfaces to the sales form: "Number series not configured for [type]"

import { PrismaClient, SalesDocumentType } from "@prisma/client";

const DOC_TYPE_LABEL: Record<SalesDocumentType, string> = {
  RFQ:           "RFQ",
  QUOTATION:     "Quotation",
  PO:            "Purchase Order",
  DELIVERY_NOTE: "Delivery Note",
  PROFORMA:      "Proforma Invoice",
  INVOICE:       "Invoice",
  CREDIT_NOTE:   "Credit Note / Return",
};

/**
 * Allocates + returns the next document number string (e.g. "CY-INV-5251").
 * Call this inside a `prisma.$transaction` — pass the tx client.
 *
 * Throws a descriptive error if:
 *   - No NumberSeries row exists for this market + docType
 *   - The prefix is blank (not yet configured by admin)
 */
export async function allocateDocNumber(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  marketId:  string,
  marketKey: string, // kept for error messages only — not used for prefix logic
  docType:   SalesDocumentType
): Promise<string> {
  const label = DOC_TYPE_LABEL[docType] ?? docType;

  const series = await tx.numberSeries.findUnique({
    where: { marketId_docType: { marketId, docType } },
  });

  if (!series) {
    throw new Error(
      `Number series not configured for "${label}". Go to Administrator → Number Series and set a prefix first.`
    );
  }

  if (!series.prefix.trim()) {
    throw new Error(
      `Number series prefix not set for "${label}". Go to Administrator → Number Series and configure it before creating documents.`
    );
  }

  const allocated = series.nextNum;

  // Increment — still inside the transaction so this is atomic
  await tx.numberSeries.update({
    where: { id: series.id },
    data:  { nextNum: series.nextNum + 1 },
  });

  return `${series.prefix}-${allocated}`;
}