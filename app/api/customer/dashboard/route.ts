import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // These models exist — always safe
  const [activeSubscriptions, expiringSubscriptions, servers] = await Promise.all([
    prisma.subscription.count({
      where: { userId: user.id, status: "ACTIVE" },
    }),
    prisma.subscription.count({
      where: {
        userId: user.id,
        status: "ACTIVE",
        currentPeriodEnd: { gte: now, lte: in30Days },
      },
    }),
    prisma.server.count({
      where: { userId: user.id },
    }),
  ]);

  // SalesDocument queries — safe fallback until schema is migrated
  // Schema fields used:
  //   customerId  (User relation)
  //   type        (SalesDocumentType enum — INVOICE)
  //   status      (SalesDocumentStatus enum — OVERDUE / PAID)
  //   dueDate     (DateTime?)
  //   docNum      (unique doc number string e.g. CY-INV-5250)
  //   total       (Int cents)
  //   currency    (String)
  //   createdAt   (DateTime)
  let pendingInvoices = 0;
  let overdueInvoices = 0;
  let recentActivity: object[] = [];

  try {
    const [pending, overdue, recent] = await Promise.all([
      // Unpaid = any invoice not in PAID / VOID status
      prisma.salesDocument.count({
        where: {
          customerId: user.id,
          type: "INVOICE",
          status: { notIn: ["PAID", "VOID", "WRITTEN_OFF"] },
        },
      }),
      // Overdue = OVERDUE status
      prisma.salesDocument.count({
        where: {
          customerId: user.id,
          type: "INVOICE",
          status: "OVERDUE",
        },
      }),
      prisma.salesDocument.findMany({
        where: { customerId: user.id },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          docNum: true,    // schema: docNum String @unique
          type: true,
          status: true,
          total: true,     // schema: total Int (cents)
          currency: true,
          createdAt: true,
        },
      }),
    ]);

    pendingInvoices = pending;
    overdueInvoices = overdue;

    recentActivity = recent.map((doc) => ({
      id: doc.id,
      docNumber: doc.docNum,           // renamed to docNumber for client
      type: String(doc.type),
      status: String(doc.status),
      totalAmount: doc.total / 100,    // cents → display amount
      currency: doc.currency,
      createdAt: doc.createdAt.toISOString(),
    }));
  } catch {
    // SalesDocument table not yet migrated
  }

  return NextResponse.json({
    stats: {
      activeSubscriptions,
      pendingInvoices,
      overdueInvoices,
      expiringSubscriptions,
      servers,
    },
    recentActivity,
  });
}
