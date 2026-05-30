// app/api/servers/[id]/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { getServerCore } from "@/lib/hetzner";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { id: serverId } = await context.params;
  if (!serverId) return NextResponse.json({ ok: false, error: "INVALID_SERVER_ID" }, { status: 400 });

  const server = await prisma.server.findFirst({
    where: { id: serverId, userId: user.id },
    select: {
      id:              true,
      subscriptionId:  true,
      hetznerServerId: true,
      hetznerApiToken: true,
      oracleInstanceId: true,
      createdAt:       true,
      updatedAt:       true,
      subscription: {
        select: {
          status:        true,
          paymentStatus: true,
          billingPeriod: true,
          currentPeriodStart: true,
          currentPeriodEnd:   true,
          locationCode:  true,
          templateSlug:  true,
          product: { select: { key: true, name: true } },
        },
      },
    },
  });

  if (!server) return NextResponse.json({ ok: false, error: "SERVER_NOT_FOUND" }, { status: 404 });

  // Attempt to fetch live data from provider — fail gracefully
  let name:     string | null = null;
  let status:   string | null = "N/A";
  let ipv4:     string | null = null;
  let ipv6:     string | null = null;
  let location: string | null = null;
  let vcpu:     number | null = null;
  let ramGb:    number | null = null;
  let diskGb:   number | null = null;

  if (server.hetznerServerId && server.hetznerApiToken) {
    try {
      const core = await getServerCore(server.hetznerApiToken, server.hetznerServerId);
      name     = core.name;
      status   = core.status;
      ipv4     = core.ipv4;
      ipv6     = core.ipv6;
      location = core.location;
      vcpu     = core.vcpu;
      ramGb    = core.ramGb;
      diskGb   = core.diskGb;
    } catch {
      status = "N/A";
    }
  }

  return NextResponse.json({
    ok: true,
    server: {
      id:              server.id,
      subscriptionId:  server.subscriptionId,
      hetznerServerId: server.hetznerServerId,
      provider:        server.hetznerServerId ? "HETZNER" : server.oracleInstanceId ? "ORACLE" : "UNKNOWN",
      productKey:      server.subscription?.product?.key  ?? null,
      productName:     server.subscription?.product?.name ?? null,
      paymentStatus:   server.subscription?.paymentStatus ? String(server.subscription.paymentStatus) : null,
      subscriptionStatus: server.subscription?.status     ? String(server.subscription.status)        : null,
      billingPeriod:   server.subscription?.billingPeriod ? String(server.subscription.billingPeriod) : null,
      periodEnd:       server.subscription?.currentPeriodEnd?.toISOString() ?? null,
      locationCode:    server.subscription?.locationCode  ?? null,
      templateSlug:    server.subscription?.templateSlug  ?? null,
      name, status, ipv4, ipv6, location, vcpu, ramGb, diskGb,
      createdAt: server.createdAt.toISOString(),
      updatedAt: server.updatedAt.toISOString(),
    },
  });
}
