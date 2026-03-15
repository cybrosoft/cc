// lib/subscriptions/auto-status-check.ts
// Run this from: admin settings "Run Status Check" button OR future cron job
// Checks all subscriptions and auto-transitions where rules apply

import { prisma } from "@/lib/prisma";
import { SubscriptionStatus } from "@prisma/client";

const SYSTEM_COMMENT = {
  SUSPENDED: "Auto-suspended: subscription unpaid for 15 days since creation.",
  EXPIRED:   "Auto-expired: subscription period has ended.",
  CANCELED:  "Auto-canceled: subscription expired for 30 days with no renewal.",
};

export async function runAutoStatusCheck(): Promise<{
  suspended: number;
  expired:   number;
  canceled:  number;
}> {
  const now     = new Date();
  const results = { suspended: 0, expired: 0, canceled: 0 };

  // ── 1. PENDING_PAYMENT → SUSPENDED (15 days unpaid since createdAt) ─────────
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);

  const toSuspend = await prisma.subscription.findMany({
    where: {
      status:        SubscriptionStatus.PENDING_PAYMENT,
      paymentStatus: "UNPAID",
      createdAt:     { lte: fifteenDaysAgo },
    },
    select: { id: true },
  });

  for (const sub of toSuspend) {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: sub.id },
        data:  { status: SubscriptionStatus.SUSPENDED },
      }),
      prisma.subscriptionStatusLog.create({
        data: {
          subscriptionId: sub.id,
          status:         SubscriptionStatus.SUSPENDED,
          comment:        SYSTEM_COMMENT.SUSPENDED,
          isAutomatic:    true,
        },
      }),
    ]);
    results.suspended++;
  }

  // ── 2. ACTIVE → EXPIRED (currentPeriodEnd has passed) ───────────────────────
  const toExpire = await prisma.subscription.findMany({
    where: {
      status:           SubscriptionStatus.ACTIVE,
      currentPeriodEnd: { lte: now },
    },
    select: { id: true },
  });

  for (const sub of toExpire) {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: sub.id },
        data:  { status: SubscriptionStatus.EXPIRED },
      }),
      prisma.subscriptionStatusLog.create({
        data: {
          subscriptionId: sub.id,
          status:         SubscriptionStatus.EXPIRED,
          comment:        SYSTEM_COMMENT.EXPIRED,
          isAutomatic:    true,
        },
      }),
    ]);
    results.expired++;
  }

  // ── 3. EXPIRED → CANCELED (30 days since expiry) ────────────────────────────
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const toCancel = await prisma.subscription.findMany({
    where: {
      status:           SubscriptionStatus.EXPIRED,
      currentPeriodEnd: { lte: thirtyDaysAgo },
    },
    select: { id: true },
  });

  for (const sub of toCancel) {
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: sub.id },
        data:  { status: SubscriptionStatus.CANCELED },
      }),
      prisma.subscriptionStatusLog.create({
        data: {
          subscriptionId: sub.id,
          status:         SubscriptionStatus.CANCELED,
          comment:        SYSTEM_COMMENT.CANCELED,
          isAutomatic:    true,
        },
      }),
    ]);
    results.canceled++;
  }

  // ── 4. Auto-renew: ACTIVE subscriptions with autoRenew=true expiring soon ──
  const toRenew = await prisma.subscription.findMany({
    where: {
      status:    SubscriptionStatus.ACTIVE,
      autoRenew: true,
      currentPeriodEnd: { lte: now },
    },
    select: { id: true },
  });

  for (const sub of toRenew) {
    // Call renewal via internal fetch — reuses all renewal logic
    await fetch(`${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/api/admin/subscriptions/${sub.id}/renewal`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "renew", isAutomatic: true }),
    }).catch(() => {}); // don't fail the whole check if one renewal fails
  }

  return results;
}