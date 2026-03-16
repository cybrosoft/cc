// app/api/admin/servers/debug/route.ts
// Temporary debug endpoint — remove after confirming servers page works
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

export async function GET() {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  try {
    // Test 1: basic count
    const count = await prisma.server.count();

    // Test 2: fetch one server with subscription (no enrichment)
    const sample = await prisma.server.findFirst({
      select: {
        id: true,
        hetznerServerId: true,
        oracleInstanceId: true,
        subscription: {
          select: {
            id: true,
            status: true,
            currentPeriodEnd: true,

            product: { select: { category: { select: { key: true } } } },
          },
        },
      },
    });

    return NextResponse.json({ ok: true, count, sample });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      error: e instanceof Error ? e.message : "Unknown",
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 5) : null,
    }, { status: 500 });
  }
}