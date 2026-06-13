// app/api/admin/subscriptions/update-invoicing/route.ts
// Updates invoicingMode and/or invoiceMetaJson on a subscription.
// Also enforces: MANUAL mode locks autoRenew to false.
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { InvoicingMode }  from "@prisma/client";

function s(v: unknown): string { return typeof v === "string" ? v : ""; }

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    subscriptionId?:  unknown;
    invoicingMode?:   unknown; // "AUTO" | "MANUAL"
    linkedDocNum?:    unknown; // docNum of manually linked invoice
    selectedLineIds?: unknown; // string[] — selected line IDs from that invoice
  } | null;

  const subscriptionId = s(body?.subscriptionId).trim();
  if (!subscriptionId)
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_ID_REQUIRED" }, { status: 400 });

  const sub = await prisma.subscription.findUnique({
    where:  { id: subscriptionId },
    select: { id: true, invoicingMode: true, autoRenew: true },
  });
  if (!sub)
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const updateData: Record<string, unknown> = {};

  // ── Update invoicingMode ──────────────────────────────────────────────────
  const modeRaw = s(body?.invoicingMode).trim().toUpperCase();
  if (modeRaw === "AUTO" || modeRaw === "MANUAL") {
    updateData.invoicingMode = modeRaw as InvoicingMode;
    // MANUAL mode locks autoRenew off
    if (modeRaw === "MANUAL") updateData.autoRenew = false;
  }

  // ── Update invoiceMetaJson ────────────────────────────────────────────────
  const linkedDocNum    = s(body?.linkedDocNum).trim().toUpperCase() || null;
  const selectedLineIds = Array.isArray(body?.selectedLineIds)
    ? (body.selectedLineIds as unknown[]).filter(x => typeof x === "string") as string[]
    : null;

  if (linkedDocNum !== null || selectedLineIds !== null) {
    // Validate the invoice exists if docNum provided
    if (linkedDocNum) {
      const doc = await prisma.salesDocument.findUnique({
        where:  { docNum: linkedDocNum },
        select: { id: true },
      });
      if (!doc)
        return NextResponse.json({ ok: false, error: "INVOICE_NOT_FOUND" }, { status: 404 });
    }

    updateData.invoiceMetaJson = JSON.stringify({
      linkedDocNum:    linkedDocNum ?? null,
      selectedLineIds: selectedLineIds ?? [],
    });
  }

  if (Object.keys(updateData).length === 0)
    return NextResponse.json({ ok: false, error: "NOTHING_TO_UPDATE" }, { status: 400 });

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data:  updateData as never,
  });

  return NextResponse.json({ ok: true });
}
