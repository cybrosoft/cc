// app/api/admin/sales/[id]/send-email/route.ts
// POST — sends document email to customer using market legalInfo for company details.
// Updates emailSentAt + emailSentCount. Auto-advances DRAFT/ISSUED → SENT.
//
// mode:
//   "default"      — send with default template text
//   "resend"       — resend (same as default, subject prefixed with Reminder:)
//   "reminder"     — weekly invoice reminder (invoice unpaid only)
//   "custom"       — custom subject/body/to/cc/bcc
//   "mark_as_sent" — record as sent without sending any email (sets manualSent=true)
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { Resend } from "resend";
import { DOC_TYPE_LABEL, fmtAmount, fmtDate } from "@/lib/sales/document-helpers";

const PERIOD_LABEL: Record<string, string> = {
  MONTHLY: "Monthly", SIX_MONTHS: "6 Months",
  YEARLY: "Yearly",   ONE_TIME: "One-time",
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const body   = await req.json().catch(() => ({}));
    const mode   = (body.mode ?? "default") as "default" | "resend" | "reminder" | "custom" | "mark_as_sent";

    const doc = await prisma.salesDocument.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
        market: {
          select: {
            key: true, name: true, defaultCurrency: true,
            legalInfo: true, companyProfile: true,
            showPayOnline: true, stripePublicKey: true,
          },
        },
        lines:    { orderBy: { sortOrder: "asc" } },
        payments: { orderBy: { paidAt: "desc" } },
      },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // ── Mark as Sent — no email, just record the date ─────────────────────
    if (mode === "mark_as_sent") {
      const now = new Date();
      await prisma.salesDocument.update({
        where: { id },
        data: {
          emailSentAt:    now,
          emailSentCount: { increment: 1 },
          manualSent:     true,
        },
      });

      await prisma.auditLog.create({
        data: {
          actorUserId:  auth.user.id,
          action:       "SALES_DOCUMENT_MARKED_AS_SENT",
          entityType:   "SalesDocument",
          entityId:     id,
          metadataJson: JSON.stringify({ docNum: doc.docNum }),
        },
      });

      return NextResponse.json({
        ok:             true,
        emailSentAt:    now.toISOString(),
        emailSentCount: (doc.emailSentCount ?? 0) + 1,
        manualSent:     true,
      });
    }

    // ── All other modes — actual email send ───────────────────────────────
    const apiKey   = process.env.RESEND_API_KEY;
    const fromAddr = process.env.EMAIL_FROM ?? "noreply@cybrosoft.com";
    if (!apiKey) return NextResponse.json({ error: "Email not configured — RESEND_API_KEY missing" }, { status: 500 });

    // Reminder: invoice-only + unpaid statuses
    if (mode === "reminder") {
      if (doc.type !== "INVOICE") {
        return NextResponse.json({ error: "Reminders are only available for invoices" }, { status: 400 });
      }
      if (!["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(doc.status)) {
        return NextResponse.json({ error: "Reminders can only be sent for unpaid invoices" }, { status: 400 });
      }
    }

    // Pull company details from legalInfo
    const li        = (doc.market.legalInfo  ?? {}) as Record<string, unknown>;
    const cp        = (doc.market.companyProfile ?? {}) as Record<string, unknown>;
    const fromName  = String(li.companyName ?? doc.market.name ?? "Cybrosoft");
    const replyTo   = String(li.email ?? "");
    const typeLabel = DOC_TYPE_LABEL[doc.type] ?? doc.type;
    const isResend  = mode === "resend" || mode === "reminder";
    const currency  = doc.currency;

    // Load default CC/BCC from portal settings
    const [defaultCCSetting, defaultBCCSetting, fromNameSetting] = await Promise.all([
      prisma.portalSetting.findUnique({ where: { key: "email.defaultCC" } }),
      prisma.portalSetting.findUnique({ where: { key: "email.defaultBCC" } }),
      prisma.portalSetting.findUnique({ where: { key: "email.fromName" } }),
    ]);

    // Recipient / CC / BCC
    const toAddr  = (body.to  as string | undefined)?.trim() || doc.customer.email;
    const ccAddr  = (body.cc  as string | undefined)?.trim() || defaultCCSetting?.value  || undefined;
    const bccAddr = (body.bcc as string | undefined)?.trim() || defaultBCCSetting?.value || undefined;

    // Save CC/BCC defaults if requested (custom mode)
    if (body.saveDefaults && mode === "custom") {
      const ops: Promise<any>[] = [];
      if (body.cc !== undefined) {
        ops.push(prisma.portalSetting.upsert({
          where:  { key: "email.defaultCC" },
          update: { value: (body.cc as string).trim() },
          create: { key: "email.defaultCC", value: (body.cc as string).trim() },
        }));
      }
      if (body.bcc !== undefined) {
        ops.push(prisma.portalSetting.upsert({
          where:  { key: "email.defaultBCC" },
          update: { value: (body.bcc as string).trim() },
          create: { key: "email.defaultBCC", value: (body.bcc as string).trim() },
        }));
      }
      await Promise.all(ops);
    }

    // Totals
    const totalPaid  = doc.payments.reduce((s, p) => s + p.amountCents, 0);
    const balanceDue = doc.total - totalPaid;

    // Bank details block
    const bd       = li.bankDetails as Record<string, unknown> | undefined;
    const showBank = (doc.type === "PROFORMA" || doc.type === "INVOICE") && bd?.iban;
    const bankHtml = showBank ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
        <tr><td style="padding:12px;background:#f9fafb;border:1px solid #e5e7eb;">
          <p style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 8px;">Bank Details</p>
          <table cellpadding="0" cellspacing="0">
            ${bd?.bankName    ? `<tr><td style="font-size:11px;color:#9ca3af;padding:1px 12px 1px 0;">Bank</td><td style="font-size:11px;font-family:monospace;">${bd.bankName}</td></tr>` : ""}
            ${bd?.accountName ? `<tr><td style="font-size:11px;color:#9ca3af;padding:1px 12px 1px 0;">Account</td><td style="font-size:11px;font-family:monospace;">${bd.accountName}</td></tr>` : ""}
            ${bd?.iban        ? `<tr><td style="font-size:11px;color:#9ca3af;padding:1px 12px 1px 0;">IBAN</td><td style="font-size:11px;font-family:monospace;">${bd.iban}</td></tr>` : ""}
            ${bd?.swift       ? `<tr><td style="font-size:11px;color:#9ca3af;padding:1px 12px 1px 0;">SWIFT</td><td style="font-size:11px;font-family:monospace;">${bd.swift}</td></tr>` : ""}
          </table>
        </td></tr>
      </table>` : "";

    // Line items HTML
    const linesHtml = doc.lines.map(l => `
      <tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:8px 12px;font-size:13px;">${l.description}${l.billingPeriod ? `<br><span style="font-size:10px;color:#9ca3af;">${PERIOD_LABEL[l.billingPeriod] ?? l.billingPeriod}</span>` : ""}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:center;">${Number(l.quantity)}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:right;">${fmtAmount(l.unitPrice, currency)}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:right;">${Number(l.discount) > 0 ? Number(l.discount) + "%" : "—"}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:right;font-weight:600;">${fmtAmount(l.lineTotal, currency)}</td>
      </tr>`).join("");

    // Subject
    const subject =
      mode === "custom" && body.customSubject
        ? (body.customSubject as string).trim()
        : isResend
          ? `Reminder: ${typeLabel} ${doc.docNum} — ${fmtAmount(balanceDue > 0 ? balanceDue : doc.total, currency)}`
          : `${typeLabel} ${doc.docNum} from ${fromName}`;

    // Opening body paragraph
    const openingPara =
      mode === "custom" && body.customBody
        ? (body.customBody as string).trim()
        : isResend
          ? `This is a friendly reminder that <strong>${typeLabel} ${doc.docNum}</strong> remains outstanding.`
          : `Please find your <strong>${typeLabel} ${doc.docNum}</strong> below.`;

    // Pay online button
    const payOnline = doc.market.showPayOnline && doc.market.stripePublicKey && balanceDue > 0;
    const baseUrl   = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    const payButtonHtml = (doc.type === "INVOICE" && payOnline) ? `
      <tr><td style="padding:0 32px 20px;text-align:center;">
        <a href="${baseUrl}/dashboard/invoices/${doc.docNum}/pay"
          style="display:inline-block;background:#318774;color:#fff;padding:12px 32px;font-size:14px;font-weight:700;text-decoration:none;">
          Pay Online — ${fmtAmount(balanceDue, currency)}
        </a>
        <p style="font-size:10px;color:#9ca3af;margin:6px 0 0;">Secure payment via Stripe · Credit / Debit card accepted</p>
      </td></tr>` : "";

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;max-width:600px;width:100%;">

    <!-- Header -->
    <tr><td style="background:#222;padding:20px 32px;">
      ${cp.logoUrl ? `<img src="${cp.logoUrl}" alt="${fromName}" style="max-height:36px;max-width:160px;object-fit:contain;" />` : ""}
      <p style="font-size:18px;font-weight:700;color:#fff;margin:${cp.logoUrl ? "8px" : "0"} 0 0;">${fromName}</p>
      ${li.tagline ? `<p style="font-size:12px;color:#9ca3af;margin:2px 0 0;">${li.tagline}</p>` : ""}
    </td></tr>

    <!-- Document header -->
    <tr><td style="padding:24px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td>
            <p style="font-size:11px;font-weight:700;color:#6b7280;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 4px;">${typeLabel}</p>
            <p style="font-size:22px;font-weight:700;font-family:monospace;color:#318774;margin:0;">${doc.docNum}</p>
          </td>
          <td style="text-align:right;">
            <p style="font-size:12px;color:#6b7280;margin:0;">Issued: ${fmtDate(doc.issueDate.toString())}</p>
            ${doc.dueDate ? `<p style="font-size:12px;color:#b45309;font-weight:600;margin:4px 0 0;">Due: ${fmtDate(doc.dueDate.toString())}</p>` : ""}
          </td>
        </tr>
      </table>
      ${doc.subject ? `<p style="font-size:13px;color:#374151;margin:12px 0 0;padding:10px 14px;background:#f9fafb;border-left:3px solid #318774;">${doc.subject}</p>` : ""}
    </td></tr>

    <!-- Reminder badge -->
    ${mode === "reminder" ? `
    <tr><td style="padding:16px 32px 0;">
      <div style="background:#fffbeb;border:1px solid #fcd34d;padding:10px 16px;font-size:12px;color:#92400e;">
        <strong>Payment Reminder ${(doc.reminderCount ?? 0) + 1} of 4</strong>
        ${(doc as any).reminderLastSentAt ? ` — Last sent: ${fmtDate((doc as any).reminderLastSentAt.toString())}` : ""}
      </div>
    </td></tr>` : ""}

    <!-- Body -->
    <tr><td style="padding:20px 32px;">
      <p style="font-size:14px;color:#374151;">Dear ${doc.customer.fullName ?? doc.customer.email},</p>
      <p style="font-size:13px;color:#374151;line-height:1.6;">${openingPara}</p>

      <!-- Line items -->
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;margin:16px 0;">
        <thead>
          <tr style="background:#318774;">
            <th style="padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em;">Description</th>
            <th style="padding:8px 12px;text-align:center;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em;">Qty</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em;">Unit Price</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em;">Disc</th>
            <th style="padding:8px 12px;text-align:right;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.05em;">Total</th>
          </tr>
        </thead>
        <tbody>${linesHtml}</tbody>
        <tfoot>
          <tr><td colspan="4" style="padding:6px 12px;text-align:right;font-size:12px;color:#6b7280;">Subtotal</td>
              <td style="padding:6px 12px;text-align:right;font-size:12px;">${fmtAmount(doc.subtotal, currency)}</td></tr>
          ${Number(doc.vatPercent) > 0
            ? `<tr><td colspan="4" style="padding:6px 12px;text-align:right;font-size:12px;color:#6b7280;">VAT (${Number(doc.vatPercent)}%)</td>
               <td style="padding:6px 12px;text-align:right;font-size:12px;">${fmtAmount(doc.vatAmount, currency)}</td></tr>`
            : ""}
          <tr style="background:#f9fafb;">
            <td colspan="4" style="padding:10px 12px;text-align:right;font-size:14px;font-weight:700;">Total</td>
            <td style="padding:10px 12px;text-align:right;font-size:14px;font-weight:700;color:#318774;">${fmtAmount(doc.total, currency)}</td>
          </tr>
          ${totalPaid > 0
            ? `<tr><td colspan="4" style="padding:6px 12px;text-align:right;font-size:12px;color:#15803d;">Paid</td>
               <td style="padding:6px 12px;text-align:right;font-size:12px;color:#15803d;">− ${fmtAmount(totalPaid, currency)}</td></tr>`
            : ""}
          ${balanceDue > 0 && totalPaid > 0
            ? `<tr style="background:#fef9c3;">
               <td colspan="4" style="padding:10px 12px;text-align:right;font-size:14px;font-weight:700;color:#92400e;">Balance Due</td>
               <td style="padding:10px 12px;text-align:right;font-size:14px;font-weight:700;color:#92400e;">${fmtAmount(balanceDue, currency)}</td>
               </tr>`
            : ""}
        </tfoot>
      </table>

      ${doc.notes ? `<p style="font-size:12px;color:#6b7280;margin:8px 0 0;padding:10px 14px;background:#f9fafb;border-left:2px solid #d1d5db;">${doc.notes}</p>` : ""}
      ${bankHtml}
    </td></tr>

    ${payButtonHtml}

    <!-- Footer -->
    <tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="font-size:11px;color:#9ca3af;text-align:center;margin:0;">
        ${li.footerText ?? `${fromName}${li.email ? ` · ${li.email}` : ""}`}
      </p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;

    // Send via Resend
    const resend = new Resend(apiKey);

    const { error: sendError } = await resend.emails.send({
      from:    `${fromNameSetting?.value ?? fromName} <${fromAddr}>`,
      to:      toAddr,
      subject,
      html,
      ...(ccAddr  ? { cc:  ccAddr }  : {}),
      ...(bccAddr ? { bcc: bccAddr } : {}),
      ...(replyTo ? { replyTo }      : {}),
    });

    if (sendError) {
      console.error("[send-email] Resend error:", sendError);
      return NextResponse.json({ error: sendError.message }, { status: 500 });
    }

    // Update email tracking + clear manualSent (real email was sent)
    const updateData: Record<string, any> = {
      emailSentAt:    new Date(),
      emailSentCount: { increment: 1 },
      manualSent:     false,
    };

    if (mode === "reminder") {
      updateData.reminderCount      = { increment: 1 };
      updateData.reminderLastSentAt = new Date();
    }

    // Auto-advance status
    if (doc.status === "DRAFT")  updateData.status = "ISSUED";
    if (doc.status === "ISSUED") updateData.status = "SENT";

    await prisma.salesDocument.update({ where: { id }, data: updateData });

    await prisma.auditLog.create({
      data: {
        actorUserId:  auth.user.id,
        action:       "SALES_DOCUMENT_EMAIL_SENT",
        entityType:   "SalesDocument",
        entityId:     id,
        metadataJson: JSON.stringify({
          docNum: doc.docNum, mode,
          to: toAddr, cc: ccAddr ?? null, bcc: bccAddr ?? null,
          subject,
        }),
      },
    });

    return NextResponse.json({
      ok:             true,
      emailSentAt:    new Date().toISOString(),
      emailSentCount: (doc.emailSentCount ?? 0) + 1,
      manualSent:     false,
      reminderCount:  mode === "reminder" ? (doc.reminderCount ?? 0) + 1 : undefined,
    });

  } catch (e: any) {
    console.error("[send-email] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}