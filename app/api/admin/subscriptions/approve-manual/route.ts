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
    id?: unknown;
    currentPeriodStart?: unknown;
    currentPeriodEnd?: unknown;
    paymentDate?: unknown;
    invoiceNumber?: unknown;
    manualPaymentReference?: unknown;
    billingPeriod?: unknown;
    locationCode?: unknown;
  } | null;

  const id = s(body?.id).trim();
  if (!id)
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_ID_REQUIRED" }, { status: 400 });

  const currentPeriodStart = parseDateISO(body?.currentPeriodStart);
  const currentPeriodEnd   = parseDateISO(body?.currentPeriodEnd);
  if (!currentPeriodStart || !currentPeriodEnd)
    return NextResponse.json({ ok: false, error: "PERIOD_REQUIRED" }, { status: 400 });

  const paymentDate = parseDateISO(body?.paymentDate);

  // Validate billingPeriod if provided
  const bpRaw = s(body?.billingPeriod).trim();
  const billingPeriod = Object.values(BillingPeriod).includes(bpRaw as BillingPeriod)
    ? (bpRaw as BillingPeriod)
    : undefined;

  const locationCode = s(body?.locationCode).trim() || null;

  await prisma.subscription.update({
    where: { id },
    data: {
      status:                 SubscriptionStatus.ACTIVE,
      paymentStatus:          paymentDate ? PaymentStatus.PAID : PaymentStatus.UNPAID,
      currentPeriodStart,
      currentPeriodEnd,
      invoiceNumber:          s(body?.invoiceNumber).trim()          || null,
      manualPaymentReference: s(body?.manualPaymentReference).trim() || null,
      ...(billingPeriod  ? { billingPeriod }  : {}),
      ...(locationCode !== undefined ? { locationCode } : {}),

    },
  });

  return NextResponse.json({ ok: true });
}