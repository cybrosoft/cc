// app/api/admin/subscriptions/upload-receipt/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import path from "path";
import fs from "fs/promises";

function safeExtFromMime(mime: string): string | null {
  const m = mime.toLowerCase();
  if (m === "application/pdf") return "pdf";
  if (m === "image/png") return "png";
  if (m === "image/jpeg") return "jpg";
  return null;
}

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "BAD_FORM" }, { status: 400 });

  const subscriptionId = String(form.get("subscriptionId") ?? "").trim();
  const file = form.get("file");

  if (!subscriptionId) {
    return NextResponse.json({ ok: false, error: "SUBSCRIPTION_ID_REQUIRED" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "FILE_REQUIRED" }, { status: 400 });
  }

  const ext = safeExtFromMime(file.type);
  if (!ext) {
    return NextResponse.json({ ok: false, error: "UNSUPPORTED_FILE_TYPE" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // ✅ store under public so it is served by Next static hosting
  // public/uploads/receipts/<subscriptionId>/<timestamp>.<ext>
  const ts = Date.now();
  const relDir = path.posix.join("uploads", "receipts", subscriptionId);
  const relName = `${ts}.${ext}`;
  const relPath = path.posix.join(relDir, relName);

  const absPath = path.join(process.cwd(), "public", relPath);
  const absDir = path.dirname(absPath);

  await fs.mkdir(absDir, { recursive: true });
  await fs.writeFile(absPath, buf);

  const receiptUrl = `/${relPath}`;

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { receiptUrl },
  });

  return NextResponse.json({ ok: true, receiptUrl });
}