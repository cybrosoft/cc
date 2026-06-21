// app/api/customer/domains/route.ts
// Lists the customer's Domain & DNS subscriptions.
// No external provider calls — subscription data only.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: user.id,
        product: {
          category: { key: { in: ["domain", "dns"] } },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id:                 true,
        status:             true,
        billingPeriod:      true,
        currentPeriodEnd:   true,
        createdAt:          true,
        paymentStatus:      true,
        productDetails:     true,
        product: {
          select: {
            name: true,
            category: { select: { name: true } },
          },
        },
      },
    });

    const data = subscriptions.map(sub => {
      const domainName = (() => {
        const firstLine = sub.productDetails ? sub.productDetails.split("\n")[0].trim() : null;
        if (!firstLine || firstLine === sub.product.name) return null;
        return firstLine;
      })();

      return {
        subscriptionId: sub.id,
        product:         sub.product.category?.name ?? sub.product.name,
        resourceId:      `ri-${sub.id.slice(-15)}`,
        domainName,
        status:          String(sub.status),
        billingPeriod:   String(sub.billingPeriod),
        createdAt:       sub.createdAt.toISOString(),
        periodEnd:       sub.currentPeriodEnd?.toISOString() ?? null,
        paymentStatus:   String(sub.paymentStatus),
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "Request failed" }, { status: 500 });
  }
}
