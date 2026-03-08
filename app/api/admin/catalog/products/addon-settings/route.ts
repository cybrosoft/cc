// app/api/admin/catalog/products/addon-settings/route.ts
//
// Called by PricingAdmin "Save Pricing" when product.type === "addon"
// Saves addonPricingType, addonBehavior, applicableTags, and type-specific fields.
// Pricing rows (priceCents per group/period) are handled separately by /pricing/upsert.

export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma }       from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { AddonPricingType, AddonBehavior } from "@prisma/client";

const VALID_PRICING_TYPES: AddonPricingType[] = ["fixed", "percentage", "per_unit"];
const VALID_BEHAVIORS:     AddonBehavior[]    = ["optional", "required"];

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    productId?:       string;
    addonPricingType?: AddonPricingType;
    addonBehavior?:    AddonBehavior;
    applicableTags?:   string[];
    addonUnitLabel?:   string | null;
    addonMinUnits?:    number | null;
    addonMaxUnits?:    number | null;
    addonPercentage?:  number | null;
  } | null;

  const productId = body?.productId?.trim();
  if (!productId) {
    return NextResponse.json({ ok: false, error: "productId is required" }, { status: 400 });
  }

  // Verify product exists and is an addon
  const product = await prisma.product.findUnique({
    where:  { id: productId },
    select: { id: true, type: true },
  });
  if (!product) {
    return NextResponse.json({ ok: false, error: "Product not found" }, { status: 404 });
  }
  if (product.type !== "addon") {
    return NextResponse.json({ ok: false, error: "Product is not an addon" }, { status: 400 });
  }

  // Validate
  if (body?.addonPricingType && !VALID_PRICING_TYPES.includes(body.addonPricingType)) {
    return NextResponse.json({ ok: false, error: "Invalid addonPricingType" }, { status: 400 });
  }
  if (body?.addonBehavior && !VALID_BEHAVIORS.includes(body.addonBehavior)) {
    return NextResponse.json({ ok: false, error: "Invalid addonBehavior" }, { status: 400 });
  }
  if (body?.addonPricingType === "percentage") {
    if (body.addonPercentage == null || body.addonPercentage <= 0 || body.addonPercentage > 100) {
      return NextResponse.json(
        { ok: false, error: "addonPercentage must be between 0 and 100" },
        { status: 400 }
      );
    }
  }
  if (body?.addonPricingType === "per_unit" && !body.addonUnitLabel?.trim()) {
    return NextResponse.json(
      { ok: false, error: "addonUnitLabel is required for per_unit pricing" },
      { status: 400 }
    );
  }

  const pricingType = body?.addonPricingType ?? "fixed";

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      addonPricingType: pricingType,
      addonBehavior:    body?.addonBehavior    ?? "optional",
      applicableTags:   body?.applicableTags   ?? [],
      // per_unit only — clear if not per_unit
      addonUnitLabel: pricingType === "per_unit"
        ? (body?.addonUnitLabel?.trim() || null) : null,
      addonMinUnits:  pricingType === "per_unit"
        ? (body?.addonMinUnits  ?? null) : null,
      addonMaxUnits:  pricingType === "per_unit"
        ? (body?.addonMaxUnits  ?? null) : null,
      // percentage only — clear if not percentage
      addonPercentage: pricingType === "percentage"
        ? (body?.addonPercentage ?? null) : null,
    },
    select: {
      id:               true,
      addonPricingType: true,
      addonBehavior:    true,
      applicableTags:   true,
      addonUnitLabel:   true,
      addonMinUnits:    true,
      addonMaxUnits:    true,
      addonPercentage:  true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "ADDON_SETTINGS_UPDATED",
      entityType:   "Product",
      entityId:     productId,
      metadataJson: JSON.stringify({
        addonPricingType: pricingType,
        addonBehavior:    body?.addonBehavior,
        applicableTags:   body?.applicableTags,
      }),
    },
  });

  return NextResponse.json({ ok: true, data: updated });
}