// FILE: app/api/admin/users/[id]/tags/route.ts
// GET  — fetch tags currently assigned to this user
// POST — replace user's tags with a given set of tag keys (connect/disconnect)
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/admin/users/[id]/tags ─────────────────────────────────────────

export async function GET(_req: Request, { params }: Params) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { id: userId } = await params;

  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { tags: { select: { id: true, key: true, name: true }, orderBy: { name: "asc" } } },
  });

  if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  return NextResponse.json({ ok: true, data: user.tags });
}

// ─── POST /api/admin/users/[id]/tags ────────────────────────────────────────
// Body: { tagKeys: string[] }  — full replacement (set)

export async function POST(req: Request, { params }: Params) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { id: userId } = await params;

  const body = (await req.json().catch(() => null)) as { tagKeys?: string[] } | null;
  if (!Array.isArray(body?.tagKeys)) {
    return NextResponse.json({ ok: false, error: "tagKeys array is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  // Resolve tag keys → ids (ignore unknown keys)
  const tags = await prisma.tag.findMany({
    where:  { key: { in: body.tagKeys } },
    select: { id: true, key: true, name: true },
  });

  // Full replace — disconnect all then connect matched
  const updated = await prisma.user.update({
    where: { id: userId },
    data:  { tags: { set: tags.map((t) => ({ id: t.id })) } },
    select: { tags: { select: { id: true, key: true, name: true }, orderBy: { name: "asc" } } },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "CUSTOMER_TAGS_UPDATED",
      entityType:   "User",
      entityId:     userId,
      metadataJson: JSON.stringify({ tagKeys: body.tagKeys }),
    },
  });

  return NextResponse.json({ ok: true, data: updated.tags });
}