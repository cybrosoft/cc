// app/api/me/notifications/route.ts
// Customer-facing notification endpoints.
// GET    — list own notifications (paginated)
// PATCH  — mark as read (single or all)
// PUT    — update notification preferences

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { markAllAsRead, markAsRead, getUnreadCount } from "@/lib/notifications/channels/inapp";

// ── GET — list notifications + unread count ───────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const page     = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = 20;
    const unreadOnly = searchParams.get("unread") === "true";

    const where = {
      userId: user.id,
      ...(unreadOnly ? { isRead: false } : {}),
    };

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        select: {
          id: true, title: true, body: true, link: true,
          type: true, eventType: true,
          isRead: true, readAt: true,
          createdAt: true,
        },
      }),
      prisma.notification.count({ where }),
      getUnreadCount(user.id),
    ]);

    // Also return marketing opt-out prefs for the preferences page
    const userPrefs = await prisma.user.findUnique({
      where:  { id: user.id },
      select: { notifPrefs: true, timezone: true, dndStart: true, dndEnd: true },
    });

    const prefs       = (userPrefs?.notifPrefs as Record<string, unknown>) ?? {};
    const marketingPrefs = {
      "marketing.inapp": prefs["marketing.inapp"] !== false,  // default ON
      "marketing.email": prefs["marketing.email"] !== false,  // default ON
      "marketing.sms":   prefs["marketing.sms"]   !== false,  // default ON
    };

    return NextResponse.json({
      ok: true, notifications, total, unreadCount, page, pageSize,
      marketingPrefs,
      timezone:  userPrefs?.timezone  ?? null,
      dndStart:  userPrefs?.dndStart  ?? null,
      dndEnd:    userPrefs?.dndEnd    ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── PATCH — mark as read ──────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    if (body.all) {
      await markAllAsRead(user.id);
    } else if (body.id) {
      await markAsRead(body.id, user.id);
    } else {
      return NextResponse.json({ error: "Provide id or all:true" }, { status: 400 });
    }

    const unreadCount = await getUnreadCount(user.id);
    return NextResponse.json({ ok: true, unreadCount });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── PUT — update notification preferences ────────────────────────────────────
// Body: { prefs: { INVOICE_ISSUED: { email: true, sms: false, inapp: true }, ... } }
// Also accepts: { timezone, dndStart, dndEnd }

export async function PUT(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { prefs, timezone, dndStart, dndEnd } = body;

    // Validate DND hours
    if (dndStart !== undefined && (dndStart < 0 || dndStart > 23)) {
      return NextResponse.json({ error: "dndStart must be 0-23" }, { status: 400 });
    }
    if (dndEnd !== undefined && (dndEnd < 0 || dndEnd > 23)) {
      return NextResponse.json({ error: "dndEnd must be 0-23" }, { status: 400 });
    }

    // Load current prefs to merge
    const current = await prisma.user.findUnique({
      where:  { id: user.id },
      select: { notifPrefs: true },
    });

    const currentPrefs = (current?.notifPrefs as Record<string, unknown>) ?? {};
    const mergedPrefs  = prefs ? { ...currentPrefs, ...prefs } : currentPrefs;

    // Check which templates have lockChannels = true (customer cannot change those)
    if (prefs) {
      const lockedTemplates = await prisma.notificationTemplate.findMany({
        where:  { lockChannels: true },
        select: { eventType: true },
      });
      for (const t of lockedTemplates) {
        delete mergedPrefs[t.eventType]; // remove any attempted override
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        notifPrefs: mergedPrefs,
        ...(timezone  !== undefined ? { timezone }  : {}),
        ...(dndStart  !== undefined ? { dndStart }  : {}),
        ...(dndEnd    !== undefined ? { dndEnd }    : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}