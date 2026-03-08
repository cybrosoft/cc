export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const servers = await prisma.server.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      hetznerServerId: true,
      createdAt: true,
      subscription: {
        select: {
          id: true,
          status: true,
          paymentStatus: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          product: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({ ok: true, data: servers });
}