// lib/sales/document-helpers.ts
// Shared helpers for sales documents:
//   - Status display labels
//   - Customer-visible status mapping (hides internal statuses)
//   - Amount formatters
//   - VAT calculation

import { SalesDocumentType, SalesDocumentStatus } from "@prisma/client";

// ── Type labels ───────────────────────────────────────────────────────────────

export const DOC_TYPE_LABEL: Record<SalesDocumentType, string> = {
  RFQ:           "RFQ",
  QUOTATION:     "Quotation",
  PO:            "Purchase Order",
  DELIVERY_NOTE: "Delivery Note",
  PROFORMA:      "Proforma Invoice",
  INVOICE:       "Tax Invoice",
  CREDIT_NOTE:   "Credit Note",
};

export const DOC_TYPE_LABEL_AR: Record<SalesDocumentType, string> = {
  RFQ:           "طلب عرض سعر",
  QUOTATION:     "عرض سعر",
  PO:            "أمر شراء",
  DELIVERY_NOTE: "إشعار تسليم",
  PROFORMA:      "فاتورة مبدئية",
  INVOICE:       "فاتورة ضريبية",
  CREDIT_NOTE:   "إشعار دائن",
};

// ── Status display labels ─────────────────────────────────────────────────────

export const STATUS_LABEL: Record<SalesDocumentStatus, string> = {
  DRAFT:          "Draft",
  ISSUED:         "Issued",
  SENT:           "Sent",
  ACCEPTED:       "Accepted",
  REJECTED:       "Rejected",
  CONVERTED:      "Converted",
  VOID:           "Void",
  PENDING:        "Pending",
  IN_REVIEW:      "In Review",
  QUOTED:         "Quoted",
  CLOSED:         "Closed",
  REVISED:        "Revised",
  EXPIRED:        "Expired",
  PROCESSING:     "Processing",
  DELIVERED:      "Delivered",
  CANCELLED:      "Cancelled",
  PARTIALLY_PAID: "Partially Paid",
  PAID:           "Paid",
  OVERDUE:        "Overdue",
  WRITTEN_OFF:    "Written Off",
  APPLIED:        "Applied",
  FOLLOW_UP:      "Follow Up",
};

// ── Customer-visible status ───────────────────────────────────────────────────

export function toCustomerStatus(
  status: SalesDocumentStatus,
): SalesDocumentStatus | null {
  const map: Partial<Record<SalesDocumentStatus, SalesDocumentStatus | null>> = {
    WRITTEN_OFF: "OVERDUE",
    IN_REVIEW:   "PENDING",
    REVISED:     "SENT",
    DRAFT:       null,
    VOID:        null,
    FOLLOW_UP:   "PENDING",
  };

  if (status in map) return map[status] ?? null;
  return status;
}

// ── Valid statuses per document type ─────────────────────────────────────────

export const VALID_STATUSES: Record<SalesDocumentType, SalesDocumentStatus[]> = {
  // RFQ acts as CRM lead — has extended status set
  RFQ:           ["DRAFT","PENDING","IN_REVIEW","PROCESSING","QUOTED","FOLLOW_UP","ACCEPTED","REJECTED","CONVERTED","EXPIRED","CANCELLED","CLOSED","VOID"],
  QUOTATION:     ["DRAFT","ISSUED","SENT","REVISED","ACCEPTED","REJECTED","CONVERTED","EXPIRED","VOID"],
  PO:            ["DRAFT","ISSUED","CONVERTED","CLOSED","VOID"],
  DELIVERY_NOTE: ["DRAFT","ISSUED","SENT","DELIVERED","CANCELLED","CONVERTED","VOID"],
  PROFORMA:      ["DRAFT","ISSUED","SENT","ACCEPTED","CONVERTED","VOID"],
  INVOICE:       ["DRAFT","ISSUED","SENT","PARTIALLY_PAID","PAID","OVERDUE","WRITTEN_OFF","VOID"],
  CREDIT_NOTE:   ["DRAFT","ISSUED","SENT","APPLIED","VOID"],
};

// ── Amount helpers ────────────────────────────────────────────────────────────

export function fmtAmount(cents: number, currency: string): string {
  const amount = (cents / 100).toFixed(2);
  if (currency === "SAR") return `SAR ${Number(amount).toLocaleString("en-SA", { minimumFractionDigits: 2 })}`;
  return `$${Number(amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export function calcVat(subtotalCents: number, vatPercent: number): number {
  return Math.round((subtotalCents * vatPercent) / 100);
}

export function calcTotals(lines: { unitPrice: number; quantity: number; discount: number }[], vatPercent: number) {
  const subtotal  = lines.reduce((sum, l) => {
    const lineTotal = Math.round(l.unitPrice * l.quantity * (1 - l.discount / 100));
    return sum + lineTotal;
  }, 0);
  const vatAmount = calcVat(subtotal, vatPercent);
  const total     = subtotal + vatAmount;
  return { subtotal, vatAmount, total };
}

// ── Date helpers ──────────────────────────────────────────────────────────────

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
