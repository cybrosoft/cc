// app/api/auth/totp/status/route.ts
// Returns the current TOTP enabled status for the logged-in user.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { totpEnabled: true },
  });

  return NextResponse.json({ totpEnabled: dbUser?.totpEnabled ?? false });
}
