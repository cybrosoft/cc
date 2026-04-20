// app/api/admin/users/[id]/status/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { Resend } from "resend";

const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING:       ["ACTIVE", "REJECTED", "INFO_REQUIRED"],
  INFO_REQUIRED: ["ACTIVE", "REJECTED", "SUSPENDED"],
  ACTIVE:        ["SUSPENDED", "INFO_REQUIRED"],
  SUSPENDED:     ["ACTIVE"],
  REJECTED:      ["ACTIVE"],
};

function buildEmail(opts: {
  action: string;
  customerName: string;
  customerEmail: string;
  companyName: string | null;
  fromName: string;
  fromEmail: string;
  reason?: string;
  message?: string;
  baseUrl: string;
}): { subject: string; html: string } {
  const { action, customerName, companyName, fromName, reason, message, baseUrl } = opts;
  const name = companyName ?? customerName ?? opts.customerEmail;

  const configs: Record<string, { subject: string; heading: string; color: string; body: string; showLogin: boolean }> = {
    ACTIVE: {
      subject: `Your Cybrosoft account has been approved`,
      heading: "Account Approved",
      color:   "#318774",
      body:    `We are pleased to inform you that your Cybrosoft Console account has been reviewed and approved. You now have full access to our cloud services platform.`,
      showLogin: true,
    },
    REJECTED: {
      subject: `Update on your Cybrosoft account application`,
      heading: "Account Application Update",
      color:   "#dc2626",
      body:    `Thank you for your interest in Cybrosoft Console. After reviewing your application, we are unable to approve your account at this time.${reason ? `<br><br><strong>Reason:</strong> ${reason}` : ""}`,
      showLogin: false,
    },
    INFO_REQUIRED: {
      subject: `Action required: Additional information needed for your Cybrosoft account`,
      heading: "Additional Information Required",
      color:   "#b45309",
      body:    `We are reviewing your Cybrosoft Console account and require some additional information before we can proceed.${message ? `<br><br><strong>Details:</strong> ${message}` : "<br><br>Please reply to this email or contact our support team with the required information."}`,
      showLogin: true,
    },
    SUSPENDED: {
      subject: `Your Cybrosoft account has been suspended`,
      heading: "Account Suspended",
      color:   "#dc2626",
      body:    `Your Cybrosoft Console account has been temporarily suspended.${reason ? `<br><br><strong>Reason:</strong> ${reason}` : ""}<br><br>Please contact our support team if you have any questions.`,
      showLogin: false,
    },
  };

  const cfg = configs[action];
  if (!cfg) throw new Error(`No email config for action: ${action}`);

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
  <tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;max-width:600px;width:100%;">

    <!-- Header -->
    <tr><td style="background:#0d1f1c;padding:20px 32px;">
      <p style="font-size:18px;font-weight:700;color:#fff;margin:0;letter-spacing:-0.02em;">Cybrosoft <span style="color:#318774;">Console</span></p>
      <p style="font-size:12px;color:rgba(255,255,255,0.4);margin:2px 0 0;">Cloud Services Management Platform</p>
    </td></tr>

    <!-- Status bar -->
    <tr><td style="background:${cfg.color};padding:12px 32px;">
      <p style="font-size:13px;font-weight:700;color:#fff;margin:0;letter-spacing:0.02em;">${cfg.heading}</p>
    </td></tr>

    <!-- Body -->
    <tr><td style="padding:32px;">
      <p style="font-size:14px;color:#374151;margin:0 0 16px;">Dear ${name},</p>
      <p style="font-size:13px;color:#374151;line-height:1.7;margin:0 0 20px;">${cfg.body}</p>

      ${cfg.showLogin ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
        <tr><td style="padding:16px;background:#f9fafb;border:1px solid #e5e7eb;border-left:3px solid ${cfg.color};">
          <p style="font-size:13px;color:#374151;margin:0;">
            You can access your account at:<br>
            <a href="${baseUrl}/login" style="color:${cfg.color};font-weight:600;text-decoration:none;">${baseUrl}/login</a>
          </p>
        </td></tr>
      </table>` : ""}

      <p style="font-size:13px;color:#374151;margin:0;">
        If you have any questions, please don't hesitate to contact our support team.
      </p>
      <p style="font-size:13px;color:#374151;margin:16px 0 0;">
        Best regards,<br>
        <strong>${fromName}</strong>
      </p>
    </td></tr>

    <!-- Footer -->
    <tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="font-size:11px;color:#9ca3af;text-align:center;margin:0;">
        This is an automated message from Cybrosoft Console. Please do not reply to this email directly.
      </p>
    </td></tr>

  </table>
  </td></tr>
</table>
</body>
</html>`;

  return { subject: cfg.subject, html };
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const body   = await req.json().catch(() => ({}));
    const action = body.action as string;   // new status: ACTIVE, REJECTED, INFO_REQUIRED, SUSPENDED
    const reason  = (body.reason  as string | undefined)?.trim() || undefined;
    const message = (body.message as string | undefined)?.trim() || undefined;

    if (!action) return NextResponse.json({ error: "action is required" }, { status: 400 });

    // Load customer
    const customer = await prisma.user.findUnique({
      where:  { id },
      select: {
        id: true, email: true, fullName: true, companyName: true,
        status: true,
        market: { select: { key: true, name: true, legalInfo: true } },
      },
    });

    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const currentStatus = customer.status as string;
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];

    if (!allowed.includes(action)) {
      return NextResponse.json({
        error: `Cannot transition from ${currentStatus} to ${action}`,
      }, { status: 400 });
    }

    // Update status
    await prisma.user.update({
      where: { id },
      data:  { status: action as any },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorUserId:  auth.user.id,
        action:       `CUSTOMER_STATUS_${action}`,
        entityType:   "User",
        entityId:     id,
        metadataJson: JSON.stringify({ from: currentStatus, to: action, reason, message }),
      },
    });

    // Send email
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey && ["ACTIVE", "REJECTED", "INFO_REQUIRED", "SUSPENDED"].includes(action)) {
      try {
        const { getEmailConfig } = await import("@/lib/email/email-config");
        const emailCfg = await getEmailConfig("support", customer.market?.key ?? "global");
        const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "https://console.cybrosoft.com";

        // Extract display name from emailCfg.from e.g. "Cybrosoft Support SA <support@...>"
        const fromName = emailCfg.from.split(" <")[0] || "Cybrosoft";

        const { subject, html } = buildEmail({
          action,
          customerName:  customer.fullName ?? "",
          customerEmail: customer.email,
          companyName:   customer.companyName,
          fromName,
          fromEmail:     emailCfg.from,
          reason,
          message,
          baseUrl,
        });

        const resend = new Resend(apiKey);
        await resend.emails.send({
          ...emailCfg,
          to:      customer.email,
          subject,
          html,
        });
      } catch (emailErr) {
        console.error("[status] email send failed:", emailErr);
        // Don't fail the status change if email fails
      }
    }

    return NextResponse.json({ ok: true, status: action });

  } catch (e: any) {
    console.error("[status route] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
