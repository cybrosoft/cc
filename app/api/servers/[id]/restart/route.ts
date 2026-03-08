export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { rebootHetznerServer, getHetznerServer } from "@/lib/hetzner/hetzner-client";
import { SubscriptionStatus } from "@prisma/client";

type Params = { id: string };

function isThenable<T>(v: Promise<T> | T): v is Promise<T> {
  return typeof (v as { then?: unknown }).then === "function";
}

export async function POST(_req: Request, ctx: { params: Promise<Params> | Params }) {
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
      hetznerServerId: true,
      hetznerApiToken: true,
      subscriptionId: true,
      subscription: { select: { id: true, status: true } },
    },
  });

  if (!server) {
    return NextResponse.json({ ok: false, error: "SERVER_NOT_FOUND" }, { status: 404 });
  }

  if (!server.subscriptionId || !server.subscription) {
    return NextResponse.json({ ok: false, error: "SERVER_NOT_LINKED_TO_SUBSCRIPTION" }, { status: 400 });
  }

  if (server.subscription.status !== SubscriptionStatus.ACTIVE) {
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_NOT_ACTIVE" }, { status: 400 });
  }

  if (!server.hetznerServerId || !server.hetznerApiToken) {
    // Not a Hetzner-managed server (Oracle/other)
    return NextResponse.json({ ok: false, error: "SERVER_NOT_HETZNER_MANAGED" }, { status: 400 });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      action: "SERVER_REBOOT_REQUESTED",
      entityType: "Server",
      entityId: server.id,
      metadataJson: JSON.stringify({
        subscriptionId: server.subscriptionId,
        hetznerServerId: server.hetznerServerId,
      }),
    },
  });

  await rebootHetznerServer(server.hetznerApiToken, server.hetznerServerId);

  // Best-effort updated status
  let providerStatus: string | null = null;
  try {
    const live = await getHetznerServer(server.hetznerApiToken, server.hetznerServerId);
    providerStatus = live.status;
  } catch {
    providerStatus = null;
  }

  await prisma.auditLog.create({
    data: {
      actorUserId: user.id,
      action: "SERVER_REBOOT_COMPLETED",
      entityType: "Server",
      entityId: server.id,
      metadataJson: JSON.stringify({
        subscriptionId: server.subscriptionId,
        hetznerServerId: server.hetznerServerId,
        providerStatus,
      }),
    },
  });

  return NextResponse.json({
    ok: true,
    action: "reboot",
    providerStatus,
  });
}