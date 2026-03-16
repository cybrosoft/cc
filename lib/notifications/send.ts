// lib/notifications/send.ts
// Central orchestrator for all notification sending.
// Handles channel selection, DND, preferences, templates, retry logic.
// Used by: API routes, cron job, event triggers in other routes.
//
// Usage:
//   import { sendNotification } from "@/lib/notifications/send";
//   await sendNotification({
//     userId:    "clxxx",
//     eventType: "INVOICE_ISSUED",
//     variables: { docNum: "CY-INV-5250", amount: "SAR 500.00", ... },
//     link:      "/dashboard/invoices/CY-INV-5250",
//   });

import { prisma } from "@/lib/prisma";
import { sendInApp }   from "./channels/inapp";
import { sendEmail }   from "./channels/email";
import { sendSMS }     from "./channels/sms";
import { renderTemplate } from "./templates";

// ── Event types ───────────────────────────────────────────────────────────────

export const EVENT_TYPES = {
  INVOICE_ISSUED:         "INVOICE_ISSUED",
  INVOICE_OVERDUE:        "INVOICE_OVERDUE",
  SUBSCRIPTION_EXPIRING:  "SUBSCRIPTION_EXPIRING",
  SUBSCRIPTION_ACTIVATED: "SUBSCRIPTION_ACTIVATED",
  SUBSCRIPTION_SUSPENDED: "SUBSCRIPTION_SUSPENDED",
  QUOTATION_SENT:         "QUOTATION_SENT",
  PAYMENT_RECEIVED:       "PAYMENT_RECEIVED",
  BROADCAST:              "BROADCAST",
} as const;

export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

// ── Notification payload ──────────────────────────────────────────────────────

export interface SendNotificationParams {
  userId:       string;
  eventType:    EventType | string;
  variables:    Record<string, string>; // template variable substitutions
  link?:        string;                 // deep link in customer portal
  broadcastId?: string;                 // set when part of a broadcast
  // Override channels (bypasses user preference — use for critical alerts)
  forceEmail?:  boolean;
  forceSms?:    boolean;
  forceInapp?:  boolean;
}

// ── Main send function ────────────────────────────────────────────────────────

export async function sendNotification(params: SendNotificationParams): Promise<void> {
  const { userId, eventType, variables, link, broadcastId } = params;

  // 1. Load user with notification preferences + market
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: {
      id: true, email: true, fullName: true, mobile: true,
      timezone: true, dndStart: true, dndEnd: true,
      notifPrefs: true,
      market: { select: { key: true, defaultCurrency: true } },
    },
  });
  if (!user) return;

  // 2. Load template for this event type
  const template = await prisma.notificationTemplate.findUnique({
    where: { eventType },
  });

  // Fall back to plain text if no template
  const title = renderTemplate(
    template?.emailSubject ?? variables.title ?? eventType,
    variables
  );
  const emailBody = renderTemplate(
    template?.emailBody ?? `<p>${variables.body ?? title}</p>`,
    variables
  );
  const smsBody = renderTemplate(
    template?.smsBody ?? title,
    variables
  );
  const inappBody = variables.body ?? title;

  // 3. Resolve which channels to use
  const prefs      = resolvePreferences(user.notifPrefs, eventType, template);
  const useInapp   = params.forceInapp  ?? prefs.inapp;
  const useEmail   = params.forceEmail  ?? prefs.email;
  const useSms     = params.forceSms    ?? (prefs.sms && !!user.mobile);

  // 4. DND check for SMS (never block in-app or email)
  const smsBlocked = useSms && isDNDActive(user.timezone, user.dndStart, user.dndEnd);

  // 5. Send each channel — independent try/catch so one failure doesn't block others
  const results = await Promise.allSettled([
    useInapp
      ? sendInApp({ userId, title, body: inappBody, eventType, link, broadcastId })
      : Promise.resolve(),
    useEmail
      ? sendEmail({ user, subject: title, htmlBody: emailBody, eventType, link })
      : Promise.resolve(),
    (useSms && !smsBlocked)
      ? sendSMS({ user, body: smsBody, eventType })
      : Promise.resolve(),
  ]);

  // 6. Log failures to notification record
  const failures = results
    .map((r, i) => r.status === "rejected" ? `channel[${i}]: ${r.reason}` : null)
    .filter(Boolean);

  if (failures.length > 0) {
    console.error(`[notifications] Partial failure for ${eventType} → ${userId}:`, failures);
  }
}

