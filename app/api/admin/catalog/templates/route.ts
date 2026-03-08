// app/api/admin/catalog/templates/route.ts
import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { requireAdmin }   from "@/lib/auth/require-admin";

// ── GET /api/admin/catalog/templates ─────────────────────────────────────────
export async function GET() {
  try {
    await requireAdmin();

    const templates = await prisma.osTemplate.findMany({
      orderBy: [{ family: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    });

    return NextResponse.json({ ok: true, data: templates });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "Failed" }, { status: 500 });
  }
}

// ── POST /api/admin/catalog/templates ─────────────────────────────────────────
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { slug, name, family, description, category, iconType, iconValue, status, sortOrder, isDefault, tagKeys } = body;

    if (!slug || !name || !category) {
      return NextResponse.json({ ok: false, error: "slug, name, category are required" }, { status: 400 });
    }

    // Check slug uniqueness
    const existing = await prisma.osTemplate.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json({ ok: false, error: "Slug already exists" }, { status: 409 });
    }

    // If setting isDefault: true on a family, clear siblings first
    if (isDefault === true && family) {
      await prisma.osTemplate.updateMany({
        where: { family, isDefault: true },
        data:  { isDefault: false },
      });
    }

    const template = await prisma.osTemplate.create({
      data: {
        slug,
        name,
        family:      family      ?? null,
        description: description ?? null,
        category,
        iconType:    iconType    ?? "devicon",
        iconValue:   iconValue   ?? null,
        status:      status      ?? "active",
        sortOrder:   sortOrder   ?? 1,
        isDefault:   isDefault   ?? false,
        tagKeys:     tagKeys     ?? [],
      },
    });

    return NextResponse.json({ ok: true, data: template });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "Failed" }, { status: 500 });
  }
}