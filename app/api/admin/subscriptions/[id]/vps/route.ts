// app/api/admin/subscriptions/[id]/vps/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const subscriptionId = s(id).trim();

  if (!subscriptionId) {
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_ID_REQUIRED" }, { status: 400 });
  }

  const server = await prisma.server.findFirst({
    where: { subscriptionId },
    select: {
      hetznerServerId: true,
      oracleInstanceId: true,
    },
  });

  return NextResponse.json({
    ok: true,
    hetznerServerId: server?.hetznerServerId ?? "",
    oracleInstanceId: server?.oracleInstanceId ?? "",
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const subscriptionId = s(id).trim();

  if (!subscriptionId) {
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_ID_REQUIRED" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as
    | { hetznerServerId?: unknown; hetznerApiToken?: unknown; oracleInstanceId?: unknown }
    | null;

  const hetznerServerIdRaw = s(body?.hetznerServerId).trim();
  const tokenRaw = s(body?.hetznerApiToken).trim();
  const oracleInstanceIdRaw = s(body?.oracleInstanceId).trim();

  const hasHetznerIdUpdate = Boolean(hetznerServerIdRaw);
  const hasHetznerTokenUpdate = Boolean(tokenRaw);
  const hasOracleUpdate = Boolean(oracleInstanceIdRaw);

  if (!hasHetznerIdUpdate && !hasHetznerTokenUpdate && !hasOracleUpdate) {
    return NextResponse.json({ ok: true });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, userId: true },
  });

  if (!subscription) {
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_NOT_FOUND" }, { status: 404 });
  }

  // avoid duplicates
  if (hasHetznerIdUpdate) {
    const conflict = await prisma.server.findFirst({
      where: { hetznerServerId: hetznerServerIdRaw, NOT: { subscriptionId } },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json({ ok: false, error: "HETZNER_SERVER_ID_ALREADY_ASSIGNED" }, { status: 409 });
    }
  }

  if (hasOracleUpdate) {
    const conflict = await prisma.server.findFirst({
      where: { oracleInstanceId: oracleInstanceIdRaw, NOT: { subscriptionId } },
      select: { id: true },
    });
    if (conflict) {
      return NextResponse.json({ ok: false, error: "ORACLE_INSTANCE_ID_ALREADY_ASSIGNED" }, { status: 409 });
    }
  }

  const existing = await prisma.server.findFirst({
    where: { subscriptionId },
    select: { id: true },
  });

  const data: { hetznerServerId?: string; hetznerApiToken?: string; oracleInstanceId?: string } = {};
  if (hasHetznerIdUpdate) data.hetznerServerId = hetznerServerIdRaw;
  if (hasHetznerTokenUpdate) data.hetznerApiToken = tokenRaw; // empty never clears
  if (hasOracleUpdate) data.oracleInstanceId = oracleInstanceIdRaw;

  if (existing) {
    await prisma.server.update({ where: { id: existing.id }, data });
    return NextResponse.json({ ok: true });
  }

  await prisma.server.create({
    data: {
      userId: subscription.userId,
      subscriptionId: subscription.id,
      ...data,
    },
  });

  return NextResponse.json({ ok: true });
}