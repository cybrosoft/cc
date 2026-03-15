// app/api/admin/subscriptions/[id]/status/route.ts
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { SubscriptionStatus, PaymentStatus } from "@prisma/client";

function s(v: unknown): string { return typeof v === "string" ? v : ""; }

const VALID_STATUSES = Object.values(SubscriptionStatus);

// Status display labels
const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Pending Payment",
  PROCESSING:      "Processing",
  ACTIVE:          "Active",
  SUSPENDED:       "Suspended",
  EXPIRED:         "Expired",
  CANCELED:        "Canceled",
};

// GET — fetch status log for a subscription
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;

  const sub = await prisma.subscription.findUnique({
    where:  { id },
    select: {
      id: true, status: true, paymentStatus: true,
      createdAt: true, currentPeriodEnd: true,
      statusLogs: {
        select: {
          id: true, status: true, comment: true,
          isAutomatic: true, createdAt: true,
          changedBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!sub)
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({ ok: true, data: sub });
}

// POST — change subscription status
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id } = await ctx.params;

  const body = (await req.json().catch(() => null)) as {
    status?:             unknown;
    comment?:            unknown;
    // For ACTIVE — optionally set period dates
    currentPeriodStart?: unknown;
    currentPeriodEnd?:   unknown;
  } | null;

  const newStatus = s(body?.status).trim() as SubscriptionStatus;
  const comment   = s(body?.comment).trim();

  if (!VALID_STATUSES.includes(newStatus))
    return NextResponse.json({ ok: false, error: "INVALID_STATUS" }, { status: 400 });

  if (!comment)
    return NextResponse.json({ ok: false, error: "COMMENT_REQUIRED" }, { status: 400 });

  const sub = await prisma.subscription.findUnique({
    where:  { id },
    select: { id: true, status: true, currentPeriodStart: true, currentPeriodEnd: true },
  });
  if (!sub)
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const fromStatus = sub.status;

  // Build update data
  const updateData: Record<string, unknown> = { status: newStatus };

  // Option B: if changing to ACTIVE, also handle period dates
  if (newStatus === SubscriptionStatus.ACTIVE) {
    const startRaw = s(body?.currentPeriodStart).trim();
    const endRaw   = s(body?.currentPeriodEnd).trim();
    if (startRaw) updateData["currentPeriodStart"] = new Date(startRaw);
    if (endRaw)   updateData["currentPeriodEnd"]   = new Date(endRaw);
    // Also mark as paid if activating
    if (!sub.currentPeriodStart) {
      updateData["paymentStatus"] = PaymentStatus.PAID;
    }
  }

  // If canceling or suspending — clear period end to stop auto-expiry confusion
  if (newStatus === SubscriptionStatus.CANCELED) {
    updateData["paymentStatus"] = PaymentStatus.UNPAID;
  }

  // Run in transaction — update status + write log
  await prisma.$transaction([
    prisma.subscription.update({
      where: { id },
      data:  updateData as never,
    }),
    prisma.subscriptionStatusLog.create({
      data: {
        subscriptionId:  id,
        status:          newStatus,
        comment:         `[${STATUS_LABELS[fromStatus]} → ${STATUS_LABELS[newStatus]}] ${comment}`,
        isAutomatic:     false,
        changedByUserId: admin.id,
      },
    }),
  ]);

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "SUBSCRIPTION_STATUS_CHANGED",
      entityType:   "Subscription",
      entityId:     id,
      metadataJson: JSON.stringify({ from: fromStatus, to: newStatus, comment }),
    },
  });

  return NextResponse.json({ ok: true, from: fromStatus, to: newStatus });
}