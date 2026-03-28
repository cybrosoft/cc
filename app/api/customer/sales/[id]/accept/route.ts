// app/api/customer/sales/[id]/accept/route.ts
// Customer accepts a quotation.
// Sets status → ACCEPTED, creates in-app notification for admin.

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { invalidateCustomer } from "@/lib/cache/customer-cache";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch the doc — must be a QUOTATION in ISSUED or SENT or REVISED state
  const doc = await prisma.salesDocument.findFirst({
    where: {
      id:         params.id,
      customerId: user.id,
      type:       "QUOTATION",
      status:     { in: ["ISSUED", "SENT", "REVISED"] },
    },
    select: { id: true, docNum: true, status: true },
  });

  if (!doc) {
    return NextResponse.json(
      { error: "Quotation not found or not in an acceptable state" },
      { status: 404 }
    );
  }

  // Update status to ACCEPTED + log it
  await prisma.$transaction([
    prisma.salesDocument.update({
      where: { id: doc.id },
      data:  { status: "ACCEPTED", updatedAt: new Date() },
    }),
    prisma.salesDocumentLog.create({
      data: {
        documentId:  doc.id,
        field:       "status",
        oldValue:    String(doc.status),
        newValue:    "ACCEPTED",
        note:        "Accepted by customer via portal",
        changedById: user.id,
      },
    }),
  ]);

  // Notify all admins
  try {
    const admins = await prisma.user.findMany({
      where:  { role: "ADMIN" },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId:    admin.id,
          type:      "SUCCESS" as const,
          title:     "Quotation accepted",
          body:      `Customer ${user.fullName ?? user.email} accepted quotation ${doc.docNum}`,
          link:      `/admin/sales/quotations/${doc.id}`,
          eventType: "QUOTATION_ACCEPTED",
        })),
      });
    }
  } catch {
    // Notification failure is non-critical — don't fail the accept
  }

  // Bust customer cache so their docs list refreshes
  await invalidateCustomer(user.id);

  return NextResponse.json({ ok: true, docNum: doc.docNum });
}
