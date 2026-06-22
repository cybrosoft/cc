// lib/sales/types.ts
// Shared TypeScript types for the Sales module (admin + API layer)

import type { SalesDocumentType, SalesDocumentStatus } from "@prisma/client";

export interface LineItemInput {
  productId?: string | null;
  description: string;
  quantity: number;
  unitPrice: number;   // cents
  discount?: number;   // 0–100 percent
  sortOrder?: number;
}

export interface CreateDocInput {
  type: SalesDocumentType;
  customerId: string;
  marketId: string;
  lines: LineItemInput[];
  notes?: string;
  internalNote?: string;
  issueDate?: string;       // ISO date string
  dueDate?: string;
  status?: SalesDocumentStatus;
  originDocId?: string;
  // RFQ extras
  rfqTitle?: string;
  rfqFileUrl?: string;
}

export interface UpdateDocInput {
  status?: SalesDocumentStatus;
  notes?: string;
  internalNote?: string;
  dueDate?: string;
  lines?: LineItemInput[];
  rfqTitle?: string;
}

export interface RecordPaymentInput {
  documentId: string;
  marketId: string;
  method: "BANK_TRANSFER" | "STRIPE" | "CASH" | "OTHER";
  amountCents: number;
  currency: string;
  reference?: string;
  notes?: string;
  receiptUrl?: string;
  paidAt?: string;
}

// ── Line total helpers ──────────────────────────────────────────────────────

export function calcLineTotal(unitPrice: number, quantity: number, discount = 0): number {
  const gross = unitPrice * quantity;
  return Math.round(gross * (1 - discount / 100));
}

export function calcDocTotals(
  lines: LineItemInput[],
  vatPercent: number
): { subtotal: number; vatAmount: number; total: number } {
  const subtotal = lines.reduce(
    (sum, l) => sum + calcLineTotal(l.unitPrice, l.quantity, l.discount),
    0
  );
  const vatAmount = Math.round((subtotal * vatPercent) / 100);
  return { subtotal, vatAmount, total: subtotal + vatAmount };
}

// ── Status colour map (used in both admin list + detail pages) ──────────────
// Covers every member of the SalesDocumentStatus enum (shared across all doc
// types — RFQ, Quotation, PO, Delivery Note, Proforma, Invoice, Credit Note).

export const STATUS_STYLE: Record<
  SalesDocumentStatus,
  { bg: string; color: string; border: string }
> = {
  // Shared
  DRAFT:          { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" },
  ISSUED:         { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  SENT:           { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe" },
  CONVERTED:      { bg: "#fffbeb", color: "#b45309", border: "#fde68a" },
  VOID:           { bg: "#f3f4f6", color: "#6b7280", border: "#d1d5db" },

  // RFQ
  PENDING:        { bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
  IN_REVIEW:      { bg: "#f0f9ff", color: "#0369a1", border: "#bae6fd" },
  QUOTED:         { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  CLOSED:         { bg: "#f3f4f6", color: "#374151", border: "#d1d5db" },
  REPLIED:        { bg: "#e0f2fe", color: "#0369a1", border: "#7dd3fc" },
  FOLLOW_UP:      { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },

  // Quotation
  REVISED:        { bg: "#fdf4ff", color: "#7e22ce", border: "#e9d5ff" },
  ACCEPTED:       { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  REJECTED:       { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  EXPIRED:        { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" },

  // PO
  PROCESSING:     { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },

  // Delivery Note
  DELIVERED:      { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  CANCELLED:      { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },

  // Invoice
  PAID:           { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
  PARTIALLY_PAID: { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
  OVERDUE:        { bg: "#fef2f2", color: "#991b1b", border: "#fca5a5" },
  WRITTEN_OFF:    { bg: "#fdf4ff", color: "#7e22ce", border: "#e9d5ff" },

  // Credit Note
  APPLIED:        { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
};

export const DOC_TYPE_LABEL: Record<SalesDocumentType, string> = {
  RFQ:           "RFQ",
  QUOTATION:     "Quotation",
  PO:            "Purchase Order",
  DELIVERY_NOTE: "Delivery Note",
  PROFORMA:      "Proforma Invoice",
  INVOICE:       "Invoice",
  CREDIT_NOTE:   "Credit Note",
};
