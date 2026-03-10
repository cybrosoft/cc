import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const data = await prisma.market.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, key: true, name: true, defaultCurrency: true },
    });
    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}