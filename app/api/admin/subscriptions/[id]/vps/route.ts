// app/api/admin/subscriptions/[id]/vps/route.ts
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

function s(v: unknown): string { return typeof v === "string" ? v : ""; }

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;
  const subscriptionId = s(id).trim();
  if (!subscriptionId)
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_ID_REQUIRED" }, { status: 400 });

  const server = await prisma.server.findFirst({
    where:  { subscriptionId },
    select: {
      id:                    true,
      hetznerServerId:       true,
      // hetznerApiToken never returned — security
      oracleInstanceId:      true,
      oracleInstanceRegion:  true,
      oracleCompartmentOcid: true,
    },
  });

  return NextResponse.json({
    ok:                    true,
    // Hetzner
    hetznerServerId:       server?.hetznerServerId       ?? null,
    hetznerHasToken:       false, // token never exposed — just signal it exists
    // Oracle
    oracleInstanceId:      server?.oracleInstanceId      ?? null,
    oracleInstanceRegion:  server?.oracleInstanceRegion  ?? null,
    oracleCompartmentOcid: server?.oracleCompartmentOcid ?? null,
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;
  const subscriptionId = s(id).trim();
  if (!subscriptionId)
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_ID_REQUIRED" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as {
    provider?:             unknown;
    // Hetzner
    hetznerServerId?:      unknown;
    hetznerApiToken?:      unknown;  // blank = no change
    // Oracle
    oracleInstanceId?:     unknown;
    oracleInstanceRegion?: unknown;
    oracleCompartmentOcid?: unknown;
  } | null;

  const provider = s(body?.provider).trim().toUpperCase(); // "HETZNER" | "ORACLE"

  // Get subscription to check it exists and get userId
  const subscription = await prisma.subscription.findUnique({
    where:  { id: subscriptionId },
    select: { id: true, userId: true },
  });
  if (!subscription)
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_NOT_FOUND" }, { status: 404 });

  // Get existing server record if any
  const existing = await prisma.server.findFirst({
    where:  { subscriptionId },
    select: {
      id:                    true,
      hetznerServerId:       true,
      oracleInstanceId:      true,
      oracleInstanceRegion:  true,
      oracleCompartmentOcid: true,
    },
  });

  if (provider === "ORACLE") {
    const instanceId  = s(body?.oracleInstanceId).trim();
    const region      = s(body?.oracleInstanceRegion).trim();
    const compartment = s(body?.oracleCompartmentOcid).trim();

    // All 3 fields required for Oracle
    if (!instanceId)  return NextResponse.json({ ok: false, error: "ORACLE_INSTANCE_ID_REQUIRED" }, { status: 400 });
    if (!region)      return NextResponse.json({ ok: false, error: "ORACLE_INSTANCE_REGION_REQUIRED" }, { status: 400 });
    if (!compartment) return NextResponse.json({ ok: false, error: "ORACLE_COMPARTMENT_OCID_REQUIRED" }, { status: 400 });

    // Check uniqueness of Instance OCID
    const conflict = await prisma.server.findFirst({
      where: { oracleInstanceId: instanceId, NOT: { subscriptionId } },
      select: { id: true },
    });
    if (conflict)
      return NextResponse.json({ ok: false, error: "ORACLE_INSTANCE_ID_ALREADY_ASSIGNED" }, { status: 409 });

    const data = {
      oracleInstanceId:      instanceId,
      oracleInstanceRegion:  region,
      oracleCompartmentOcid: compartment,
    };

    if (existing) {
      await prisma.server.update({ where: { id: existing.id }, data });
    } else {
      await prisma.server.create({ data: { userId: subscription.userId, subscriptionId, ...data } });
    }

    await prisma.auditLog.create({
      data: {
        actorUserId:  admin.id,
        action:       "VPS_ASSIGNED",
        entityType:   "Server",
        entityId:     subscriptionId,
        metadataJson: JSON.stringify({ provider: "ORACLE", instanceId, region }),
      },
    });

    return NextResponse.json({ ok: true });
  }

  if (provider === "HETZNER") {
    const serverId = s(body?.hetznerServerId).trim();
    const token    = s(body?.hetznerApiToken).trim();

    // Server ID is required and must be numeric
    if (!serverId)
      return NextResponse.json({ ok: false, error: "HETZNER_SERVER_ID_REQUIRED" }, { status: 400 });
    if (!/^\d+$/.test(serverId))
      return NextResponse.json({ ok: false, error: "HETZNER_SERVER_ID_MUST_BE_NUMERIC" }, { status: 400 });

    // Check uniqueness of Server ID
    const conflict = await prisma.server.findFirst({
      where: { hetznerServerId: serverId, NOT: { subscriptionId } },
      select: { id: true },
    });
    if (conflict)
      return NextResponse.json({ ok: false, error: "HETZNER_SERVER_ID_ALREADY_ASSIGNED" }, { status: 409 });

    // Build update data — blank token = no change
    const data: Record<string, string> = { hetznerServerId: serverId };
    if (token) data["hetznerApiToken"] = token; // only update if provided

    if (existing) {
      await prisma.server.update({ where: { id: existing.id }, data });
    } else {
      await prisma.server.create({ data: { userId: subscription.userId, subscriptionId, ...data } });
    }

    await prisma.auditLog.create({
      data: {
        actorUserId:  admin.id,
        action:       "VPS_ASSIGNED",
        entityType:   "Server",
        entityId:     subscriptionId,
        metadataJson: JSON.stringify({ provider: "HETZNER", serverId }),
      },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: "UNKNOWN_PROVIDER" }, { status: 400 });
}