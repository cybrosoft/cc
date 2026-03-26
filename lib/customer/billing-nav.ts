import { prisma } from "@/lib/prisma";
import type { BillingNavVisibility } from "@/components/nav/CustomerNav";

const ALL_HIDDEN: BillingNavVisibility = {
  hasIssuedPO: false,
  hasDeliveryNotes: false,
  hasProformaInvoices: false,
};

/**
 * Checks which conditional Billing nav items should be shown.
 *
 * Schema SalesDocumentType enum values used:
 *   PO | DELIVERY_NOTE | PROFORMA | CREDIT_NOTE
 *
 * Always-visible: QUOTATION, INVOICE, Statement page
 * Conditional: PO, DELIVERY_NOTE, PROFORMA, CREDIT_NOTE
 */
export async function getBillingNavVisibility(
  userId: string
): Promise<BillingNavVisibility> {
  try {
    const [poCount, dnCount, proformaCount] = await Promise.all([
      prisma.salesDocument.count({
        where: { customerId: userId, type: "PO" },
      }),
      prisma.salesDocument.count({
        where: { customerId: userId, type: "DELIVERY_NOTE" },
      }),
      prisma.salesDocument.count({
        where: { customerId: userId, type: "PROFORMA" },
      }),
    ]);

    return {
      hasIssuedPO: poCount > 0,
      hasDeliveryNotes: dnCount > 0,
      hasProformaInvoices: proformaCount > 0,
    };
  } catch {
    // SalesDocument table not yet migrated — hide all conditional items
    return ALL_HIDDEN;
  }
}
