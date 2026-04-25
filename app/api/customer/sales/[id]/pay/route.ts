// app/api/customer/sales/[id]/pay/route.ts
// POST — customer submits a bank transfer payment notification.
// Uploads receipt to S3, creates a SalesDocumentLog entry, notifies admins
// via in-app notification AND email.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { getEmailConfig } from "@/lib/email/email-config";
import { Resend } from "resend";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

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

const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg":      "jpg",
  "image/jpg":       "jpg",
  "image/png":       "png",
};

type Params = { params: Promise<{ id: string }> };

function fmtAmount(cents: number, currency: string) {
  const v = (cents / 100).toFixed(2);
  if (currency === "SAR") return `SAR ${Number(v).toLocaleString("en-SA", { minimumFractionDigits: 2 })}`;
  return `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Verify document belongs to this customer and is an unpaid invoice
    const doc = await prisma.salesDocument.findFirst({
      where: {
        id,
        customerId: user.id,
        type:       "INVOICE",
        status:     { in: ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"] },
      },
      select: {
        id:       true,
        docNum:   true,
        total:    true,
        currency: true,
        market: {
          select: { id: true, key: true, name: true },
        },
      },
    });

    if (!doc) return NextResponse.json({ error: "Invoice not found or already paid" }, { status: 404 });

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

    const amount    = String(form.get("amount")    ?? "").trim();
    const reference = String(form.get("reference") ?? "").trim();
    const date      = String(form.get("date")      ?? "").trim();
    const notes     = String(form.get("notes")     ?? "").trim();
    const receipt   = form.get("receipt") as File | null;

    if (!amount)    return NextResponse.json({ error: "Amount is required" },          { status: 400 });
    if (!date)      return NextResponse.json({ error: "Payment date is required" },    { status: 400 });
    if (!reference) return NextResponse.json({ error: "Reference number is required" },{ status: 400 });

    // Upload receipt if provided
    let receiptKey: string | null = null;
    if (receipt && receipt.size > 0) {
      const ext = ALLOWED[receipt.type];
      if (!ext) return NextResponse.json({ error: "Receipt must be PDF, JPG, or PNG" }, { status: 400 });
      if (receipt.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Receipt too large — max 10 MB" }, { status: 400 });
      const buffer = Buffer.from(await receipt.arrayBuffer());
      receiptKey   = `payment-receipts/${randomUUID()}.${ext}`;
      await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: receiptKey, Body: buffer, ContentType: receipt.type }));
    }

    // Build note stored in the log
    const noteText = [
      `Customer submitted bank transfer notification`,
      `Amount: ${amount} ${doc.currency}`,
      `Date: ${date}`,
      `Reference: ${reference}`,
      notes     ? `Notes: ${notes}`        : null,
      receiptKey ? `Receipt: ${receiptKey}` : null,
    ].filter(Boolean).join("\n");

    // Log the payment notification on the document
    await prisma.salesDocumentLog.create({
      data: {
        documentId:  doc.id,
        field:       "payment_notification",
        oldValue:    null,
        newValue:    receiptKey ?? "no-receipt",
        note:        noteText,
        changedById: user.id,
      },
    });

    // ── In-app notifications for admins ──────────────────────────────────────
    const admins = await prisma.user.findMany({
      where:  { role: "ADMIN" },
      select: { id: true, email: true, fullName: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId:    admin.id,
          type:      "INFO" as const,
          title:     "Payment notification received",
          body:      `${user.fullName ?? user.email} submitted a bank transfer for ${doc.docNum} — ${amount} ${doc.currency} (Ref: ${reference})`,
          link:      `/admin/sales/invoices/${doc.id}`,
          eventType: "PAYMENT_NOTIFICATION",
        })),
      });
    }

    // ── Email notification to admins ─────────────────────────────────────────
    try {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey && admins.length > 0) {
        const emailCfg  = await getEmailConfig("billing", doc.market.key);
        const baseUrl   = process.env.NEXT_PUBLIC_BASE_URL ?? "";
        const adminLink = `${baseUrl}/admin/sales/invoices/${doc.id}`;
        const resend    = new Resend(apiKey);

        // Generate a short-lived signed URL for the receipt if one was uploaded
        let receiptLinkHtml = "";
        if (receiptKey) {
          try {
            const url = await getSignedUrl(
              s3,
              new GetObjectCommand({ Bucket: BUCKET, Key: receiptKey }),
              { expiresIn: 72 * 3600 }, // 72 hours
            );
            receiptLinkHtml = `
              <tr>
                <td style="padding:6px 0;color:#9ca3af;font-size:12px;width:130px;">Receipt</td>
                <td style="padding:6px 0;font-size:12px;">
                  <a href="${url}" style="color:#318774;font-weight:600;">Download Receipt ↗</a>
                  <span style="color:#9ca3af;font-size:11px;margin-left:6px;">(link valid 72 hours)</span>
                </td>
              </tr>`;
          } catch { /* non-critical */ }
        }

        const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e5e7eb;max-width:600px;">

  <!-- Header -->
  <tr><td style="padding:0;border-top:4px solid #318774;">
    <div style="padding:20px 28px;">
      <p style="font-size:18px;font-weight:700;color:#111827;margin:0;">Payment Notification Received</p>
      <p style="font-size:13px;color:#6b7280;margin:4px 0 0;">A customer has submitted a bank transfer notification.</p>
    </div>
  </td></tr>

  <!-- Body -->
  <tr><td style="padding:20px 28px;">

    <!-- Invoice badge -->
    <div style="display:inline-block;padding:6px 14px;background:#f0fdf4;border:1px solid #86efac;margin-bottom:20px;">
      <span style="font-size:13px;font-weight:700;color:#15803d;font-family:monospace;">${doc.docNum}</span>
    </div>

    <!-- Details table -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;margin-bottom:20px;">
      <tr style="background:#f9fafb;">
        <td colspan="2" style="padding:10px 14px;font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">
          Payment Details
        </td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px;width:130px;">Customer</td>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;font-size:12px;font-weight:600;color:#111827;">
          ${user.fullName ?? user.email}
          ${user.fullName ? `<span style="color:#9ca3af;font-weight:400;margin-left:6px;">(${user.email})</span>` : ""}
        </td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px;">Amount</td>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;font-size:14px;font-weight:700;color:#111827;">${amount} ${doc.currency}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px;">Transfer Date</td>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;font-size:12px;color:#111827;">${date}</td>
      </tr>
      <tr>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px;">Reference</td>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;font-size:12px;font-family:monospace;font-weight:600;color:#111827;">${reference}</td>
      </tr>
      ${notes ? `
      <tr>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px;">Notes</td>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;font-size:12px;color:#374151;">${notes}</td>
      </tr>` : ""}
      ${receiptLinkHtml ? `
      <tr>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px;">Receipt</td>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;font-size:12px;">
          ${receiptLinkHtml}
        </td>
      </tr>` : `
      <tr>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;color:#9ca3af;font-size:12px;">Receipt</td>
        <td style="padding:10px 14px;border-top:1px solid #f3f4f6;font-size:12px;color:#9ca3af;font-style:italic;">No receipt uploaded</td>
      </tr>`}
    </table>

    <!-- CTA -->
    <p style="margin:0 0 16px;font-size:13px;color:#374151;">
      Please verify the transfer and record the payment on the invoice:
    </p>
    <a href="${adminLink}"
      style="display:inline-block;padding:12px 24px;background:#318774;color:#fff;font-size:13px;font-weight:700;text-decoration:none;font-family:Arial,sans-serif;">
      View Invoice ${doc.docNum} →
    </a>

  </td></tr>

  <!-- Footer -->
  <tr><td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;">
    <p style="font-size:11px;color:#9ca3af;margin:0;text-align:center;">
      This notification was sent because a customer submitted a payment notification on ${doc.market.name}.
    </p>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

        // Send to all admins
        for (const admin of admins) {
          await resend.emails.send({
            ...emailCfg,
            to:      admin.email,
            subject: `Payment Notification: ${doc.docNum} — ${amount} ${doc.currency} from ${user.fullName ?? user.email}`,
            html,
          }).catch(e => console.error(`[pay/route] email failed for ${admin.email}:`, e.message));
        }
      }
    } catch (emailErr) {
      console.error("[pay/route] email notification failed:", emailErr);
      // Non-critical — don't fail the response
    }

    return NextResponse.json({
      ok: true,
      message: "Payment notification submitted. Our team will verify and update your invoice shortly.",
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
