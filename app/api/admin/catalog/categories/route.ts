// app/api/admin/catalog/categories/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const rows = await prisma.category.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        key: true,
        name: true,
        isActive: true,
      },
    });

    return NextResponse.json({ ok: true, data: rows });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as {
      key?: unknown;
      name?: unknown;
    } | null;

    const key = String(body?.key ?? "").trim();
    const name = String(body?.name ?? "").trim();

    if (!key || !name) {
      return NextResponse.json(
        { ok: false, error: "key and name are required" },
        { status: 400 }
      );
    }

    const created = await prisma.category.create({
      data: {
        key,
        name,
        isActive: true,
      },
      select: {
        id: true,
        key: true,
        name: true,
        isActive: true,
      },
    });

    return NextResponse.json({ ok: true, data: created });
  } catch (e: unknown) {
    const message =
      e instanceof Error ? e.message : "Failed to create category";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}