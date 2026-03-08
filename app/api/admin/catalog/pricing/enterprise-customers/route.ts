// app/api/admin/catalog/pricing/enterprise-customers/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

export async function GET() {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  // Find the enterprise customer group
  const enterpriseGroup = await prisma.customerGroup.findUnique({
    where: { key: "enterprise" },
    select: { id: true },
  });

  if (!enterpriseGroup) {
    return NextResponse.json({ ok: true, data: [] });
  }

  const customers = await prisma.user.findMany({
    where: {
      customerGroupId: enterpriseGroup.id,
      role: "CUSTOMER",
    },
    select: {
      id:             true,
      fullName:       true,
      email:          true,
      customerNumber: true,
    },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json({ ok: true, data: customers });
}
