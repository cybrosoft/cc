export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { getHetznerServer } from "@/lib/hetzner/hetzner-client";

type Params = { id: string };

function isThenable<T>(v: Promise<T> | T): v is Promise<T> {
  return typeof (v as { then?: unknown }).then === "function";
}

export async function GET(_req: Request, ctx: { params: Promise<Params> | Params }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const params = isThenable(ctx.params) ? await ctx.params : ctx.params;
  const serverId = String(params.id ?? "").trim();
  if (!serverId) {
    return NextResponse.json({ ok: false, error: "INVALID_SERVER_ID" }, { status: 400 });
  }

  const server = await prisma.server.findFirst({
    where: { id: serverId, userId: user.id },
    select: {
      id: true,
      subscriptionId: true,
      hetznerServerId: true,
      hetznerApiToken: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!server) {
    return NextResponse.json({ ok: false, error: "SERVER_NOT_FOUND" }, { status: 404 });
  }

  if (!server.hetznerServerId || !server.hetznerApiToken) {
    return NextResponse.json({ ok: false, error: "SERVER_NOT_HETZNER_MANAGED" }, { status: 400 });
  }

  try {
    const live = await getHetznerServer(server.hetznerApiToken, server.hetznerServerId);

    return NextResponse.json({
      ok: true,
      server: {
        id: server.id,
        subscriptionId: server.subscriptionId,
        hetznerServerId: server.hetznerServerId,
        name: live.name,
        status: live.status,
        ipv4: live.ipv4,
        ipv6: live.ipv6,
        createdAt: server.createdAt,
        updatedAt: server.updatedAt,
      },
    });
  } catch {
    return NextResponse.json({
      ok: true,
      server: {
        id: server.id,
        subscriptionId: server.subscriptionId,
        hetznerServerId: server.hetznerServerId,
        name: null,
        status: "unknown",
        ipv4: null,
        ipv6: null,
        createdAt: server.createdAt,
        updatedAt: server.updatedAt,
      },
    });
  }
}