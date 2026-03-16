// app/api/admin/notifications/send/route.ts
// POST — send a manual broadcast notification.
// Resolves target users, creates broadcast record, dispatches async.

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { sendBroadcast } from "@/lib/notifications/send";

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body  = await req.json();

    const {
      title, body: msgBody, emailSubject, smsBody,
      channels,     // ["inapp"] | ["inapp","email"] | ["inapp","email","sms"]
      targetType,   // "customer" | "group" | "market" | "all"
      targetId,     // userId | groupId | marketId
      scheduledAt,
    } = body;

    if (!title || !msgBody) {
      return NextResponse.json({ error: "title and body are required" }, { status: 400 });
    }
    if (!channels?.length) {
      return NextResponse.json({ error: "at least one channel required" }, { status: 400 });
    }
    if (!targetType) {
      return NextResponse.json({ error: "targetType required" }, { status: 400 });
    }

    // Resolve target user IDs
    const userIds = await resolveTargetUsers(targetType, targetId);

    if (userIds.length === 0) {
      return NextResponse.json({ error: "No customers found for target" }, { status: 400 });
    }

    // Create broadcast record
    const broadcast = await prisma.notificationBroadcast.create({
      data: {
        title,
        body:            msgBody,
        emailSubject:    emailSubject ?? title,
        smsBody:         smsBody      ?? msgBody,
        channels:        channels,
        targetType,
        targetId:        targetId ?? null,
        scheduledAt:     scheduledAt ? new Date(scheduledAt) : null,
        totalCount:      userIds.length,
        createdByUserId: admin.id,
      },
    });

    // If scheduled for future — return immediately, cron will handle it
    if (scheduledAt && new Date(scheduledAt) > new Date()) {
      return NextResponse.json({
        ok: true,
        broadcastId: broadcast.id,
        scheduled:   true,
        totalCount:  userIds.length,
      });
    }

    // Send immediately (async — don't await full completion)
    sendBroadcast({
      broadcastId:  broadcast.id,
      title,
      body:         msgBody,
      emailSubject: emailSubject ?? title,
      smsBody:      smsBody      ?? msgBody,
      channels,
      userIds,
    }).catch(e => console.error("[broadcast] Error:", e));

    return NextResponse.json({
      ok:          true,
      broadcastId: broadcast.id,
      scheduled:   false,
      totalCount:  userIds.length,
    }, { status: 201 });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// GET — list all broadcasts (for history tab)
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const { searchParams } = new URL(req.url);
    const page     = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = 20;

    const [total, broadcasts] = await Promise.all([
      prisma.notificationBroadcast.count(),
      prisma.notificationBroadcast.findMany({
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    return NextResponse.json({ ok: true, broadcasts, total, page, pageSize });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// ── Target resolution ─────────────────────────────────────────────────────────

async function resolveTargetUsers(
  targetType: string,
  targetId?: string
): Promise<string[]> {
  const baseWhere = { role: "CUSTOMER" as const };

  switch (targetType) {
    case "customer":
      if (!targetId) return [];
      return [targetId];

    case "group": {
      if (!targetId) return [];
      const users = await prisma.user.findMany({
        where: { ...baseWhere, customerGroupId: targetId },
        select: { id: true },
      });
      return users.map(u => u.id);
    }

    case "market": {
      if (!targetId) return [];
      const users = await prisma.user.findMany({
        where: { ...baseWhere, marketId: targetId },
        select: { id: true },
      });
      return users.map(u => u.id);
    }

    case "all": {
      const users = await prisma.user.findMany({
        where:  baseWhere,
        select: { id: true },
      });
      return users.map(u => u.id);
    }

    default:
      return [];
  }
}
