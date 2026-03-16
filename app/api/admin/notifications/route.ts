// app/api/admin/notifications/route.ts
// GET  — list notifications with filters (history view)
// Used by admin History tab.

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { searchParams } = new URL(req.url);

    const eventType  = searchParams.get("eventType")  ?? undefined;
    const channel    = searchParams.get("channel")    ?? undefined;
    const userId     = searchParams.get("userId")     ?? undefined;
    const broadcastId = searchParams.get("broadcastId") ?? undefined;
    const from       = searchParams.get("from")       ?? undefined;
    const to         = searchParams.get("to")         ?? undefined;
    const page       = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize   = 50;

    const where: Record<string, unknown> = {
      ...(eventType   ? { eventType }                              : {}),
      ...(channel     ? { channel }                               : {}),
      ...(userId      ? { userId }                                : {}),
      ...(broadcastId ? { broadcastId }                           : {}),
      ...(from || to  ? {
        createdAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to)   } : {}),
        },
      } : {}),
    };

    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        include: {
          user: { select: { id: true, fullName: true, email: true, customerNumber: true } },
        },
      }),
    ]);

    return NextResponse.json({ ok: true, notifications, total, page, pageSize });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}