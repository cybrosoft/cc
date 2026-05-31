// app/api/customer/servers/[id]/name/route.ts
// Customer can update the server name (first line of productDetails)
// Logs the change to SubscriptionStatusLog
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

  const { id: serverId } = await context.params;

  // Find the server — must belong to this customer
  const server = await prisma.server.findFirst({
    where: { id: serverId, userId: user.id },
    select: {
      id:             true,
      subscriptionId: true,
      subscription: {
        select: {
          id:             true,
          productDetails: true,
          status:         true,
        },
      },
    },
  });

  if (!server || !server.subscription)
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const newName = typeof body?.name === "string" ? body.name.trim() : "";

  if (newName.length > 100)
    return NextResponse.json({ ok: false, error: "Name too long (max 100 chars)" }, { status: 400 });

  const sub            = server.subscription;
  const existingLines  = (sub.productDetails ?? "").split("\n");
  const oldName        = existingLines[0]?.trim() ?? "";
  existingLines[0]     = newName;
  const newDetails     = existingLines.join("\n");

  // Update productDetails
  await prisma.subscription.update({
    where: { id: sub.id },
    data:  { productDetails: newDetails || null },
  });

  // Log the change to SubscriptionStatusLog
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
