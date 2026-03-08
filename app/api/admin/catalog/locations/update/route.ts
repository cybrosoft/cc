// app/api/admin/catalog/locations/update/route.ts
import { NextResponse } from "next/server";
import { prisma }       from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

// ── POST /api/admin/catalog/locations/update ──────────────────────────────────
export async function POST(req: Request) {
  try {
    await requireAdmin();

    const body = await req.json();
    const { id, code, name, family, description, countryCode, flag, status, sortOrder, isDefault, includeTags, excludeTags } = body;

    if (!id) return NextResponse.json({ ok: false, error: "id is required" }, { status: 400 });

    // Check code uniqueness (excluding self)
    if (code) {
      const existing = await prisma.location.findFirst({ where: { code, NOT: { id } } });
      if (existing) return NextResponse.json({ ok: false, error: "Location code already exists" }, { status: 409 });
    }

    // If setting isDefault: true, resolve family and clear siblings
    if (isDefault === true) {
      let effectiveFamily: string | null = null;
      if (family !== undefined) {
        effectiveFamily = family || null;
      } else {
        const current = await prisma.location.findUnique({ where: { id }, select: { family: true } });
        effectiveFamily = current?.family ?? null;
      }
      if (effectiveFamily) {
        await prisma.location.updateMany({
          where: { family: effectiveFamily, id: { not: id } },
          data:  { isDefault: false },
        });
      }
    }

    const updated = await prisma.location.update({
      where: { id },
      data: {
        ...(code        !== undefined && { code        }),
        ...(name        !== undefined && { name        }),
        ...(family      !== undefined && { family:      family      ?? null }),
        ...(description !== undefined && { description: description ?? null }),
        ...(countryCode !== undefined && { countryCode: countryCode ?? null }),
        ...(flag        !== undefined && { flag:        flag        ?? null }),
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