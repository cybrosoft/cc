// app/api/admin/catalog/categories/update/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    id?:   string;
    key?:  string;
    name?: string;
  } | null;

  const id   = body?.id?.trim();
  const key  = body?.key?.trim();
  const name = body?.name?.trim();

  if (!id || !key || !name) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  // Check for duplicate key (excluding self)
  const existing = await prisma.category.findFirst({
    where: { key, NOT: { id } },
  });
  if (existing) {
    return NextResponse.json({ ok: false, error: `Key "${key}" is already used by another category` }, { status: 409 });
  }

  const updated = await prisma.category.update({
    where:  { id },
    data:   { key, name },
    select: { id: true, key: true, name: true, isActive: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "CATEGORY_UPDATED",
      entityType:   "Category",
      entityId:     updated.id,
      metadataJson: JSON.stringify({ key, name }),
    },
  });

  return NextResponse.json({ ok: true, data: updated });
}