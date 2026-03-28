// app/api/customer/notifications/route.ts
// GET  — list notifications (paginated, optionally filter unread only)
// POST — mark ALL notifications as read

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { invalidateCustomerNotifs } from "@/lib/cache/customer-cache";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const limitParam = searchParams.get("limit");
  const take       = limitParam ? Math.min(parseInt(limitParam), 100) : 30;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id:        true,
        type:      true,
        title:     true,
        body:      true,
        link:      true,
        isRead:    true,
        readAt:    true,
        eventType: true,
        createdAt: true,
      },
    }),
    prisma.notification.count({
      where: { userId: user.id, isRead: false },
    }),
  ]);

  return NextResponse.json({
    notifications: notifications.map(n => ({
      id:        n.id,
      type:      String(n.type),
      title:     n.title,
      body:      n.body,
      link:      n.link      ?? null,
      isRead:    n.isRead,
      readAt:    n.readAt?.toISOString()    ?? null,
      eventType: n.eventType ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}

// Mark all notifications as read
export async function POST(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();

  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data:  { isRead: true, readAt: now },
  });

  // Bust notifs cache so badge count resets
  await invalidateCustomerNotifs(user.id);

  return NextResponse.json({ ok: true });
}
