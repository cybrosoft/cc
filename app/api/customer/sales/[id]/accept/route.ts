// app/api/customer/sales/[id]/accept/route.ts
// Customer accepts a quotation.
// Sets status → ACCEPTED, optionally uploads PO file to S3, emails admin.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { invalidateCustomer } from "@/lib/cache/customer-cache";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { Resend } from "resend";
import { getEmailConfig } from "@/lib/email/email-config";

const s3 = new S3Client({
  region:   process.env.SUPABASE_S3_REGION!,
  endpoint: process.env.SUPABASE_S3_ENDPOINT!,
  credentials: {
    accessKeyId:     process.env.SUPABASE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.SUPABASE_S3_BUCKET ?? "uploads";

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png":       "png",
  "image/jpeg":      "jpg",
  "image/jpg":       "jpg",
};

export async function POST(
  req: NextRequest,
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
    select: {
      id: true, docNum: true, status: true,
      market: { select: { id: true, key: true } },
    },
  });

  if (!doc) {
    return NextResponse.json(
      { error: "Quotation not found or not in an acceptable state" },
      { status: 404 }
    );
  }

  // ── Optional PO file upload ───────────────────────────────────────────────
  let poFileKey: string | null = null;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    const file = form?.get("poFile");
    if (file instanceof File && file.size > 0) {
      const ext = ALLOWED_TYPES[file.type];
      if (!ext) return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
      if (file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "File too large — max 10 MB" }, { status: 400 });

      const buffer = Buffer.from(await file.arrayBuffer());
      poFileKey = `sales/po/${randomUUID()}.${ext}`;

      await s3.send(new PutObjectCommand({
        Bucket:      BUCKET,
        Key:         poFileKey,
        Body:        buffer,
        ContentType: file.type,
      }));
    }
  }

  // ── Update status + log ───────────────────────────────────────────────────
  await prisma.$transaction([
    prisma.salesDocument.update({
      where: { id: doc.id },
      data: {
        status:    "ACCEPTED",
        updatedAt: new Date(),
        ...(poFileKey ? { rfqFileUrl: poFileKey } : {}),
      },
    }),
    prisma.salesDocumentLog.create({
      data: {
        documentId:  doc.id,
        field:       "status",
        oldValue:    String(doc.status),
        newValue:    "ACCEPTED",
        note:        poFileKey
          ? "Accepted by customer via portal with PO attachment"
          : "Accepted by customer via portal",
        changedById: user.id,
      },
    }),
  ]);

  // ── Notify admins (in-app) ────────────────────────────────────────────────
  try {
    const admins = await prisma.user.findMany({
      where:  { role: "ADMIN" },
      select: { id: true, email: true, fullName: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId:    admin.id,
          type:      "SUCCESS" as const,
          title:     "Quotation accepted",
          body:      `${user.fullName ?? user.email} accepted quotation ${doc.docNum}${poFileKey ? " with PO attachment" : ""}`,
          link:      `/admin/sales/quotations/${doc.id}`,
          eventType: "QUOTATION_ACCEPTED",
        })),
      });

      // ── Email admins ──────────────────────────────────────────────────────
      try {
        const resend    = new Resend(process.env.RESEND_API_KEY!);
        const emailConf = await getEmailConfig("sales", doc.market.id);
        const customerName = user.fullName ?? user.email;

        await resend.emails.send({
          from:    emailConf.from,
          to:      admins.map(a => a.email),
          subject: `Quotation Accepted — ${doc.docNum}`,
          html: `
            <div style="font-family:Arial,sans-serif;font-size:14px;color:#111827;max-width:560px;margin:0 auto">
              <h2 style="font-size:18px;font-weight:700;margin:0 0 16px">Quotation Accepted</h2>
              <p style="margin:0 0 12px">
                <strong>${customerName}</strong> has accepted quotation <strong>${doc.docNum}</strong>.
              </p>
              ${poFileKey ? `<p style="margin:0 0 12px;padding:10px 14px;background:#f0fdf4;border:1px solid #86efac;color:#15803d;">
                A PO file was attached by the customer.
              </p>` : ""}
              <p style="margin:0 0 20px">Please review and proceed with the next steps.</p>
              <a href="${process.env.NEXT_PUBLIC_BASE_URL}/admin/sales/quotations/${doc.id}"
                style="display:inline-block;padding:10px 20px;background:#318774;color:#fff;text-decoration:none;font-weight:600;font-size:13px;">
                View Quotation →
              </a>
            </div>
          `,
        });
      } catch { /* email failure is non-critical */ }
    }
  } catch { /* notification failure is non-critical */ }

  await invalidateCustomer(user.id);

  return NextResponse.json({ ok: true, docNum: doc.docNum, poAttached: !!poFileKey });
}
