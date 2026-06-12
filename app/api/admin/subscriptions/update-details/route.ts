// app/api/admin/subscriptions/update-details/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { ProductType } from "@prisma/client";

function s(v: unknown): string { return typeof v === "string" ? v : ""; }
function n(v: unknown): string | null { const t = s(v).trim(); return t.length ? t : null; }

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    subscriptionId?: unknown;
    productDetails?: unknown;
    productNote?: unknown;
    locationCode?: unknown;
    templateSlug?: unknown;
    parentSubscriptionId?: unknown;
  } | null;

  const subscriptionId          = s(body?.subscriptionId).trim();
  if (!subscriptionId)
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_ID_REQUIRED" }, { status: 400 });

  const productDetails          = n(body?.productDetails);
  const productNote             = n(body?.productNote);
  const locationCodeRaw         = s(body?.locationCode).trim().toUpperCase();
  const locationCode            = locationCodeRaw.length ? locationCodeRaw : null;
  const templateSlugRaw         = s(body?.templateSlug).trim();
  const templateSlug            = templateSlugRaw.length ? templateSlugRaw : null;
  const parentSubscriptionIdRaw = s(body?.parentSubscriptionId).trim();
  const parentSubscriptionId    = parentSubscriptionIdRaw.length ? parentSubscriptionIdRaw : null;

  const sub = await prisma.subscription.findUnique({
    where:  { id: subscriptionId },
    select: { id: true, userId: true, product: { select: { type: true } } },
  });
  if (!sub)
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_NOT_FOUND" }, { status: 404 });

  // Validate locationCode if provided
  if (locationCode) {
    const loc = await prisma.location.findFirst({ where: { code: locationCode } });
    if (!loc)
      return NextResponse.json({ ok: false, error: `Location code "${locationCode}" not found.` }, { status: 400 });
  }

  // Addon parent validation
  if (sub.product.type === ProductType.addon && !parentSubscriptionId)
    return NextResponse.json({ ok: false, error: "PARENT_SUBSCRIPTION_REQUIRED" }, { status: 400 });

  if (parentSubscriptionId && sub.product.type !== ProductType.addon)
    return NextResponse.json({ ok: false, error: "ONLY_ADDON_CAN_SET_PARENT_SUBSCRIPTION" }, { status: 400 });

  if (parentSubscriptionId) {
    const parent = await prisma.subscription.findUnique({
      where:  { id: parentSubscriptionId },
      select: { id: true, userId: true, product: { select: { type: true } } },
    });
    if (!parent)
      return NextResponse.json({ ok: false, error: "PARENT_SUBSCRIPTION_NOT_FOUND" }, { status: 404 });
    if (parent.userId !== sub.userId)
      return NextResponse.json({ ok: false, error: "PARENT_SUBSCRIPTION_USER_MISMATCH" }, { status: 400 });
    if (parent.product.type !== ProductType.plan)
      return NextResponse.json({ ok: false, error: "PARENT_SUBSCRIPTION_MUST_BE_PLAN_TYPE" }, { status: 400 });
  }

  const updateData: Record<string, unknown> = {
    productDetails,
    productNote,
  };

  if (locationCode !== undefined) updateData.locationCode = locationCode;
  if (templateSlug !== undefined) updateData.templateSlug = templateSlug;
  if (sub.product.type === ProductType.addon) {
    updateData.parentSubscriptionId = parentSubscriptionId;
  }

  const updated = await prisma.subscription.update({
    where:  { id: subscriptionId },
    data:   updateData,
    select: { id: true, locationCode: true, templateSlug: true, parentSubscriptionId: true },
  });

  return NextResponse.json({ ok: true, updated });
}
