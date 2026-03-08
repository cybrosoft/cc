export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const raw = (await req.json().catch(() => null)) as unknown;
  if (!raw || !isRecord(raw)) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const serverId = (readString(raw, "serverId") ?? "").trim();
  if (!serverId) {
    return NextResponse.json({ ok: false, error: "serverId required" }, { status: 400 });
  }

  const server = await prisma.server.findFirst({
    where: { id: serverId, userId: user.id },
    select: { id: true, hetznerServerId: true },
  });

  if (!server) {
    return NextResponse.json({ ok: false, error: "SERVER_NOT_FOUND" }, { status: 404 });
  }

  // Stub action (real Hetzner later)
  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      action: "SERVER_RESTART_REQUESTED",
      entityType: "Server",
      entityId: server.id,
      metadataJson: JSON.stringify({ hetznerServerId: server.hetznerServerId }),
    },
  });

  return NextResponse.json({ ok: true });
}