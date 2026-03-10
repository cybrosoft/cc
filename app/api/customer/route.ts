// app/api/admin/customer/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const group = searchParams.get("group"); // e.g. "enterprise"

    const entGroup = group
      ? await prisma.customerGroup.findFirst({ where: { key: group } })
      : null;

    const users = await prisma.user.findMany({
      where: {
        role: "CUSTOMER",
        ...(entGroup ? { customerGroupId: entGroup.id } : {}),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        customerNumber: true,
        customerGroup: { select: { id: true, key: true, name: true } },
        market: { select: { id: true, key: true, name: true, defaultCurrency: true } },
      },
      orderBy: { email: "asc" },
    });

    return NextResponse.json({ ok: true, data: users });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}