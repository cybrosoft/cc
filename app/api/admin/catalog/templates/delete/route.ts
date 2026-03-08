// app/api/admin/catalog/templates/delete/route.ts
import { NextResponse } from "next/server";
import { prisma }       from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

// ── POST /api/admin/catalog/templates/delete ─────────────────────────────────
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

    await prisma.osTemplate.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "Failed" }, { status: 500 });
  }
}