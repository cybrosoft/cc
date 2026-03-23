// app/api/admin/sales/[id]/status/route.ts
// PATCH — update document status with validation + audit log.
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { VALID_STATUSES } from "@/lib/sales/document-helpers";
import { SalesDocumentStatus } from "@prisma/client";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const body      = await req.json().catch(() => null);
    const newStatus: SalesDocumentStatus = body?.status;
    const note: string = body?.note?.trim() ?? "";

    if (!newStatus) return NextResponse.json({ error: "status required" }, { status: 400 });

    const doc = await prisma.salesDocument.findUnique({
      where:  { id },
      select: { id: true, type: true, status: true, docNum: true },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const validForType = VALID_STATUSES[doc.type] ?? [];
    if (!validForType.includes(newStatus)) {
      return NextResponse.json({
        error: `Status "${newStatus}" is not valid for ${doc.type}. Valid: ${validForType.join(", ")}`,
      }, { status: 400 });
    }

    // Update status + write log in a transaction
    const [updated] = await prisma.$transaction([
      prisma.salesDocument.update({
        where: { id },
        data:  { status: newStatus },
        select: { id: true, docNum: true, status: true, updatedAt: true },
      }),
      prisma.salesDocumentLog.create({
        data: {
          documentId:  id,
          field:       "status",
          oldValue:    doc.status,
          newValue:    newStatus,
          note:        note || null,
          changedById: auth.user.id,
        },
      }),
    ]);

    // Also write to auditLog for system-wide audit trail
    await prisma.auditLog.create({
      data: {
        actorUserId:  auth.user.id,
        action:       "SALES_DOCUMENT_STATUS_CHANGED",
        entityType:   "SalesDocument",
        entityId:     id,
        metadataJson: JSON.stringify({
          docNum: doc.docNum,
          from:   doc.status,
          to:     newStatus,
          note,
        }),
      },
    }).catch(() => { /* auditLog is best-effort */ });

    return NextResponse.json({ ok: true, doc: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
