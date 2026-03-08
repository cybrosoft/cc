// app/api/admin/subscriptions/create-form/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { Role } from "@prisma/client";

export async function GET() {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { role: Role.CUSTOMER },
    select: {
      id: true,
      email: true,
      marketId: true,
      customerGroupId: true,
    },
    orderBy: { email: "asc" },
  });

  return NextResponse.json({ ok: true, customers: users });
}