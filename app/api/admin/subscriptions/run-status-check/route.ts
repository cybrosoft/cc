// app/api/admin/subscriptions/run-status-check/route.ts
export const runtime = "nodejs";

import { NextResponse }          from "next/server";
import { getSessionUser }        from "@/lib/auth/get-session-user";
import { runAutoStatusCheck }    from "@/lib/subscriptions/auto-status-check";

export async function POST() {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const results = await runAutoStatusCheck();

  return NextResponse.json({ ok: true, results });
}