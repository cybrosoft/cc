// app/api/admin/sales/[id]/log/route.ts
// GET — returns full change log for a sales document
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const logs = await prisma.salesDocumentLog.findMany({
      where:   { documentId: id },
      include: {
        changedBy: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ ok: true, logs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
