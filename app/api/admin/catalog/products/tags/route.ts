// app/api/admin/catalog/products/tags/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

// ─── POST /api/admin/catalog/products/tags ────────────────────────────────────
// Set (replace) the full tag list for a product

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    productId?: string;
    tagIds?:    string[];
  } | null;

  const productId = body?.productId?.trim();
  const tagIds    = body?.tagIds ?? [];

  if (!productId) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });
  }

  // Replace all tags (set operation)
  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      tags: {
        set: tagIds.map((id) => ({ id })),
      },
    },
    select: {
      id:   true,
      tags: { select: { id: true, key: true, name: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "PRODUCT_TAGS_UPDATED",
      entityType:   "Product",
      entityId:     productId,
      metadataJson: JSON.stringify({ tagIds }),
    },
  });

  return NextResponse.json({ ok: true, data: updated });
}