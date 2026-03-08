// app/api/admin/catalog/pricing/toggle/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    id?:       string;
    isActive?: boolean;
  } | null;

  const id       = body?.id?.trim();
  const isActive = body?.isActive;

  if (!id || typeof isActive !== "boolean") {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const updated = await prisma.pricing.update({
    where: { id },
    data:  { isActive },
    select: { id: true, isActive: true, productId: true, billingPeriod: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "PRICING_TOGGLED",
      entityType:   "Pricing",
      entityId:     updated.id,
      metadataJson: JSON.stringify({ isActive }),
    },
  });

  return NextResponse.json({ ok: true, data: updated });
}