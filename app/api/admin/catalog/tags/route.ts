// app/api/admin/catalog/tags/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

// ─── GET /api/admin/catalog/tags ─────────────────────────────────────────────

export async function GET() {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    select: {
      id:        true,
      key:       true,
      name:      true,
      createdAt: true,
      _count:    { select: { products: true } },
    },
  });

  return NextResponse.json({ ok: true, data: tags });
}

// ─── POST /api/admin/catalog/tags ────────────────────────────────────────────

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { key?: string; name?: string } | null;
  const key  = body?.key?.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const name = body?.name?.trim();

  if (!key || !name) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const existing = await prisma.tag.findUnique({ where: { key } });
  if (existing) {
    return NextResponse.json({ ok: false, error: `Tag key "${key}" already exists` }, { status: 409 });
  }

  const tag = await prisma.tag.create({
    data:   { key, name },
    select: { id: true, key: true, name: true, _count: { select: { products: true } } },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "TAG_CREATED",
      entityType:   "Tag",
      entityId:     tag.id,
      metadataJson: JSON.stringify({ key, name }),
    },
  });

  return NextResponse.json({ ok: true, data: tag });
}