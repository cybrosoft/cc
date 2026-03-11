// app/api/admin/markets/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma }        from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

export async function GET() {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const markets = await prisma.market.findMany({
    where:   { isActive: true },
    orderBy: { name: "asc" },
    select:  { id: true, key: true, name: true, defaultCurrency: true },
  });

  return NextResponse.json({ ok: true, data: markets });
}