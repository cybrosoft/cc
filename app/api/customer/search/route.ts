// app/api/customer/search/route.ts
// Global header search for the customer portal.
// Searches subscriptions (product name, key, custom server name) and
// sales documents (doc number), scoped to the logged-in customer.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

// Where each document type lives in the customer portal
const DOC_HREF: Record<string, string> = {
  INVOICE:       "/dashboard/invoices",
  CREDIT_NOTE:   "/dashboard/invoices",
  QUOTATION:     "/dashboard/quotations",
  PO:            "/dashboard/po",
  DELIVERY_NOTE: "/dashboard/delivery-notes",
  PROFORMA:      "/dashboard/proforma",
};

const DOC_LABELS: Record<string, string> = {
  INVOICE: "Invoice", QUOTATION: "Quotation", PO: "Purchase Order",
  DELIVERY_NOTE: "Delivery Note", PROFORMA: "Proforma", CREDIT_NOTE: "Credit Note", RFQ: "RFQ",
};

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ ok: true, services: [], documents: [] });
  }

  const [subs, docs] = await Promise.all([
    prisma.subscription.findMany({
      where: {
        userId: user.id,
        OR: [
          { product: { name: { contains: q, mode: "insensitive" } } },
          { product: { key:  { contains: q, mode: "insensitive" } } },
          // Custom server name lives in the first line of productDetails
          { productDetails: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: {
        id:             true,
        status:         true,
        productDetails: true,
        product: {
          select: { name: true, key: true, category: { select: { key: true } } },
        },
      },
    }),
    // Safe fallback if SalesDocument isn't migrated
    prisma.salesDocument.findMany({
      where: {
        customerId: user.id,
        docNum: { contains: q, mode: "insensitive" },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, docNum: true, type: true, status: true },
    }).catch(() => [] as { id: string; docNum: string; type: unknown; status: unknown }[]),
  ]);

  const services = subs.map(s => {
    // Same custom-name derivation as /api/servers/me
    const firstLine  = s.productDetails ? s.productDetails.split("\n")[0].trim() : null;
    const serverName = !firstLine || firstLine === s.product?.name ? null : firstLine;
    const catKey     = s.product?.category?.key ?? null;

    // Server subscriptions go to the server detail page; other categories
    // go to their category page (nav hrefs mirror category keys).
    const href = catKey === "server"
      ? `/dashboard/servers/sub/${encodeURIComponent(s.id)}`
      : catKey
        ? `/dashboard/${catKey}`
        : "/dashboard";

    return {
      id:          s.id,
      name:        serverName ?? s.product?.name ?? "—",
      productName: s.product?.name ?? "—",
      productKey:  s.product?.key  ?? null,
      status:      String(s.status),
      href,
    };
  });

  const documents = docs.map(d => ({
    id:        d.id,
    docNumber: d.docNum,
    type:      String(d.type),
    typeLabel: DOC_LABELS[String(d.type)] ?? String(d.type),
    status:    String(d.status),
    href:      DOC_HREF[String(d.type)] ?? "/dashboard/invoices",
  }));

  return NextResponse.json({ ok: true, services, documents });
}
