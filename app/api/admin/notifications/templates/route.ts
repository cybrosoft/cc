// app/api/admin/notifications/templates/route.ts
// GET  — list all notification templates
// POST — update a template (eventType is immutable, only body/subject editable)

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const templates = await prisma.notificationTemplate.findMany({
      orderBy: { eventType: "asc" },
    });
    return NextResponse.json({ ok: true, templates });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const { id, emailSubject, emailBody, smsBody, defaultEmail, defaultSms, defaultInapp, lockChannels, isActive } = body;

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updated = await prisma.notificationTemplate.update({
      where: { id },
      data: {
        ...(emailSubject  !== undefined ? { emailSubject }  : {}),
        ...(emailBody     !== undefined ? { emailBody }     : {}),
        ...(smsBody       !== undefined ? { smsBody }       : {}),
        ...(defaultEmail  !== undefined ? { defaultEmail }  : {}),
        ...(defaultSms    !== undefined ? { defaultSms }    : {}),
        ...(defaultInapp  !== undefined ? { defaultInapp }  : {}),
        ...(lockChannels  !== undefined ? { lockChannels }  : {}),
        ...(isActive      !== undefined ? { isActive }      : {}),
      },
    });

    return NextResponse.json({ ok: true, template: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}