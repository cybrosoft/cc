// app/api/admin/sales/[id]/print-token/route.ts
// GET — generate a permanent signed token for the print page
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createHmac } from "crypto";

export function generatePrintToken(docId: string): string {
  const secret = process.env.PRINT_TOKEN_SECRET ?? "fallback-secret";
  return createHmac("sha256", secret).update(docId).digest("hex");
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const token   = generatePrintToken(id);

    return NextResponse.json({ ok: true, token, url: `/print/sales/${id}?token=${token}` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
