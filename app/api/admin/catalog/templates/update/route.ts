// app/api/admin/catalog/templates/update/route.ts
import { NextResponse } from "next/server";
import { prisma }       from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

// ── POST /api/admin/catalog/templates/update ──────────────────────────────────
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { id, slug, name, family, description, category, iconType, iconValue,
            status, sortOrder, isDefault, includeTags, excludeTags } = body;

    if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

    // Check slug uniqueness (excluding self)
    if (slug) {
      const existing = await prisma.osTemplate.findFirst({ where: { slug, NOT: { id } } });
      if (existing) return NextResponse.json({ ok: false, error: "Slug already exists" }, { status: 409 });
    }

    // Clear siblings' isDefault if this one is being set as default
    if (isDefault === true) {
      let effectiveFamily: string | null = null;
      if (family !== undefined) {
        effectiveFamily = family || null;
      } else {
        const current = await prisma.osTemplate.findUnique({ where: { id }, select: { family: true } });
        effectiveFamily = current?.family ?? null;
      }
      if (effectiveFamily) {
        await prisma.osTemplate.updateMany({
          where: { family: effectiveFamily, id: { not: id } },
          data:  { isDefault: false },
        });
      }
    }

    const updated = await prisma.osTemplate.update({
      where: { id },
      data: {
        ...(slug        !== undefined && { slug        }),
        ...(name        !== undefined && { name        }),
        ...(family      !== undefined && { family:      family      ?? null }),
        ...(description !== undefined && { description: description ?? null }),
        ...(category    !== undefined && { category    }),
        ...(iconType    !== undefined && { iconType    }),
        ...(iconValue   !== undefined && { iconValue:   iconValue   ?? null }),
        ...(status      !== undefined && { status      }),
        ...(sortOrder   !== undefined && { sortOrder   }),
        ...(isDefault   !== undefined && { isDefault   }),
        ...(includeTags !== undefined && { includeTags }),
        ...(excludeTags !== undefined && { excludeTags }),
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "Failed" }, { status: 500 });
  }
}