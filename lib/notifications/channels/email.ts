// lib/notifications/channels/email.ts
// Email notification channel using Resend.
// Follows the same pattern as lib/email/send-otp.ts (existing).
// Updates the Notification record with delivery status.

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { wrapEmailHtml } from "../templates";

interface EmailParams {
  user: {
    id:       string;
    email:    string;
    fullName?: string | null;
  };
  subject:   string;
  htmlBody:  string;  // already rendered with variables
  eventType: string;
  link?:     string;
  notificationId?: string; // if updating an existing record
}

export async function sendEmail(params: EmailParams): Promise<void> {
  const { user, subject, htmlBody, eventType, notificationId } = params;

  const apiKey     = process.env.RESEND_API_KEY;
  const fromEmail  = process.env.EMAIL_FROM ?? "noreply@cybrosoft.com";

  if (!apiKey) {
    console.error("[email channel] RESEND_API_KEY not set");
    return;
  }

  // Load portal settings for branding
  const [nameSetting, logoSetting, colorSetting] = await Promise.all([
    prisma.portalSetting.findUnique({ where: { key: "portal.name" } }),
    prisma.portalSetting.findUnique({ where: { key: "portal.logoUrl" } }),
    prisma.portalSetting.findUnique({ where: { key: "portal.primaryColor" } }),
  ]);

  const portalName   = nameSetting?.value  ?? "Cybrosoft Cloud Console";
  const logoUrl      = logoSetting?.value  ?? undefined;
  const primaryColor = colorSetting?.value ?? "#318774";
  const baseUrl      = process.env.NEXT_PUBLIC_BASE_URL ?? "";

  // Wrap body in branded HTML shell
  const fullHtml = wrapEmailHtml({
    body:         htmlBody,
    portalName,
    logoUrl,
    primaryColor,
    unsubLink:    `${baseUrl}/dashboard/notifications/preferences`,
  });

  const resend = new Resend(apiKey);

  try {
    const fromName = await prisma.portalSetting.findUnique({ where: { key: "email.fromName" } });
    const replyTo  = await prisma.portalSetting.findUnique({ where: { key: "email.replyTo" } });
    const bcc      = await prisma.portalSetting.findUnique({ where: { key: "email.invoiceCC" } });

    const { error } = await resend.emails.send({
      from:    `${fromName?.value ?? portalName} <${fromEmail}>`,
      to:      user.email,
      subject,
      html:    fullHtml,
      ...(replyTo?.value ? { replyTo: replyTo.value } : {}),
      ...(bcc?.value && ["INVOICE_ISSUED", "INVOICE_OVERDUE", "PAYMENT_RECEIVED"].includes(eventType)
        ? { bcc: bcc.value }
        : {}),
    });

    if (error) {
      console.error(`[email channel] Resend error for ${user.email}:`, error);
      // Update notification record with failure if we have an ID
      if (notificationId) {
        await prisma.notification.update({
          where: { id: notificationId },
          data:  { failureReason: error.message },
        }).catch(() => {});
      }
      return;
    }

    // Mark email as sent on the notification record
    if (notificationId) {
      await prisma.notification.update({
        where: { id: notificationId },
        data:  { emailSent: true, emailSentAt: new Date() },
      }).catch(() => {});
    }

  } catch (e: any) {
    console.error(`[email channel] Failed to send to ${user.email}:`, e.message);
  }
}
