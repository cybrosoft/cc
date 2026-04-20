// lib/notifications/channels/sms.ts
// SMS notification channel — currently stubbed (SNS not configured).
// When ready: install @aws-sdk/client-sns and set AWS_SNS_* env vars.

import { prisma } from "@/lib/prisma";

interface SMSParams {
  user: {
    id:      string;
    mobile?: string | null;
    market?: { key: string } | null;
  };
  body:            string;
  eventType:       string;
  notificationId?: string;
}

export async function sendSMS(params: SMSParams): Promise<void> {
  const { user, body, eventType, notificationId } = params;

  if (!user.mobile) return;

  const phone = normalisePhone(user.mobile);
  if (!phone) {
    console.warn(`[sms channel] Invalid phone number: ${user.mobile}`);
    return;
  }

  const accessKey    = process.env.AWS_SNS_ACCESS_KEY_ID;
  const secretKey    = process.env.AWS_SNS_SECRET_ACCESS_KEY;
  const isConfigured = !!(accessKey && secretKey);

  if (!isConfigured) {
    // Graceful stub — logs only, does not crash notification flow
    console.log(`[sms channel] SNS not configured — would send to ${phone}: "${body.slice(0, 80)}"`);
    return;
  }

  // SNS configured but package not installed — log warning and return gracefully
  try {
    // @ts-ignore — optional peer dependency
    const sns = await import("@aws-sdk/client-sns").catch(() => null);
    if (!sns) {
      console.warn("[sms channel] @aws-sdk/client-sns not installed — SMS skipped");
      return;
    }

    const { SNSClient, PublishCommand } = sns;
    const region    = process.env.AWS_SNS_REGION ?? "me-south-1";
    const client    = new SNSClient({ region, credentials: { accessKeyId: accessKey!, secretAccessKey: secretKey! } });
    const msgType   = TRANSACTIONAL_EVENTS.has(eventType) ? "Transactional" : "Promotional";

    await client.send(new PublishCommand({
      PhoneNumber: phone,
      Message:     body,
      MessageAttributes: {
        "AWS.SNS.SMS.SMSType":   { DataType: "String", StringValue: msgType },
        "AWS.SNS.SMS.MaxPrice":  { DataType: "Number", StringValue: "0.50" },
      },
    }));

    if (notificationId) {
      await prisma.notification.update({
        where: { id: notificationId },
        data:  { smsSent: true, smsSentAt: new Date() },
      }).catch(() => {});
    }

    console.log(`[sms channel] Sent to ${phone} (${eventType})`);

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

const TRANSACTIONAL_EVENTS = new Set([
  "INVOICE_OVERDUE", "SUBSCRIPTION_SUSPENDED",
  "SUBSCRIPTION_EXPIRING", "PAYMENT_RECEIVED",
]);

function normalisePhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-().]/g, "");
  if (/^\+\d{7,15}$/.test(cleaned))  return cleaned;
  if (/^05\d{8}$/.test(cleaned))     return `+966${cleaned.slice(1)}`;
  if (/^5\d{8}$/.test(cleaned))      return `+966${cleaned}`;
  if (/^9665\d{8}$/.test(cleaned))   return `+${cleaned}`;
  if (/^\d{10}$/.test(cleaned))      return `+1${cleaned}`;
  if (/^\d{7,15}$/.test(cleaned))    return `+${cleaned}`;
  return null;
}
