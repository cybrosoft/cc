// app/api/admin/sales/delivery-notes/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createDocument } from "@/lib/sales/create-document";
import { makeListHandler } from "../shared/list-handler";

export const GET = await makeListHandler("DELIVERY_NOTE");

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

    const { customerId, marketId, lines, subject, referenceNumber,
            notes, internalNote, termsAndConditions, language,
            issueDate, dueDate, originDocId } = body;

    if (!customerId)    return NextResponse.json({ error: "customerId required" }, { status: 400 });
    if (!marketId)      return NextResponse.json({ error: "marketId required" },   { status: 400 });
    if (!lines?.length) return NextResponse.json({ error: "At least one line required" }, { status: 400 });

    const doc = await createDocument({
      type: "DELIVERY_NOTE",
      marketId, customerId,
      createdByAdminId: auth.user.id,
      subject, referenceNumber, notes, internalNote,
      termsAndConditions, language,
      issueDate, dueDate, originDocId,
      lines,
    });

    return NextResponse.json({ ok: true, doc }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
