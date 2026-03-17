// app/api/admin/sales/[id]/send-email/route.ts
// POST — send document email to customer and update emailSentAt + emailSentCount
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { Resend } from "resend";

const TYPE_LABEL: Record<string, string> = {
  RFQ: "RFQ", QUOTATION: "Quotation", PO: "Purchase Order",
  DELIVERY_NOTE: "Delivery Note", PROFORMA: "Proforma Invoice",
  INVOICE: "Invoice", CREDIT_NOTE: "Credit Note",
};

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const doc = await prisma.salesDocument.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
        market:   { select: { key: true, name: true, defaultCurrency: true } },
        lines:    { orderBy: { sortOrder: "asc" } },
      },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    const apiKey   = process.env.RESEND_API_KEY;
    const fromAddr = process.env.EMAIL_FROM ?? "noreply@cybrosoft.com";

    if (!apiKey) return NextResponse.json({ error: "Email not configured — RESEND_API_KEY missing" }, { status: 500 });

    // Load portal settings for branding
    const [nameSetting, fromNameSetting, replyToSetting] = await Promise.all([
      prisma.portalSetting.findUnique({ where: { key: "portal.name" } }),
      prisma.portalSetting.findUnique({ where: { key: "email.fromName" } }),
      prisma.portalSetting.findUnique({ where: { key: "email.replyTo" } }),
    ]);

    const portalName = nameSetting?.value    ?? "Cybrosoft Cloud Console";
    const fromName   = fromNameSetting?.value ?? portalName;
    const replyTo    = replyToSetting?.value  ?? undefined;
    const typeLabel  = TYPE_LABEL[doc.type]   ?? doc.type;
    const isResend   = (doc.emailSentCount ?? 0) > 0;
    const currency   = doc.currency;

    // Format amounts
    const fmt = (cents: number) => {
      const v = (cents / 100).toFixed(2);
      return currency === "SAR" ? `SAR ${v}` : `$${v}`;
    };

    // Build line items HTML
    const linesHtml = doc.lines.map(l => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">${l.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:center;">${Number(l.quantity)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;">${fmt(l.unitPrice)}</td>
        ${Number(l.discount) > 0 ? `<td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;">${Number(l.discount)}%</td>` : '<td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;">—</td>'}
        <td style="padding:8px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;font-weight:600;">${fmt(l.lineTotal)}</td>
      </tr>
    `).join("");

    const vatPct = Number(doc.vatPercent ?? 0);
    const vatHtml = vatPct > 0
      ? `<tr><td colspan="4" style="padding:6px 12px;text-align:right;font-size:13px;color:#6b7280;">VAT (${vatPct}%)</td><td style="padding:6px 12px;text-align:right;font-size:13px;">${fmt(doc.vatAmount)}</td></tr>`
      : "";

    const subject = isResend
      ? `Reminder: ${typeLabel} ${doc.docNum} — ${fmt(doc.total)}`
      : `${typeLabel} ${doc.docNum} from ${portalName}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;max-width:600px;width:100%;">
      <!-- Header -->
      <tr><td style="background:#222;padding:20px 32px;">
        <span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.02em;">${portalName}</span>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:32px;color:#374151;font-size:14px;line-height:1.7;">
        <p>Dear ${doc.customer.fullName ?? doc.customer.email},</p>
        ${isResend
          ? `<p>This is a reminder for <strong>${typeLabel} ${doc.docNum}</strong>.</p>`
          : `<p>Please find your <strong>${typeLabel} ${doc.docNum}</strong> below.</p>`
        }
        ${doc.subject ? `<p><strong>${doc.subject}</strong></p>` : ""}
        ${doc.dueDate ? `<p>Due date: <strong>${new Date(doc.dueDate).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}</strong></p>` : ""}

        <!-- Line items table -->
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;margin:20px 0;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Description</th>
              <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Qty</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Unit Price</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Disc</th>
              <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.04em;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${linesHtml}
            <tr><td colspan="4" style="padding:8px 12px;text-align:right;font-size:13px;color:#6b7280;">Subtotal</td><td style="padding:8px 12px;text-align:right;font-size:13px;">${fmt(doc.subtotal)}</td></tr>
            ${vatHtml}
            <tr style="background:#f9fafb;"><td colspan="4" style="padding:10px 12px;text-align:right;font-size:14px;font-weight:700;">Total</td><td style="padding:10px 12px;text-align:right;font-size:14px;font-weight:700;color:#318774;">${fmt(doc.total)}</td></tr>
          </tbody>
        </table>

        ${doc.notes ? `<p style="color:#6b7280;font-size:13px;">${doc.notes}</p>` : ""}
        <p>If you have any questions, please don't hesitate to contact us.</p>
        <p>Best regards,<br/><strong>${portalName}</strong></p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="padding:16px 32px;color:#9ca3af;font-size:12px;border-top:1px solid #e5e7eb;">
        <p style="margin:0;">This email was sent by <strong>${portalName}</strong>.</p>
        <p style="margin:4px 0 0;">Document reference: ${doc.docNum}</p>
      </td></tr>
      <tr><td style="background:#318774;height:4px;"></td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

    const resend = new Resend(apiKey);
    const { error: sendError } = await resend.emails.send({
      from:    `${fromName} <${fromAddr}>`,
      to:      doc.customer.email,
      subject,
      html,
      ...(replyTo ? { replyTo } : {}),
    });

    if (sendError) {
      return NextResponse.json({ error: sendError.message }, { status: 500 });
    }

    // Update emailSentAt and increment emailSentCount
    const updated = await prisma.salesDocument.update({
      where: { id },
      data: {
        emailSentAt:    new Date(),
        emailSentCount: { increment: 1 },
        // Auto-advance DRAFT to SENT when first email is sent
        ...(doc.status === "DRAFT" ? { status: "SENT" } : {}),
      },
      select: {
        id: true, status: true,
        emailSentAt: true, emailSentCount: true,
      },
    });

    return NextResponse.json({ ok: true, doc: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
