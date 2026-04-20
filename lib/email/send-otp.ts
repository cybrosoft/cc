// lib/email/send-otp.ts
import { Resend } from "resend";
import { getEmailConfig } from "@/lib/email/email-config";

const resend = new Resend(process.env.RESEND_API_KEY!);

// marketKey: market key from DB e.g. "SAUDI", "GLOBAL" (optional — falls back to global)
export async function sendOtpEmail(email: string, code: string, marketKey?: string) {
  const cfg = await getEmailConfig("auth", marketKey);

  const { data, error } = await resend.emails.send({
    ...cfg,
    to:      email,
    subject: "Your Cybrosoft login code",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#318774;margin-bottom:8px;">Your login code</h2>
        <p style="color:#374151;font-size:14px;">Use the code below to sign in. It expires in 10 minutes.</p>
        <div style="text-align:center;margin:28px 0;">
          <span style="font-size:36px;font-weight:700;font-family:monospace;letter-spacing:0.2em;color:#111827;">${code}</span>
        </div>
        <p style="color:#9ca3af;font-size:12px;">If you didn't request this code, you can safely ignore this email.</p>
      </div>
    `,
  });

  if (error) {
    console.error("[sendOtpEmail] Resend error:", JSON.stringify(error));
    throw new Error(error.message);
  }

  console.log("[sendOtpEmail] Resend success, id:", data?.id);
}
