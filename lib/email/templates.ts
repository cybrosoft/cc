// lib/email/templates.ts
// SINGLE SOURCE for the branded email HTML shell + branding loader.
// Every email in the system (OTP, notifications, sales documents, test emails)
// must wrap its body with wrapEmailHtml() so all mail shares one consistent
// header, footer, and brand bar.

import { prisma } from "@/lib/prisma";

// ── Branding loader ───────────────────────────────────────────────────────────
// Reads portal branding from PortalSetting once per send.

export interface EmailBranding {
  portalName:   string;
  logoUrl?:     string;
  primaryColor: string;
  baseUrl:      string;
}

export async function loadEmailBranding(): Promise<EmailBranding> {
  const rows = await prisma.portalSetting.findMany({
    where: { key: { in: ["portal.name", "portal.logoUrl", "portal.primaryColor"] } },
  }).catch(() => []);

  const s: Record<string, string> = {};
  for (const r of rows) s[r.key] = r.value;

  return {
    portalName:   s["portal.name"]         || "Cybrosoft Cloud Console",
    logoUrl:      s["portal.logoUrl"]      || undefined,
    primaryColor: s["portal.primaryColor"] || "#318774",
    baseUrl:      process.env.NEXT_PUBLIC_BASE_URL ?? "",
  };
}

// ── Base email HTML wrapper ───────────────────────────────────────────────────
// Wraps any email body content in the branded HTML shell.
// brandName overrides the header text (e.g. market legal entity on sales docs)
// while keeping the identical shell structure.

export function wrapEmailHtml(params: {
  body:          string;
  portalName:    string;
  brandName?:    string;   // header display name override (defaults to portalName)
  logoUrl?:      string;
  primaryColor?: string;
  unsubLink?:    string;
  footerText?:   string;   // footer override (defaults to "sent by portalName")
}): string {
  const {
    body, portalName, brandName, logoUrl,
    primaryColor = "#318774", unsubLink, footerText,
  } = params;

  const headerName = brandName ?? portalName;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${portalName}</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background:#222222;padding:20px 32px;">
              ${logoUrl
                ? `<img src="${logoUrl}" alt="${headerName}" style="height:36px;max-width:180px;" />`
                : `<span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${headerName}</span>`
              }
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;color:#374151;font-size:14px;line-height:1.7;">
              ${body}
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;" />
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;color:#9ca3af;font-size:12px;line-height:1.6;">
              ${footerText
                ? `<p style="margin:0 0 4px;">${footerText}</p>`
                : `<p style="margin:0 0 4px;">This email was sent by <strong>${portalName}</strong>.</p>`
              }
              ${unsubLink ? `<p style="margin:0;"><a href="${unsubLink}" style="color:#9ca3af;">Unsubscribe from notifications</a></p>` : ""}
            </td>
          </tr>
          <!-- Bottom bar -->
          <tr>
            <td style="background:${primaryColor};height:4px;"></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
