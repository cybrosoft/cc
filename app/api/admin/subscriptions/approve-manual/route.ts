// app/api/admin/subscriptions/approve-manual/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { PaymentStatus, SubscriptionStatus } from "@prisma/client";

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseDateISO(v: unknown): Date | null {
  const t = s(v).trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function POST(req: Request) {
  const admin = await getSessionUser();

  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | {
        id?: unknown;
        currentPeriodStart?: unknown;
        currentPeriodEnd?: unknown;
        paymentDate?: unknown; // ✅ optional -> maps to activatedAt
        invoiceNumber?: unknown;
        receiptUrl?: unknown;
        manualPaymentReference?: unknown;
      }
    | null;

  const id = s(body?.id).trim();
  if (!id) return NextResponse.json({ ok: false, error: "SUBSCRIPTION_ID_REQUIRED" }, { status: 400 });

  const currentPeriodStart = parseDateISO(body?.currentPeriodStart);
  const currentPeriodEnd = parseDateISO(body?.currentPeriodEnd);
  if (!currentPeriodStart || !currentPeriodEnd) {
    return NextResponse.json({ ok: false, error: "PERIOD_REQUIRED" }, { status: 400 });
  }

  const paymentDate = parseDateISO(body?.paymentDate); // optional

  // ✅ Update billing info ALWAYS (even if already ACTIVE)
  // - Status becomes ACTIVE if not already
  // - PaymentStatus is PAID only if paymentDate exists, otherwise UNPAID
  const nextPaymentStatus = paymentDate ? PaymentStatus.PAID : PaymentStatus.UNPAID;

  await prisma.subscription.update({
    where: { id },
    data: {
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart,
      currentPeriodEnd,

      // ✅ payment date = activatedAt
      activatedAt: paymentDate,

      paymentStatus: nextPaymentStatus,

      // keep these if you use them later
      invoiceNumber: s(body?.invoiceNumber).trim() || null,
      manualPaymentReference: s(body?.manualPaymentReference).trim() || null,

      // receiptUrl is written by upload-receipt route; ignore if empty
      ...(s(body?.receiptUrl).trim() ? { receiptUrl: s(body?.receiptUrl).trim() } : {}),
    },
  });

  return NextResponse.json({ ok: true });
}