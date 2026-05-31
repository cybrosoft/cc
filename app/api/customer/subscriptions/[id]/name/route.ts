// app/api/customer/subscriptions/[id]/name/route.ts
// Customer can set/update subscription name (first line of productDetails)
// Works for both provisioned and non-provisioned subscriptions
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { id: subscriptionId } = await context.params;

  const sub = await prisma.subscription.findFirst({
    where:  { id: subscriptionId, userId: user.id },
    select: { id: true, productDetails: true, status: true },
  });

  if (!sub) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const body   = await req.json().catch(() => null);
  const newName = typeof body?.name === "string" ? body.name.trim() : "";

  if (newName.length > 100)
    return NextResponse.json({ ok: false, error: "Name too long (max 100 chars)" }, { status: 400 });

  const existingLines = (sub.productDetails ?? "").split("\n");
  const oldName       = existingLines[0]?.trim() ?? "";
  existingLines[0]    = newName;
  const newDetails    = existingLines.join("\n");

  await prisma.subscription.update({
    where: { id: sub.id },
    data:  { productDetails: newDetails || null },
  });

  await prisma.subscriptionStatusLog.create({
    data: {
      subscriptionId:  sub.id,
      status:          sub.status,
      comment:         `Server name ${oldName ? `changed from "${oldName}" to "${newName}"` : `set to "${newName}"`} by customer.`,
      isAutomatic:     false,
      changedByUserId: user.id,
    },
  });

  return NextResponse.json({ ok: true, serverName: newName || null });
}