// ── Broadcast send (admin manual) ─────────────────────────────────────────────

export interface BroadcastParams {
  broadcastId:   string;
  broadcastType: string;    // "ESSENTIAL" | "MARKETING"
  title:         string;
  body:          string;
  emailSubject?: string;
  smsBody?:      string;
  channels:      string[];  // ["inapp", "email", "sms"]
  userIds:       string[];
}

export async function sendBroadcast(params: BroadcastParams): Promise<{ sent: number; failed: number }> {
  let sent = 0; let failed = 0;

  for (const userId of params.userIds) {
    try {
      const user = await prisma.user.findUnique({
        where:  { id: userId },
        select: {
          id: true, email: true, fullName: true, mobile: true,
          timezone: true, dndStart: true, dndEnd: true,
          notifPrefs: true,
        },
      });
      if (!user) continue;

      // Per-channel marketing opt-out check
      // ESSENTIAL bypasses this — always sends to all requested channels
      const marketingPrefs = (user.notifPrefs as Record<string, unknown>) ?? {};
      function canSend(channel: string): boolean {
        if (params.broadcastType !== "MARKETING") return true;
        return marketingPrefs[`marketing.${channel}`] !== false;
      }

      await Promise.allSettled([
        (params.channels.includes("inapp") && canSend("inapp"))
          ? sendInApp({ userId, title: params.title, body: params.body, eventType: "BROADCAST", broadcastId: params.broadcastId })
          : Promise.resolve(),
        (params.channels.includes("email") && canSend("email"))
          ? sendEmail({ user, subject: params.emailSubject ?? params.title, htmlBody: `<p>${params.body}</p>`, eventType: "BROADCAST" })
          : Promise.resolve(),
        (params.channels.includes("sms") && canSend("sms") && !!user.mobile && !isDNDActive(user.timezone, user.dndStart, user.dndEnd))
          ? sendSMS({ user, body: params.smsBody ?? params.body, eventType: "BROADCAST" })
          : Promise.resolve(),
      ]);

      sent++;
    } catch {
      failed++;
    }
  }

  // Update broadcast record
  await prisma.notificationBroadcast.update({
    where: { id: params.broadcastId },
    data:  { sentCount: sent, failCount: failed, sentAt: new Date() },
  }).catch(() => {});

  return { sent, failed };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface UserPrefs {
  email: boolean;
  sms:   boolean;
  inapp: boolean;
}

function resolvePreferences(
  notifPrefs: unknown,
  eventType: string,
  template: { defaultEmail: boolean; defaultSms: boolean; defaultInapp: boolean; lockChannels: boolean } | null
): UserPrefs {
  const defaults: UserPrefs = {
    email: template?.defaultEmail ?? true,
    sms:   template?.defaultSms   ?? false,
    inapp: template?.defaultInapp ?? true,
  };

  // If admin locked channels, always use defaults
  if (template?.lockChannels) return defaults;

  // Try user preferences
  if (notifPrefs && typeof notifPrefs === "object") {
    const prefs = notifPrefs as Record<string, Record<string, boolean>>;
    const eventPrefs = prefs[eventType];
    if (eventPrefs) {
      return {
        email: eventPrefs.email ?? defaults.email,
        sms:   eventPrefs.sms   ?? defaults.sms,
        inapp: eventPrefs.inapp ?? defaults.inapp,
      };
    }
  }

  return defaults;
}

function isDNDActive(
  timezone: string | null | undefined,
  dndStart: number | null | undefined,
  dndEnd:   number | null | undefined
): boolean {
  if (dndStart === null || dndStart === undefined) return false;
  if (dndEnd   === null || dndEnd   === undefined) return false;

  try {
    const now  = new Date();
    const tz   = timezone ?? "Asia/Riyadh";
    const hour = parseInt(
      now.toLocaleString("en-US", { timeZone: tz, hour: "numeric", hour12: false }),
      10
    );

    if (dndStart <= dndEnd) {
      // e.g. 22 → 8 wraps midnight: split into two ranges
      return hour >= dndStart || hour < dndEnd;
    }
    return hour >= dndStart && hour < dndEnd;
  } catch {
    return false;
  }
}