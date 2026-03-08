// app/api/admin/catalog/tags/delete/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

// ─── POST /api/admin/catalog/tags/delete ─────────────────────────────────────
// Delete a tag — automatically disconnects from all products (Prisma handles join table)

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const id   = body?.id?.trim();

  if (!id) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const tag = await prisma.tag.findUnique({
    where:  { id },
    select: { id: true, key: true, name: true },
  });
  if (!tag) {
    return NextResponse.json({ ok: false, error: "Tag not found" }, { status: 404 });
  }

  await prisma.tag.delete({ where: { id } });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "TAG_DELETED",
      entityType:   "Tag",
      entityId:     id,
      metadataJson: JSON.stringify({ key: tag.key, name: tag.name }),
    },
  });

  return NextResponse.json({ ok: true });
}