// app/api/admin/subscriptions/approve-manual/route.ts
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { BillingPeriod, PaymentStatus, SubscriptionStatus } from "@prisma/client";

function s(v: unknown): string { return typeof v === "string" ? v : ""; }

function parseDateISO(v: unknown): Date | null {
  const t = s(v).trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    id?:                    unknown;
    currentPeriodStart?:    unknown;
    currentPeriodEnd?:      unknown;
    paymentDate?:           unknown;
    paymentStatus?:         unknown;  // PAID | PARTIAL | UNPAID
    invoiceNumber?:         unknown;
    manualPaymentReference?: unknown;
    billingPeriod?:         unknown;
    syncAddons?:            unknown;  // true = also update child addon subscriptions
  } | null;

  const id = s(body?.id).trim();
  if (!id)
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_ID_REQUIRED" }, { status: 400 });

  const currentPeriodStart = parseDateISO(body?.currentPeriodStart);
  const currentPeriodEnd   = parseDateISO(body?.currentPeriodEnd);
  if (!currentPeriodStart || !currentPeriodEnd)
    return NextResponse.json({ ok: false, error: "PERIOD_REQUIRED" }, { status: 400 });

  const paymentDate = parseDateISO(body?.paymentDate);

  // Resolve payment status
  const paymentStatusRaw = s(body?.paymentStatus).trim();
  const paymentStatusVal = (["PAID", "PARTIAL", "UNPAID"].includes(paymentStatusRaw)
    ? paymentStatusRaw
    : paymentDate ? "PAID" : "UNPAID") as PaymentStatus;

  // Validate billingPeriod if provided
  const bpRaw = s(body?.billingPeriod).trim();
  const billingPeriod = Object.values(BillingPeriod).includes(bpRaw as BillingPeriod)
    ? (bpRaw as BillingPeriod)
    : undefined;

  const syncAddons = body?.syncAddons !== false; // default true

  // ── Update the plan/main subscription ─────────────────────────────────────
  await prisma.subscription.update({
    where: { id },
    data: {
      status:                 SubscriptionStatus.ACTIVE,
      paymentStatus:          paymentStatusVal,
      currentPeriodStart,
      currentPeriodEnd,
      invoiceNumber:          s(body?.invoiceNumber).trim()          || null,
      manualPaymentReference: s(body?.manualPaymentReference).trim() || null,
      ...(billingPeriod ? { billingPeriod } : {}),
    },
  });

  // ── Sync same-bundle addon subscriptions ──────────────────────────────────
  // Only sync addons created at the same time (within 60 seconds) — not mid-sub addons
  let syncedAddonIds: string[] = [];

  if (syncAddons) {
    const planSub = await prisma.subscription.findUnique({
      where:  { id },
      select: { createdAt: true },
    });

    if (planSub) {
      const bundleWindow = new Date(planSub.createdAt.getTime() + 60_000); // 60 second window

      const bundleAddons = await prisma.subscription.findMany({
        where: {
          parentSubscriptionId: id,
          createdAt: { lte: bundleWindow }, // created within 60s of plan = same bundle
        },
        select: { id: true },
      });

      if (bundleAddons.length > 0) {
        await prisma.subscription.updateMany({
          where: { id: { in: bundleAddons.map(a => a.id) } },
          data: {
            status:            SubscriptionStatus.ACTIVE,
            paymentStatus:     paymentStatusVal,
            currentPeriodStart,
            currentPeriodEnd,
          },
        });
        syncedAddonIds = bundleAddons.map(a => a.id);
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "SUBSCRIPTION_APPROVED",
      entityType:   "Subscription",
      entityId:     id,
      metadataJson: JSON.stringify({
        paymentStatus: paymentStatusVal,
        currentPeriodStart, currentPeriodEnd,
        syncedAddonIds,
      }),
    },
  });

  return NextResponse.json({ ok: true, syncedAddonCount: syncedAddonIds.length });
}