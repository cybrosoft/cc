// app/api/admin/settings/test-email/route.ts
// Sends a test email using Resend (same provider as OTP emails in this project).
// Requires RESEND_API_KEY and EMAIL_FROM environment variables.
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getAllSettings } from "@/lib/settings/portal-settings";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const { to } = await req.json();
    if (!to) return NextResponse.json({ error: "Recipient email required" }, { status: 400 });

    const settings  = await getAllSettings();
    const portalName = settings["portal.name"]   ?? "Cybrosoft Cloud Console";
    const fromEmail  = process.env.EMAIL_FROM     ?? "noreply@cybrosoft.com";
    const apiKey     = process.env.RESEND_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "RESEND_API_KEY is not set in environment variables." },
        { status: 400 }
      );
    }

    const resend = new Resend(apiKey);

    const { error } = await resend.emails.send({
      from:    `${portalName} <${fromEmail}>`,
      to,
      subject: `Test Email — ${portalName}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#318774;margin-bottom:16px;">✓ Email Test Successful</h2>
          <p style="color:#374151;font-size:14px;line-height:1.6;">
            Your Resend email configuration is working correctly.<br/>
            This test was sent from <strong>${fromEmail}</strong> via Resend API.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
          <p style="color:#9ca3af;font-size:12px;">
            Sent from ${portalName} · Administrator Settings
          </p>
        </div>
      `,
    });

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
