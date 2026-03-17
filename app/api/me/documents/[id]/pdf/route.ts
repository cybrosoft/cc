// app/api/me/documents/[id]/pdf/route.ts
// GET — serves the print page for a customer's own document.
// Customer can only access their own documents — not other customers'.
// Returns a redirect to the print page (browser handles print/save as PDF).
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";
import { toCustomerStatus } from "@/lib/sales/document-helpers";

// Statuses visible to customers
const CUSTOMER_VISIBLE_TYPES = [
  "QUOTATION", "PROFORMA", "DELIVERY_NOTE", "INVOICE", "CREDIT_NOTE",
];

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    // Find doc — must belong to this customer
    const doc = await prisma.salesDocument.findUnique({
      where: { id },
      select: {
        id:         true,
        customerId: true,
        type:       true,
        status:     true,
        docNum:     true,
      },
    });

    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Security — must be the owner
    if (doc.customerId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Only show customer-visible doc types
    if (!CUSTOMER_VISIBLE_TYPES.includes(doc.type)) {
      return NextResponse.json({ error: "Document not available" }, { status: 403 });
    }

    // DRAFT and VOID are hidden from customers
    const customerStatus = toCustomerStatus(doc.status as any);
    if (!customerStatus) {
      return NextResponse.json({ error: "Document not available" }, { status: 403 });
    }

    // Redirect to print page — customer portal uses same print view
    const printUrl = `/admin/sales/${id}/print`;
    return NextResponse.redirect(new URL(printUrl, _req.url));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Also support POST to get document data directly (for future PDF library)
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;

    const doc = await prisma.salesDocument.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true, fullName: true, email: true, customerNumber: true,
            companyName: true, vatTaxId: true, commercialRegistrationNumber: true,
            addressLine1: true, city: true, country: true,
          },
        },
        market: {
          select: {
            id: true, key: true, name: true, defaultCurrency: true,
            vatPercent: true, legalInfo: true, companyProfile: true,
            showPayOnline: true,
            // stripeSecretKey excluded
          },
        },
        lines: {
          orderBy: { sortOrder: "asc" },
          include: { product: { select: { key: true, name: true } } },
        },
        payments: { orderBy: { paidAt: "desc" } },
      },
    });

    if (!doc)                    return NextResponse.json({ error: "Not found" },   { status: 404 });
    if (doc.customerId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!CUSTOMER_VISIBLE_TYPES.includes(doc.type)) return NextResponse.json({ error: "Not available" }, { status: 403 });

    const customerStatus = toCustomerStatus(doc.status as any);
    if (!customerStatus) return NextResponse.json({ error: "Not available" }, { status: 403 });

    // Return doc with customer-visible status
    return NextResponse.json({
      ok: true,
      doc: { ...doc, status: customerStatus },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
