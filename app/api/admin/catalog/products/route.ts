// app/api/admin/catalog/products/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma }        from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { ProductType }   from "@prisma/client";

const VALID_TYPES: ProductType[] = ["plan", "addon", "service", "product"];

const PRODUCT_SELECT = {
  id:               true,
  key:              true,
  name:             true,
  nameAr:           true,
  type:             true,
  zohoPlanId:       true,
  billingPeriods:   true,
  isActive:         true,
  unitLabel:        true,
  productDetails:   true,
  detailsAr:        true,
  category:         { select: { id: true, name: true } },
  tags:             { select: { id: true, key: true, name: true } },
  addonPricingType: true,
  addonBehavior:    true,
  applicableTags:   true,
  addonUnitLabel:   true,
  addonMinUnits:    true,
  addonMaxUnits:    true,
  addonPercentage:  true,
} as const;

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const data = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    select:  PRODUCT_SELECT,
  });

  return NextResponse.json({ ok: true, data });
}

// ─── POST (create) ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    key?:            string;
    name?:           string;
    nameAr?:         string | null;
    type?:           ProductType;
    categoryId?:     string | null;
    zohoPlanId?:     string | null;
    unitLabel?:      string | null;
    productDetails?: string | null;
    detailsAr?:      string | null;
    tagIds?:         string[];
  } | null;

  const key  = body?.key?.trim();
  const name = body?.name?.trim();

  if (!key || !name)
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

  if (!body?.type || !VALID_TYPES.includes(body.type))
    return NextResponse.json({ ok: false, error: `type must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });

  const existing = await prisma.product.findUnique({ where: { key } });
  if (existing)
    return NextResponse.json({ ok: false, error: "A product with this key already exists" }, { status: 409 });

  const tagIds = body?.tagIds ?? [];

  const created = await prisma.product.create({
    data: {
      key,
      name,
      nameAr:         body.nameAr?.trim()         || null,
      type:           body.type,
      categoryId:     body.categoryId             ?? null,
      zohoPlanId:     body.zohoPlanId?.trim()     || null,
      unitLabel:      body.unitLabel?.trim()      || null,
      productDetails: body.productDetails?.trim() || null,
      detailsAr:      body.detailsAr?.trim()      || null,
      isActive:       true,
      tags:           tagIds.length > 0 ? { connect: tagIds.map(id => ({ id })) } : undefined,
    },
    select: PRODUCT_SELECT,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "PRODUCT_CREATED",
      entityType:   "Product",
      entityId:     created.id,
      metadataJson: JSON.stringify({ key, name, type: body.type }),
    },
  });

  return NextResponse.json({ ok: true, data: created });
}