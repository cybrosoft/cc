// lib/notifications/channels/email.ts
// Email notification channel using Resend.
// Uses getEmailConfig("notifications", marketKey) for correct from name/address per market.

import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { getEmailConfig } from "@/lib/email/email-config";
import { wrapEmailHtml } from "../templates";

interface EmailParams {
  user: {
    id:        string;
    email:     string;
    fullName?: string | null;
    marketKey?: string | null; // market key e.g. "SAUDI", "GLOBAL"
  };
  subject:         string;
  htmlBody:        string;
  eventType:       string;
  link?:           string;
  notificationId?: string;
}

export async function sendEmail(params: EmailParams): Promise<void> {
  const { user, subject, htmlBody, eventType, notificationId } = params;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email channel] RESEND_API_KEY not set");
    return;
  }

  // Load portal branding settings
  const [nameSetting, logoSetting, colorSetting] = await Promise.all([
    prisma.portalSetting.findUnique({ where: { key: "portal.name" } }),
    prisma.portalSetting.findUnique({ where: { key: "portal.logoUrl" } }),
    prisma.portalSetting.findUnique({ where: { key: "portal.primaryColor" } }),
  ]);

  const portalName   = nameSetting?.value  ?? "Cybrosoft Cloud Console";
  const logoUrl      = logoSetting?.value  ?? undefined;
  const primaryColor = colorSetting?.value ?? "#318774";
  const baseUrl      = process.env.NEXT_PUBLIC_BASE_URL ?? "";

  // Get correct from/replyTo/bcc for notifications type + user's market
  const emailCfg = await getEmailConfig("notifications", user.marketKey ?? undefined);

  // Wrap body in branded HTML shell
  const fullHtml = wrapEmailHtml({
    body:         htmlBody,
    portalName,
    logoUrl,
    primaryColor,
    unsubLink: `${baseUrl}/dashboard/notifications/preferences`,
  });

  const resend = new Resend(apiKey);

  try {
    const { error } = await resend.emails.send({
      ...emailCfg,
      to:      user.email,
      subject,
      html:    fullHtml,
    });

    if (error) {
      console.error(`[email channel] Resend error for ${user.email}:`, error);
      if (notificationId) {
        await prisma.notification.update({
          where: { id: notificationId },
          data:  { failureReason: error.message },
        }).catch(() => {});
      }
      return;
    }

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
