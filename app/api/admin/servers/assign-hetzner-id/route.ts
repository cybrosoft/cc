export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { SubscriptionStatus } from "@prisma/client";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readString(v: Record<string, unknown>, key: string): string | null {
  const x = v[key];
  return typeof x === "string" ? x : null;
}

export async function POST(req: Request) {
  const admin = await getSessionUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const rawBody = (await req.json().catch(() => null)) as unknown;
  if (!rawBody || !isRecord(rawBody)) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const subscriptionId = readString(rawBody, "subscriptionId")?.trim() ?? "";
  const hetznerServerId = readString(rawBody, "hetznerServerId")?.trim() ?? "";
  const hetznerApiToken = readString(rawBody, "hetznerApiToken")?.trim() ?? "";

  if (!subscriptionId || !hetznerServerId || !hetznerApiToken) {
    return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: { id: true, userId: true, status: true },
  });

  if (!subscription) {
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_NOT_FOUND" }, { status: 404 });
  }

  if (subscription.status !== SubscriptionStatus.ACTIVE) {
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_NOT_ACTIVE" }, { status: 400 });
  }

  // Hetzner ID must be unique globally
  const existingWithHetzner = await prisma.server.findFirst({
    where: { hetznerServerId },
    select: { id: true, subscriptionId: true },
  });

  if (existingWithHetzner && existingWithHetzner.subscriptionId !== subscription.id) {
    return NextResponse.json({ ok: false, error: "HETZNER_SERVER_ALREADY_ASSIGNED" }, { status: 400 });
  }

  // If server already exists for this subscription, update it. Otherwise, create.
  const existingForSubscription = await prisma.server.findFirst({
    where: { subscriptionId: subscription.id },
    select: { id: true, userId: true },
  });

  let serverId: string;

  if (existingForSubscription) {
    if (existingForSubscription.userId !== subscription.userId) {
      return NextResponse.json(
        { ok: false, error: "SERVER_SUBSCRIPTION_USER_MISMATCH" },
        { status: 400 }
      );
    }

    const updated = await prisma.server.update({
      where: { id: existingForSubscription.id },
      data: { hetznerServerId, hetznerApiToken },
      select: { id: true },
    });

    serverId = updated.id;

    await prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: "SERVER_HETZNER_UPDATED",
        entityType: "Server",
        entityId: serverId,
        // ✅ never store token in logs
        metadataJson: JSON.stringify({
          subscriptionId: subscription.id,
          hetznerServerId,
          tokenUpdated: true,
        }),
      },
    });
  } else {
    const created = await prisma.server.create({
      data: {
        userId: subscription.userId,
        subscriptionId: subscription.id,
        hetznerServerId,
        hetznerApiToken,
      },
      select: { id: true },
    });

    serverId = created.id;

    await prisma.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: "SERVER_ASSIGNED",
        entityType: "Server",
        entityId: serverId,
        metadataJson: JSON.stringify({
          subscriptionId: subscription.id,
          hetznerServerId,
          tokenStored: true,
        }),
      },
    });
  }

  return NextResponse.json({ ok: true, serverId });
}