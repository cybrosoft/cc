// app/api/admin/sales/[id]/reminder/route.ts
// PATCH — enable or disable weekly invoice reminders.
//
// Body: { enabled: boolean }
//   enabled: true  — turn on weekly reminders (resets count to 0)
//   enabled: false — stop all future reminders
//
// The daily cron job reads reminderEnabled + reminderCount + reminderLastSentAt
// and fires the reminder email once per week up to 4 times.

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id }   = await context.params;
    const body     = await req.json().catch(() => ({}));
    const enabled  = Boolean(body.enabled);

    const doc = await prisma.salesDocument.findUnique({
      where:  { id },
      select: { id: true, type: true, status: true, docNum: true, reminderEnabled: true, reminderCount: true },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    if (doc.type !== "INVOICE") {
      return NextResponse.json({ error: "Reminders are only available for invoices" }, { status: 400 });
    }

    if (enabled && !["ISSUED", "SENT", "PARTIAL", "OVERDUE"].includes(doc.status)) {
      return NextResponse.json({
        error: "Reminders can only be enabled for unpaid invoices (ISSUED, SENT, PARTIAL, OVERDUE)",
      }, { status: 400 });
    }

    const updated = await prisma.salesDocument.update({
      where: { id },
      data: {
        reminderEnabled: enabled,
        // Reset count when re-enabling so the 4-week window restarts
        ...(enabled ? { reminderCount: 0, reminderLastSentAt: null } : {}),
      },
      select: {
        id: true, docNum: true,
        reminderEnabled: true, reminderCount: true, reminderLastSentAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId:  auth.user.id,
        action:       enabled ? "INVOICE_REMINDER_ENABLED" : "INVOICE_REMINDER_DISABLED",
        entityType:   "SalesDocument",
        entityId:     id,
        metadataJson: JSON.stringify({ docNum: doc.docNum, enabled }),
      },
    });

    return NextResponse.json({ ok: true, doc: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
