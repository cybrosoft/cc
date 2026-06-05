// lib/sales/create-subscription-invoice.ts
// Shared helper — creates a SalesDocument (INVOICE) automatically from
// subscription context. Called by:
//   • New subscription creation
//   • Manual / auto renewal
//   • Quantity upgrade (pro-rated)
//   • Mid-subscription addon batch add
//
// Gracefully skips if number series is not configured — never throws,
// never crashes the calling operation.

import { prisma } from "@/lib/prisma";
import { createDocument } from "./create-document";
import { PERIOD_LABELS } from "./invoice-helpers";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceLine = {
  productId?:    string | null;
  description:   string;
  billingPeriod?: string | null;
  quantity:      number;
  unitPrice:     number;  // cents
  discount:      number;  // 0–100
};

export type SubscriptionInvoiceInput = {
  /** Who is creating — admin user id */
  actorId:    string;
  customerId: string;
  marketId:   string;

  /** Optional subject override — defaults to auto-generated */
  subject?: string | null;

  /** Optional internal note */
  internalNote?: string | null;

  /** Optional reference — e.g. subscription id */
  referenceNumber?: string | null;

  /** Line items to include */
  lines: InvoiceLine[];
};

export type InvoiceResult =
  | { ok: true;  docId: string; docNum: string }
  | { ok: false; reason: string };

// ─── Status logic ─────────────────────────────────────────────────────────────
// KSA  → DRAFT  (stays draft until admin attaches official ZATCA invoice)
// Global → ISSUED (immediately actionable)

async function resolveInitialStatus(marketId: string): Promise<"DRAFT" | "ISSUED"> {
  const market = await prisma.market.findUnique({
    where:  { id: marketId },
    select: { key: true },
  });
  // Market key "SA" or "SAUDI" = Saudi market → DRAFT
  const key = (market?.key ?? "").toUpperCase();
  return key === "SA" || key === "SAUDI" ? "DRAFT" : "ISSUED";
}

// ─── Main helper ──────────────────────────────────────────────────────────────

export async function createSubscriptionInvoice(
  input: SubscriptionInvoiceInput,
): Promise<InvoiceResult> {
  if (input.lines.length === 0) {
    return { ok: false, reason: "No lines provided" };
  }

  try {
    const status = await resolveInitialStatus(input.marketId);

    const doc = await createDocument({
      type:            "INVOICE",
      marketId:        input.marketId,
      customerId:      input.customerId,
      createdByAdminId: input.actorId,
      subject:         input.subject         ?? null,
      internalNote:    input.internalNote    ?? null,
      referenceNumber: input.referenceNumber ?? null,
      status,
      lines: input.lines.map(l => ({
        productId:    l.productId    ?? null,
        description:  l.description,
        billingPeriod: l.billingPeriod ?? null,
        quantity:     l.quantity,
        unitPrice:    l.unitPrice,
        discount:     l.discount,
      })),
    });

    return { ok: true, docId: doc.id, docNum: doc.docNum };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    // Number series not configured — skip gracefully, don't crash
    if (msg.includes("Number series not configured") || msg.includes("prefix not set")) {
      console.warn("[createSubscriptionInvoice] Skipped — number series not configured:", msg);
      return { ok: false, reason: "number_series_not_configured" };
    }

    console.error("[createSubscriptionInvoice] Failed:", msg);
    return { ok: false, reason: msg };
  }
}

// ─── Line builders ────────────────────────────────────────────────────────────
// Helpers used by each trigger to build the correct line items.

/** Build a standard plan/addon line from pricing */
export function buildSubscriptionLine(opts: {
  productId:    string;
  productName:  string;
  billingPeriod: string;
  quantity:     number;
  unitPriceCents: number;
  discount?:    number;
}): InvoiceLine {
  const bpLabel = PERIOD_LABELS[opts.billingPeriod] ?? opts.billingPeriod;
  const qtyPart = opts.quantity > 1 ? ` ×${opts.quantity}` : "";
  return {
    productId:    opts.productId,
    description:  `${opts.productName}${qtyPart} — ${bpLabel}`,
    billingPeriod: opts.billingPeriod,
    quantity:     opts.quantity,
    unitPrice:    opts.unitPriceCents,
    discount:     opts.discount ?? 0,
  };
}

/** Build a pro-rated upgrade line */
export function buildProRatedLine(opts: {
  productId:       string;
  productName:     string;
  billingPeriod:   string;
  remainingDays:   number;
  totalDays:       number;
  proRatedCents:   number;
  addedQty:        number;
}): InvoiceLine {
  const bpLabel = PERIOD_LABELS[opts.billingPeriod] ?? opts.billingPeriod;
  return {
    productId:    opts.productId,
    description:  `${opts.productName} — Pro-rated upgrade (${opts.remainingDays}/${opts.totalDays} days remaining, ${bpLabel})`,
    billingPeriod: opts.billingPeriod,
    quantity:     opts.addedQty,
    unitPrice:    Math.round(opts.proRatedCents / Math.max(opts.addedQty, 1)),
    discount:     0,
  };
}

/** Build a renewal line */
export function buildRenewalLine(opts: {
  productId:      string;
  productName:    string;
  billingPeriod:  string;
  quantity:       number;
  unitPriceCents: number;
  overrideCents?: number | null;
  periodStart:    string;
  periodEnd:      string;
}): InvoiceLine {
  const bpLabel  = PERIOD_LABELS[opts.billingPeriod] ?? opts.billingPeriod;
  const qtyPart  = opts.quantity > 1 ? ` ×${opts.quantity}` : "";
  const price    = opts.overrideCents ?? opts.unitPriceCents;
  const override = opts.overrideCents ? " (custom price)" : "";
  return {
    productId:    opts.productId,
    description:  `${opts.productName}${qtyPart} — Renewal ${bpLabel}${override} (${opts.periodStart} → ${opts.periodEnd})`,
    billingPeriod: opts.billingPeriod,
    quantity:     opts.quantity,
    unitPrice:    price,
    discount:     0,
  };
}
