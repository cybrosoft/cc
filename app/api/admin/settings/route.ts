// app/api/admin/settings/route.ts
// Generic key-value settings store using PortalSetting model.
// GET  → return all settings as { key: value } map
// POST → upsert one or many { key, value } pairs

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET() {
  try {
    await requireAdmin();
    const rows = await prisma.portalSetting.findMany({ orderBy: { key: "asc" } });
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    return NextResponse.json({ ok: true, settings });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();

    // Accept either { key, value } or { settings: { key: value, ... } }
    const pairs: { key: string; value: string }[] = [];

    if (body.settings && typeof body.settings === "object") {
      for (const [k, v] of Object.entries(body.settings)) {
        pairs.push({ key: k, value: String(v ?? "") });
      }
    } else if (body.key !== undefined) {
      pairs.push({ key: body.key, value: String(body.value ?? "") });
    }

    if (pairs.length === 0) {
      return NextResponse.json({ error: "No settings provided" }, { status: 400 });
    }

    await prisma.$transaction(
      pairs.map(({ key, value }) =>
        prisma.portalSetting.upsert({
          where:  { key },
          update: { value },
          create: { key, value },
        })
      )
    );

    return NextResponse.json({ ok: true, updated: pairs.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}
