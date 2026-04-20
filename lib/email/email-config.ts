// lib/email/email-config.ts
// Central helper — get the correct from/replyTo/bcc for each email type and market.
// All email sending functions must use this instead of process.env.EMAIL_FROM directly.
//
// NOTE: No module-level cache — Next.js serverless routes are separate module instances,
// so a cache here is not shared between routes and causes stale data after settings save.
// Prisma connection pooling makes direct DB reads fast enough.

import { prisma } from "@/lib/prisma";

export type EmailType = "auth" | "support" | "sales" | "billing" | "notifications";

export interface EmailConfig {
  from:     string;   // "Name <email@domain.com>"
  replyTo?: string;   // ONLY set if explicitly configured in admin settings — never auto-filled
  bcc?:     string;   // ONLY set if explicitly configured in admin settings
}

// marketKey: the market key exactly as stored in DB e.g. "SAUDI", "GLOBAL"
// We lowercase it internally for the setting keys.
//
// Fallback chain for from name:
//   1. email.fromName.{market}.{type}   e.g. email.fromName.saudi.billing = "Cybrosoft Billing SA"
//   2. email.fromName.{market}.auth     market-level base name
//   3. portal.name                      portal-wide fallback
//   4. "Cybrosoft"                      hardcoded last resort
//
// Fallback chain for from address:
//   1. email.{type}                     e.g. email.billing = "billing@cybrosoft.com"
//   2. process.env.EMAIL_FROM           env var
//   3. "noreply@cybrosoft.com"          hardcoded last resort
//
// replyTo / bcc:
//   ONLY included if the setting exists AND is non-empty.
//   Never falls back to from address or any other value.
//   If blank in settings → not included in EmailConfig at all.

export async function getEmailConfig(type: EmailType, marketKey?: string): Promise<EmailConfig> {
  const rows = await prisma.portalSetting.findMany();
  const s: Record<string, string> = {};
  for (const r of rows) s[r.key] = r.value;

  const mKey = (marketKey ?? "global").toLowerCase();

  // From name — specific to market+type, then market base, then portal name
  const fromName =
    (s[`email.fromName.${mKey}.${type}`] ?? "").trim() ||
    (s[`email.fromName.${mKey}.auth`]    ?? "").trim() ||
    (s["portal.name"]                    ?? "").trim() ||
    "Cybrosoft";

  // From address — specific to type, then env var
  const fromAddr =
    (s[`email.${type}`]       ?? "").trim() ||
    (process.env.EMAIL_FROM   ?? "").trim() ||
    "noreply@cybrosoft.com";

  // Reply-To — strictly explicit only, empty string = not set
  const replyToVal = (s[`email.${type}.replyTo`] ?? "").trim();

  // BCC — strictly explicit only, empty string = not set
  const bccVal = (s[`email.${type}.bcc`] ?? "").trim();

  return {
    from:                          `${fromName} <${fromAddr}>`,
    ...(replyToVal ? { replyTo: replyToVal } : {}),
    ...(bccVal     ? { bcc:     bccVal     } : {}),
  };
}

// Kept for backward compatibility — no-op since we removed the cache
export function invalidateEmailCache() {}
