// app/api/admin/catalog/tags/update/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

// ─── POST /api/admin/catalog/tags/update ─────────────────────────────────────
// Rename a tag (key is immutable after creation)

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { id?: string; name?: string } | null;
  const id   = body?.id?.trim();
  const name = body?.name?.trim();

  if (!id || !name) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) {
    return NextResponse.json({ ok: false, error: "Tag not found" }, { status: 404 });
  }

  const updated = await prisma.tag.update({
    where:  { id },
    data:   { name },
    select: { id: true, key: true, name: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "TAG_UPDATED",
      entityType:   "Tag",
      entityId:     id,
      metadataJson: JSON.stringify({ oldName: tag.name, newName: name }),
    },
  });

  return NextResponse.json({ ok: true, data: updated });
}