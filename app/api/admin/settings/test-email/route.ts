// app/api/admin/settings/test-email/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const TYPE_LABELS: Record<string, string> = {
  auth:          "Authentication",
  support:       "Support & Account",
  sales:         "Sales",
  billing:       "Billing",
  notifications: "Notifications",
};

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { to, emailType = "auth" } = await req.json();
    if (!to) return NextResponse.json({ error: "Recipient email required" }, { status: 400 });

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return NextResponse.json({ ok: false, error: "RESEND_API_KEY is not set." }, { status: 400 });

    // Load settings
    const rows = await prisma.portalSetting.findMany({ orderBy: { key: "asc" } });
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;

    const portalName = settings["portal.name"]      ?? "Cybrosoft Cloud Console";
    const fromName   = settings["email.fromName"]   ?? portalName;
    const fromAddr   = settings[`email.${emailType}`] || process.env.EMAIL_FROM || "noreply@cybrosoft.com";
    const bcc        = settings[`email.${emailType}.bcc`]     || undefined;
    const replyTo    = settings[`email.${emailType}.replyTo`] || undefined;

    const typeLabel = TYPE_LABELS[emailType] ?? emailType;

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from:    `${fromName} <${fromAddr}>`,
      to,
      subject: `Test Email — ${typeLabel} · ${portalName}`,
      ...(replyTo ? { replyTo } : {}),
      ...(bcc     ? { bcc }     : {}),
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#318774;margin-bottom:8px;">✓ Email Configuration Test</h2>
          <p style="color:#6b7280;font-size:13px;margin-bottom:24px;">This is a test email for the <strong>${typeLabel}</strong> email type.</p>
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;width:120px;">Type</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-weight:600;">${typeLabel}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;">From</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-family:monospace;">${fromName} &lt;${fromAddr}&gt;</td></tr>
            ${replyTo ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;">Reply-To</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-family:monospace;">${replyTo}</td></tr>` : ""}
            ${bcc ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;">BCC</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-family:monospace;">${bcc}</td></tr>` : ""}
            <tr><td style="padding:8px 0;color:#9ca3af;">Recipient</td><td style="padding:8px 0;font-family:monospace;">${to}</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="color:#9ca3af;font-size:11px;margin:0;">Sent from ${portalName} · Administrator Settings → Email</p>
        </div>
      `,
    });

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });

  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
