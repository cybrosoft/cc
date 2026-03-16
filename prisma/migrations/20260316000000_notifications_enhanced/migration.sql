-- prisma/migrations/20260316000000_notifications_enhanced/migration.sql
-- Notification system enhancements — all additive, zero breaking changes.
-- Safe to run on live DB — all ADD COLUMN IF NOT EXISTS.

-- ── Additions to User ────────────────────────────────────────────────────────
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "notifPrefs" JSONB,
  ADD COLUMN IF NOT EXISTS "timezone"   TEXT,
  ADD COLUMN IF NOT EXISTS "dndStart"   INTEGER,
  ADD COLUMN IF NOT EXISTS "dndEnd"     INTEGER;

-- ── Additions to Notification ────────────────────────────────────────────────
ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "eventType"      TEXT,
  ADD COLUMN IF NOT EXISTS "channel"        TEXT,
  ADD COLUMN IF NOT EXISTS "smsSent"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "smsSentAt"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "smsDelivered"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "emailDelivered" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "retryCount"     INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "failureReason"  TEXT,
  ADD COLUMN IF NOT EXISTS "broadcastId"    TEXT,
  ADD COLUMN IF NOT EXISTS "scheduledAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sentAt"         TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Notification_eventType_idx"   ON "Notification"("eventType");
CREATE INDEX IF NOT EXISTS "Notification_broadcastId_idx" ON "Notification"("broadcastId");
CREATE INDEX IF NOT EXISTS "Notification_channel_idx"     ON "Notification"("channel");

-- ── NotificationTemplate ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "NotificationTemplate" (
  "id"            TEXT        NOT NULL,
  "eventType"     TEXT        NOT NULL,
  "name"          TEXT        NOT NULL,
  "emailSubject"  TEXT        NOT NULL DEFAULT '',
  "emailBody"     TEXT        NOT NULL DEFAULT '',
  "smsBody"       TEXT,
  "defaultEmail"  BOOLEAN     NOT NULL DEFAULT true,
  "defaultSms"    BOOLEAN     NOT NULL DEFAULT false,
  "defaultInapp"  BOOLEAN     NOT NULL DEFAULT true,
  "lockChannels"  BOOLEAN     NOT NULL DEFAULT false,
  "isActive"      BOOLEAN     NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "NotificationTemplate_eventType_key" ON "NotificationTemplate"("eventType");

-- ── NotificationBroadcast ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "NotificationBroadcast" (
  "id"              TEXT         NOT NULL,
  "title"           TEXT         NOT NULL,
  "body"            TEXT         NOT NULL,
  "emailSubject"    TEXT,
  "smsBody"         TEXT,
  "channels"        TEXT[]       NOT NULL DEFAULT '{}',
  "targetType"      TEXT         NOT NULL,
  "targetId"        TEXT,
  "scheduledAt"     TIMESTAMP(3),
  "sentAt"          TIMESTAMP(3),
  "totalCount"      INTEGER      NOT NULL DEFAULT 0,
  "sentCount"       INTEGER      NOT NULL DEFAULT 0,
  "failCount"       INTEGER      NOT NULL DEFAULT 0,
  "createdByUserId" TEXT         NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationBroadcast_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "NotificationBroadcast_createdAt_idx" ON "NotificationBroadcast"("createdAt");
CREATE INDEX IF NOT EXISTS "NotificationBroadcast_sentAt_idx"    ON "NotificationBroadcast"("sentAt");

ALTER TABLE "NotificationBroadcast"
  ADD CONSTRAINT "NotificationBroadcast_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── Seed default templates ───────────────────────────────────────────────────
-- These are the system event types. Admin can edit body/subject but not eventType.
INSERT INTO "NotificationTemplate"
  ("id", "eventType", "name", "emailSubject", "emailBody", "smsBody",
   "defaultEmail", "defaultSms", "defaultInapp", "lockChannels", "isActive", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'INVOICE_ISSUED',
   'Invoice Issued',
   'Invoice {docNum} — {amount} due',
   '<p>Dear {customerName},</p><p>Invoice <strong>{docNum}</strong> for <strong>{amount}</strong> has been issued.</p><p>Due date: {dueDate}</p><p><a href="{link}">View Invoice</a></p>',
   '{portalName}: Invoice {docNum} for {amount} issued. Due: {dueDate}',
   true, false, true, false, true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'INVOICE_OVERDUE',
   'Invoice Overdue',
   'Overdue: Invoice {docNum} — {amount}',
   '<p>Dear {customerName},</p><p>Invoice <strong>{docNum}</strong> for <strong>{amount}</strong> is now overdue.</p><p>Please settle your balance to avoid service interruption.</p><p><a href="{link}">Pay Now</a></p>',
   '{portalName}: Invoice {docNum} for {amount} is OVERDUE. Please pay to avoid suspension.',
   true, true, true, true, true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'SUBSCRIPTION_EXPIRING',
   'Subscription Expiring',
   'Your subscription expires in {days} days',
   '<p>Dear {customerName},</p><p>Your subscription to <strong>{productName}</strong> expires on <strong>{expiryDate}</strong> ({days} days from now).</p><p><a href="{link}">Renew Now</a></p>',
   '{portalName}: {productName} expires in {days} days on {expiryDate}. Renew: {link}',
   true, true, true, false, true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'SUBSCRIPTION_ACTIVATED',
   'Subscription Activated',
   'Your subscription to {productName} is now active',
   '<p>Dear {customerName},</p><p>Your subscription to <strong>{productName}</strong> is now active.</p><p>Valid until: {expiryDate}</p><p><a href="{link}">View Subscription</a></p>',
   '{portalName}: {productName} is now active until {expiryDate}.',
   true, false, true, false, true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'SUBSCRIPTION_SUSPENDED',
   'Subscription Suspended',
   'Your subscription has been suspended',
   '<p>Dear {customerName},</p><p>Your subscription to <strong>{productName}</strong> has been suspended due to non-payment.</p><p><a href="{link}">Settle Balance</a></p>',
   '{portalName}: {productName} SUSPENDED. Pay outstanding balance to restore.',
   true, true, true, true, true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'QUOTATION_SENT',
   'Quotation Sent',
   'New quotation {docNum} from {portalName}',
   '<p>Dear {customerName},</p><p>A new quotation <strong>{docNum}</strong> for <strong>{amount}</strong> has been prepared for you.</p><p><a href="{link}">View Quotation</a></p>',
   '{portalName}: New quotation {docNum} for {amount}. View: {link}',
   true, false, true, false, true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'PAYMENT_RECEIVED',
   'Payment Received',
   'Payment received — {amount}',
   '<p>Dear {customerName},</p><p>We have received your payment of <strong>{amount}</strong> for invoice <strong>{docNum}</strong>. Thank you!</p><p><a href="{link}">View Receipt</a></p>',
   '{portalName}: Payment of {amount} received for {docNum}. Thank you!',
   true, false, true, false, true, CURRENT_TIMESTAMP),

  (gen_random_uuid()::text, 'BROADCAST',
   'Admin Broadcast',
   '{title}',
   '<p>{body}</p>',
   '{body}',
   true, false, true, false, true, CURRENT_TIMESTAMP)

ON CONFLICT ("eventType") DO NOTHING;
