// lib/notifications/channels/inapp.ts
// In-app notification channel — writes to Notification table.
// Customer sees these in the bell icon dropdown in their portal.

import { prisma } from "@/lib/prisma";

interface InAppParams {
  userId:      string;
  title:       string;
  body:        string;
  eventType:   string;
  link?:       string;
  broadcastId?: string;
}

export async function sendInApp(params: InAppParams): Promise<void> {
  const { userId, title, body, eventType, link, broadcastId } = params;

  await prisma.notification.create({
    data: {
      userId,
      title,
      body,
      link:        link       ?? null,
      eventType,
      channel:     "inapp",
      broadcastId: broadcastId ?? null,
      sentAt:      new Date(),
      // In-app is always "sent" immediately — it's just a DB record
    },
  });
}

// ── Mark as read ──────────────────────────────────────────────────────────────

export async function markAsRead(notificationId: string, userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data:  { isRead: true, readAt: new Date() },
  });
}

export async function markAllAsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data:  { isRead: true, readAt: new Date() },
  });
}

// ── Unread count ──────────────────────────────────────────────────────────────

export async function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { userId, isRead: false },
  });
}
