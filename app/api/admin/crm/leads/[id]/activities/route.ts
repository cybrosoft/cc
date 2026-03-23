// app/api/admin/crm/leads/[id]/activities/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

type Params = { params: Promise<{ id: string }> };

// GET /api/admin/crm/leads/[id]/activities
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const activities = await prisma.cRMActivity.findMany({
      where:   { documentId: id },
      include: {
        createdBy:  { select: { id: true, fullName: true, email: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, activities });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST /api/admin/crm/leads/[id]/activities
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = await req.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const activity = await prisma.cRMActivity.create({
      data: {
        documentId:       id,
        type:             body.type         ?? "NOTE",
        title:            body.title.trim(),
        description:      body.description  ?? null,
        dueDate:          body.dueDate      ? new Date(body.dueDate) : null,
        assignedToId:     body.assignedToId ?? null,
        createdByAdminId: auth.user.id,
      },
      include: {
        createdBy:  { select: { id: true, fullName: true, email: true } },
        assignedTo: { select: { id: true, fullName: true, email: true } },
      },
    });
    return NextResponse.json({ ok: true, activity });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/admin/crm/leads/[id]/activities — mark complete / edit
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await params;
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json({ error: "Activity id required" }, { status: 400 });
    }

    const activity = await prisma.cRMActivity.update({
      where: { id: body.id },
      data: {
        ...(body.completedAt  !== undefined ? { completedAt:  body.completedAt  ? new Date(body.completedAt) : null } : {}),
        ...(body.title        !== undefined ? { title:        body.title }        : {}),
        ...(body.description  !== undefined ? { description:  body.description }  : {}),
        ...(body.dueDate      !== undefined ? { dueDate:      body.dueDate ? new Date(body.dueDate) : null } : {}),
        ...(body.assignedToId !== undefined ? { assignedToId: body.assignedToId } : {}),
      },
    });
    return NextResponse.json({ ok: true, activity });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
