// lib/settings/portal-settings.ts
// Server-side helper to read/write PortalSetting rows.
// Used by API routes and server components.

import { prisma } from "@/lib/prisma";

// ── Well-known setting keys ──────────────────────────────────────────────────

export const SETTING_KEYS = {
  // Portal identity
  PORTAL_NAME:          "portal.name",
  PORTAL_LOGO_URL:      "portal.logoUrl",
  PORTAL_FAVICON_URL:   "portal.faviconUrl",
  PORTAL_SUPPORT_EMAIL: "portal.supportEmail",
  PORTAL_SUPPORT_PHONE: "portal.supportPhone",
  PORTAL_WEBSITE:       "portal.website",

  // Email / SMTP
  SMTP_HOST:     "smtp.host",
  SMTP_PORT:     "smtp.port",
  SMTP_USER:     "smtp.user",
  SMTP_PASS:     "smtp.pass",
  SMTP_FROM:     "smtp.from",
  SMTP_FROM_NAME:"smtp.fromName",
  SMTP_SECURE:   "smtp.secure",    // "true" | "false"

  // Notification thresholds
  NOTIF_EXPIRY_DAYS:  "notif.expiryDays",   // days before sub expiry to warn
  NOTIF_PAYMENT_DAYS: "notif.paymentDays",  // days overdue before alert

  // Tag behaviour keys (stored as tag key strings)
  TAG_HIDE_PRICE:    "tag.hidePrice",    // tag key whose customers see no prices
  TAG_EXCLUDE_2FA:   "tag.exclude2fa",   // tag key whose customers skip 2FA
} as const;

export type SettingKey = typeof SETTING_KEYS[keyof typeof SETTING_KEYS];

// ── Read helpers ─────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.portalSetting.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const rows = await prisma.portalSetting.findMany();
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return map;
}

// ── Write helpers ─────────────────────────────────────────────────────────────

export async function setSetting(key: string, value: string): Promise<void> {
  await prisma.portalSetting.upsert({
    where:  { key },
    update: { value },
    create: { key, value },
  });
}

export async function setSettings(pairs: Record<string, string>): Promise<void> {
  await prisma.$transaction(
    Object.entries(pairs).map(([key, value]) =>
      prisma.portalSetting.upsert({
        where:  { key },
        update: { value },
        create: { key, value },
      })
    )
  );
}
