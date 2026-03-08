// app/api/admin/catalog/pricing/override/delete/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const id   = body?.id?.trim();

  if (!id) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  await prisma.customerPricingOverride.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "PRICING_OVERRIDE_DELETED",
      entityType:   "CustomerPricingOverride",
      entityId:     id,
      metadataJson: JSON.stringify({ id }),
    },
  });

  return NextResponse.json({ ok: true });
}