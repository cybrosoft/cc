// app/api/customer/notifications/[id]/read/route.ts
// POST — marks a single notification as read.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { invalidateCustomerNotifs } from "@/lib/cache/customer-cache";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  // Only update if it belongs to this user and is currently unread
  const result = await prisma.notification.updateMany({
    where: { id: params.id, userId: user.id, isRead: false },
    data:  { isRead: true, readAt: now },
  });

  if (result.count === 0) {
    // Either not found, wrong user, or already read — all fine, return ok
    return NextResponse.json({ ok: true, alreadyRead: true });
  }

  // Bust notifs cache so badge count updates
  await invalidateCustomerNotifs(user.id);

  return NextResponse.json({ ok: true });
}
