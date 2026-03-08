// app/api/admin/catalog/locations/route.ts
import { NextResponse } from "next/server";
import { prisma }       from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

// ── GET /api/admin/catalog/locations ─────────────────────────────────────────
export async function GET() {
  try {
    await requireAdmin();

    const locations = await prisma.location.findMany({
      orderBy: [{ family: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ ok: true, data: locations });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "Failed" }, { status: 500 });
  }
}

// ── POST /api/admin/catalog/locations ─────────────────────────────────────────
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { code, name, family, description, countryCode, flag, status, sortOrder, isDefault, includeTags, excludeTags } = body;

    if (!code || !name) {
      return NextResponse.json({ ok: false, error: "code and name are required" }, { status: 400 });
    }

    // Check code uniqueness
    const existing = await prisma.location.findUnique({ where: { code } });
    if (existing) {
      return NextResponse.json({ ok: false, error: "Location code already exists" }, { status: 409 });
    }

    // If setting isDefault on a family, clear siblings first
    if (isDefault === true && family) {
      await prisma.location.updateMany({
        where: { family, isDefault: true },
        data:  { isDefault: false },
      });
    }

    const location = await prisma.location.create({
      data: {
        code,
        name,
        family:      family      ?? null,
        description: description ?? null,
        countryCode: countryCode ?? null,
        flag:        flag        ?? null,
        status:      status      ?? "active",
        sortOrder:   sortOrder   ?? 1,
        isDefault:   isDefault   ?? false,
        includeTags: includeTags ?? [],
        excludeTags: excludeTags ?? [],
      },
    });

    return NextResponse.json({ ok: true, data: location });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "Failed" }, { status: 500 });
  }
}