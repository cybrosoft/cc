// app/api/admin/users/[id]/status-log/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;

  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: "User",
      entityId:   id,
      action:     { startsWith: "CUSTOMER_STATUS_" },
    },
    orderBy: { id: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      metadataJson: true,
      createdAt: true,
      actorUserId: true,
    },
  });

  // Get actor names
  const actorIds = [...new Set(logs.map(l => l.actorUserId).filter(Boolean))];
  const actors = await prisma.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, fullName: true, email: true },
  });
  const actorMap = Object.fromEntries(actors.map(a => [a.id, a.fullName ?? a.email]));

  const entries = logs.map(l => {
    let meta: Record<string, unknown> = {};
    try { meta = JSON.parse(l.metadataJson ?? "{}"); } catch { /* ignore */ }
    return {
      id:       l.id,
      action:   l.action.replace("CUSTOMER_STATUS_", ""),
      from:     meta.from ?? null,
      to:       meta.to ?? null,
      reason:   meta.reason ?? null,
      message:  meta.message ?? null,
      actor:    actorMap[l.actorUserId] ?? "System",
      createdAt: l.createdAt,
    };
  });

  return NextResponse.json({ ok: true, data: entries });
}
