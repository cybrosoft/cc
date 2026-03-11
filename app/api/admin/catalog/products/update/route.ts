// app/api/admin/catalog/products/update/route.ts
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }          from "@/lib/prisma";
import { getSessionUser }  from "@/lib/auth/get-session-user";
import { ProductType, AddonPricingType, AddonBehavior } from "@prisma/client";

const VALID_TYPES:         ProductType[]      = ["plan", "addon", "service", "product"];
const VALID_PRICING_TYPES: AddonPricingType[] = ["fixed", "percentage", "per_unit"];
const VALID_BEHAVIORS:     AddonBehavior[]    = ["optional", "required"];

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

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    id?:              string;
    key?:             string;
    name?:            string;
    nameAr?:          string | null;
    type?:            ProductType;
    categoryId?:      string | null;
    zohoPlanId?:      string | null;
    billingPeriods?:  string[];
    unitLabel?:       string | null;
    productDetails?:  string | null;
    detailsAr?:       string | null;
    tagIds?:          string[];
    // addon fields
    addonPricingType?:  AddonPricingType | null;
    addonBehavior?:     AddonBehavior    | null;
    applicableTagKeys?: string[];
    addonUnitLabel?:    string | null;
    addonMinUnits?:     number | null;
    addonMaxUnits?:     number | null;
    addonPercentage?:   number | null;
  } | null;

  const id   = body?.id?.trim();
  const key  = body?.key?.trim();
  const name = body?.name?.trim();

  if (!id || !key || !name)
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

  if (!body?.type || !VALID_TYPES.includes(body.type))
    return NextResponse.json({ ok: false, error: `type must be one of: ${VALID_TYPES.join(", ")}` }, { status: 400 });

  if (body.type === "addon") {
    if (body.addonPricingType && !VALID_PRICING_TYPES.includes(body.addonPricingType))
      return NextResponse.json({ ok: false, error: "Invalid addonPricingType" }, { status: 400 });
    if (body.addonBehavior && !VALID_BEHAVIORS.includes(body.addonBehavior))
      return NextResponse.json({ ok: false, error: "Invalid addonBehavior" }, { status: 400 });
  }

  // Key conflict check
  const conflict = await prisma.product.findFirst({ where: { key, NOT: { id } } });
  if (conflict)
    return NextResponse.json({ ok: false, error: "A product with this key already exists" }, { status: 409 });

  const isAddon  = body.type === "addon";
  const tagIds   = body?.tagIds ?? [];

  const updated = await prisma.product.update({
    where: { id },
    data: {
      key,
      name,
      nameAr:         body.nameAr?.trim()         || null,
      type:           body.type,
      categoryId:     body.categoryId             ?? null,
      zohoPlanId:     body.zohoPlanId?.trim()     || null,
      billingPeriods: body.billingPeriods         ?? [],
      unitLabel:      body.unitLabel?.trim()      || null,
      productDetails: body.productDetails?.trim() || null,
      detailsAr:      body.detailsAr?.trim()      || null,
      // replace tags
      tags: { set: tagIds.map(tid => ({ id: tid })) },
      // addon fields — clear if not addon
      addonPricingType: isAddon ? (body.addonPricingType ?? null) : null,
      addonBehavior:    isAddon ? (body.addonBehavior    ?? null) : null,
      applicableTags:   isAddon ? (body.applicableTagKeys ?? [])  : [],
      addonUnitLabel:   isAddon && body.addonPricingType === "per_unit"  ? (body.addonUnitLabel?.trim() || null) : null,
      addonMinUnits:    isAddon && body.addonPricingType === "per_unit"  ? (body.addonMinUnits  ?? null) : null,
      addonMaxUnits:    isAddon && body.addonPricingType === "per_unit"  ? (body.addonMaxUnits  ?? null) : null,
      addonPercentage:  isAddon && body.addonPricingType === "percentage" ? (body.addonPercentage ?? null) : null,
    },
    select: PRODUCT_SELECT,
  });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "PRODUCT_UPDATED",
      entityType:   "Product",
      entityId:     id,
      metadataJson: JSON.stringify({ key, name, type: body.type }),
    },
  });

  return NextResponse.json({ ok: true, data: updated });
}