// FILE: app/api/admin/subscriptions/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { SubscriptionStatus } from "@prisma/client";

function s(v: string | null): string {
  return typeof v === "string" ? v : "";
}

type PaymentStatusFilter = "PAID" | "PENDING";

export async function GET(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Number(s(searchParams.get("page")) || "1");
  const pageSize = 20;

  const email = s(searchParams.get("email")).trim();
  const statusParam = s(searchParams.get("status")).trim();
  const marketId = s(searchParams.get("marketId")).trim();
  const categoryId = s(searchParams.get("categoryId")).trim();
  const paymentStatusParam = s(searchParams.get("paymentStatus")).trim();
  const expiringDaysParam = s(searchParams.get("expiringDays")).trim();

  const status =
    statusParam && Object.values(SubscriptionStatus).includes(statusParam as SubscriptionStatus)
      ? (statusParam as SubscriptionStatus)
      : undefined;

  const paymentStatus =
    paymentStatusParam === "PAID" || paymentStatusParam === "PENDING"
      ? (paymentStatusParam as PaymentStatusFilter)
      : undefined;

  const expiringDays = Number(expiringDaysParam || "0");
  const expiringWindowDays = Number.isFinite(expiringDays) && expiringDays > 0 ? expiringDays : null;

  const where: Record<string, unknown> = {
    ...(status ? { status } : {}),
    ...(marketId ? { marketId } : {}),
    ...(email
      ? {
          user: {
            email: { contains: email, mode: "insensitive" as const },
          },
        }
      : {}),
  };

  if (categoryId) where["product"] = { categoryId };
  if (paymentStatus === "PAID") where["activatedAt"] = { not: null };
  if (paymentStatus === "PENDING") where["activatedAt"] = null;

  if (expiringWindowDays) {
    const now = new Date();
    const end = new Date(now.getTime() + expiringWindowDays * 24 * 60 * 60 * 1000);
    where["status"] = SubscriptionStatus.ACTIVE;
    where["currentPeriodEnd"] = { gte: now, lte: end };
  }

  const [subscriptions, total] = await Promise.all([
    prisma.subscription.findMany({
      where: where as never,
      select: {
        id: true,
        status: true,
        paymentStatus: true,
        billingProvider: true,
        createdAt: true,
        activatedAt: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        receiptUrl: true,

        provisionLocation: true,

        // details/notes (you said it's done)
        productDetails: true,
        productNote: true,

        // ✅ NEW: correct linking (addon -> parent plan)
        parentSubscriptionId: true,
        parentSubscription: {
          select: {
            id: true,
            status: true,
            product: { select: { id: true, name: true, key: true, type: true } },
          },
        },

        // ⚠️ legacy column kept but not required for new idea
        addonPlanProductId: true,

        user: { select: { id: true, email: true } },
        market: { select: { id: true, name: true } },
        product: {
          select: {
            id: true,
            name: true,
            key: true,
            type: true,
            category: { select: { id: true, name: true, key: true } },
          },
        },
        servers: {
          select: { id: true, hetznerServerId: true, oracleInstanceId: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (Math.max(1, page) - 1) * pageSize,
      take: pageSize,
    }),
    prisma.subscription.count({ where: where as never }),
  ]);

  return NextResponse.json({ ok: true, page: Math.max(1, page), pageSize, total, data: subscriptions });
}