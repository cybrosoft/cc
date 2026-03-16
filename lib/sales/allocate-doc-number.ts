// lib/sales/allocate-doc-number.ts
// Atomically allocates the next document number for a given market + type.
// Must be called inside a Prisma transaction to prevent races.

import { PrismaClient, SalesDocumentType } from "@prisma/client";

// Type → short code used in the document number
const TYPE_CODE: Record<SalesDocumentType, string> = {
  RFQ:           "RFQ",
  QUOTATION:     "QUO",
  PO:            "PO",
  DELIVERY_NOTE: "DN",
  PROFORMA:      "PRO",
  INVOICE:       "INV",
  CREDIT_NOTE:   "CR",
};

/**
 * Allocates + returns the next document number string (e.g. "CY-INV-5251").
 * Call this inside a `prisma.$transaction` — pass the tx client.
 * Creates the NumberSeries row if it doesn't exist yet.
 */
export async function allocateDocNumber(
  tx: Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  marketId: string,
  marketKey: string,       // "SA" → prefix "CY", anything else → "CYB"
  docType: SalesDocumentType
): Promise<string> {
  const prefix = buildPrefix(marketKey, docType);
  const startNum = marketKey === "SA" ? 5250 : 10250;

  // Upsert ensures the row exists, then we immediately increment
  let series = await tx.numberSeries.findUnique({
    where: { marketId_docType: { marketId, docType } },
  });

  if (!series) {
    series = await tx.numberSeries.create({
      data: { marketId, docType, prefix, nextNum: startNum },
    });
  }

  const allocated = series.nextNum;

  await tx.numberSeries.update({
    where: { id: series.id },
    data:  { nextNum: series.nextNum + 1 },
  });

  return `${prefix}-${allocated}`;
}

function buildPrefix(marketKey: string, docType: SalesDocumentType): string {
  const base = marketKey === "SA" ? "CY" : "CYB";
  return `${base}-${TYPE_CODE[docType]}`;
}
