// FILE: app/api/admin/users/[id]/plan-subscriptions/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function GET(_req: Request, ctx: { params: { id?: string } }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const userId = s(ctx?.params?.id).trim();
  if (!userId) return NextResponse.json({ ok: false, error: "User id required" }, { status: 400 });

  const plans = await prisma.subscription.findMany({
    where: {
      userId,
      product: { type: "plan" },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      activatedAt: true,
      currentPeriodEnd: true,
      product: { select: { id: true, name: true, key: true } },
    },
  });

  return NextResponse.json({ ok: true, plans });
}