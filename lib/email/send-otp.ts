// lib/email/send-otp.ts
import { Resend } from "resend";
import { getEmailConfig } from "@/lib/email/email-config";
import { wrapEmailHtml, loadEmailBranding } from "@/lib/email/templates";

const resend = new Resend(process.env.RESEND_API_KEY!);

// marketKey: market key from DB e.g. "SAUDI", "GLOBAL" (optional — falls back to global)
export async function sendOtpEmail(email: string, code: string, marketKey?: string) {
  const [cfg, branding] = await Promise.all([
    getEmailConfig("auth", marketKey),
    loadEmailBranding(),
  ]);

  const body = `
    <h2 style="color:${branding.primaryColor};margin:0 0 8px;">Your login code</h2>
    <p style="color:#374151;font-size:14px;margin:0 0 4px;">Use the code below to sign in. It expires in 10 minutes.</p>
    <div style="text-align:center;margin:28px 0;">
      <span style="font-size:36px;font-weight:700;font-family:monospace;letter-spacing:0.2em;color:#111827;">${code}</span>
    </div>
    <p style="color:#9ca3af;font-size:12px;margin:0;">If you didn't request this code, you can safely ignore this email.</p>
  `;

  const { data, error } = await resend.emails.send({
    ...cfg,
    to:      email,
    subject: "Your Cybrosoft login code",
    html: wrapEmailHtml({
      body,
      portalName:   branding.portalName,
      logoUrl:      branding.logoUrl,
      primaryColor: branding.primaryColor,
    }),
  });

  if (error) {
    console.error("[sendOtpEmail] Resend error:", JSON.stringify(error));
    throw new Error(error.message);
  }

  console.log("[sendOtpEmail] Resend success, id:", data?.id);
}
