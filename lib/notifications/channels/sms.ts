// lib/notifications/channels/sms.ts
// SMS notification channel using AWS SNS.
// Critical notifications only — invoice overdue, subscription suspended,
// subscription expiring, security alerts.
//
// Required env vars (when ready to activate):
//   AWS_SNS_ACCESS_KEY_ID      — separate from Supabase S3 credentials
//   AWS_SNS_SECRET_ACCESS_KEY  — separate from Supabase S3 credentials
//   AWS_SNS_REGION             — me-south-1 (Bahrain, best for Saudi delivery)
//
// To activate: install @aws-sdk/client-sns and set env vars above.
// The stub logs to console until credentials are configured.

import { prisma } from "@/lib/prisma";

interface SMSParams {
  user: {
    id:      string;
    mobile?: string | null;
    market?: { key: string } | null;
  };
  body:      string; // already rendered with variables — keep under 160 chars
  eventType: string;
  notificationId?: string;
}

export async function sendSMS(params: SMSParams): Promise<void> {
  const { user, body, eventType, notificationId } = params;

  if (!user.mobile) {
    console.warn(`[sms channel] No mobile number for user ${user.id} — skipping`);
    return;
  }

  // Normalise to E.164 format
  const phone = normalisePhone(user.mobile);
  if (!phone) {
    console.warn(`[sms channel] Invalid phone number: ${user.mobile}`);
    return;
  }

  const accessKey    = process.env.AWS_SNS_ACCESS_KEY_ID;
  const secretKey    = process.env.AWS_SNS_SECRET_ACCESS_KEY;
  const region       = process.env.AWS_SNS_REGION ?? "me-south-1";
  const isConfigured = !!(accessKey && secretKey);

  if (!isConfigured) {
    // Graceful stub — logs but does not throw, does not break the notification flow
    console.log(
      `[sms channel] AWS SNS not configured — would send to ${phone}:`,
      `"${body.slice(0, 80)}${body.length > 80 ? "…" : ""}"`
    );
    return;
  }

  try {
    // Dynamic import — only loads if package is installed
    const { SNSClient, PublishCommand } = await import("@aws-sdk/client-sns");

    const sns = new SNSClient({
      region,
      credentials: { accessKeyId: accessKey!, secretAccessKey: secretKey! },
    });

    // Transactional = highest delivery priority, required for OTP/alerts
    const messageType = isTransactional(eventType) ? "Transactional" : "Promotional";

    await sns.send(new PublishCommand({
      PhoneNumber: phone,
      Message:     body,
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType": {
          DataType:    "String",
          StringValue: messageType,
        },
        "AWS.SNS.SMS.MaxPrice": {
          DataType:    "Number",
          StringValue: "0.50", // max $0.50 per message — safety cap
        },
      },
    }));

    // Mark SMS as sent
    if (notificationId) {
      await prisma.notification.update({
        where: { id: notificationId },
        data:  { smsSent: true, smsSentAt: new Date() },
      }).catch(() => {});
    }

    console.log(`[sms channel] Sent ${messageType} SMS to ${phone} (${eventType})`);

  } catch (e: any) {
    console.error(`[sms channel] Failed to send to ${phone}:`, e.message);

    if (notificationId) {
      await prisma.notification.update({
        where: { id: notificationId },
        data:  { failureReason: `SMS: ${e.message}` },
      }).catch(() => {});
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// These event types use Transactional priority (higher cost, higher delivery rate)
// Everything else uses Promotional
const TRANSACTIONAL_EVENTS = new Set([
  "INVOICE_OVERDUE",
  "SUBSCRIPTION_SUSPENDED",
  "SUBSCRIPTION_EXPIRING",
  "PAYMENT_RECEIVED",
]);

function isTransactional(eventType: string): boolean {
  return TRANSACTIONAL_EVENTS.has(eventType);
}

// Normalise a phone number to E.164 format (+966XXXXXXXXX)
// Handles common Saudi formats: 05XXXXXXXX, +9665XXXXXXXX, 9665XXXXXXXX
function normalisePhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-().]/g, "");

  // Already E.164
  if (/^\+\d{7,15}$/.test(cleaned)) return cleaned;

  // Saudi: 05XXXXXXXX → +9665XXXXXXXX
  if (/^05\d{8}$/.test(cleaned)) return `+966${cleaned.slice(1)}`;

  // Saudi without leading 0: 5XXXXXXXX → +9665XXXXXXXX
  if (/^5\d{8}$/.test(cleaned)) return `+966${cleaned}`;

  // Saudi with country code but no +: 9665XXXXXXXX
  if (/^9665\d{8}$/.test(cleaned)) return `+${cleaned}`;

  // US: 10 digits
  if (/^\d{10}$/.test(cleaned)) return `+1${cleaned}`;

  // Already has country code digits (7–15 digits)
  if (/^\d{7,15}$/.test(cleaned)) return `+${cleaned}`;

  return null;
}
