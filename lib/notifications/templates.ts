// lib/notifications/templates.ts
// Template variable substitution engine.
// Variables use {curlyBrace} syntax: {customerName}, {docNum}, {amount} etc.
//
// Supported variables across all templates:
//   {customerName}  - customer full name or email
//   {customerEmail} - customer email
//   {portalName}    - from PortalSetting portal.name
//   {docNum}        - document number e.g. CY-INV-5250
//   {amount}        - formatted amount e.g. SAR 500.00
//   {dueDate}       - formatted date
//   {expiryDate}    - subscription expiry date
//   {days}          - days until expiry/overdue
//   {productName}   - product/service name
//   {link}          - full URL to relevant page
//   {title}         - notification title
//   {body}          - notification body

// ── Variable substitution ─────────────────────────────────────────────────────

export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{${key}}`, value ?? "");
  }
  return result;
}

// ── Base email HTML wrapper ───────────────────────────────────────────────────
// Wraps any email body content in a branded HTML shell.

export function wrapEmailHtml(params: {
  body:       string;
  portalName: string;
  logoUrl?:   string;
  primaryColor?: string;
  unsubLink?: string;
}): string {
  const { body, portalName, logoUrl, primaryColor = "#318774", unsubLink } = params;

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
                ? `<img src="${logoUrl}" alt="${portalName}" style="height:36px;max-width:180px;" />`
                : `<span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">${portalName}</span>`
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
              <p style="margin:0 0 4px;">This email was sent by <strong>${portalName}</strong>.</p>
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

// ── Build variables from common entities ─────────────────────────────────────
// Helper to build the variables map from DB records.

export function buildInvoiceVars(params: {
  customer:   { fullName?: string | null; email: string };
  doc:        { docNum: string; total: number; currency: string; dueDate?: Date | null };
  portalName: string;
  baseUrl:    string;
}): Record<string, string> {
  const { customer, doc, portalName, baseUrl } = params;
  return {
    customerName:  customer.fullName ?? customer.email,
    customerEmail: customer.email,
    portalName,
    docNum:   doc.docNum,
    amount:   formatAmount(doc.total, doc.currency),
    dueDate:  doc.dueDate ? formatDate(doc.dueDate) : "—",
    link:     `${baseUrl}/dashboard/invoices/${doc.docNum}`,
  };
}

export function buildSubscriptionVars(params: {
  customer:     { fullName?: string | null; email: string };
  subscription: { id: string; currentPeriodEnd?: Date | null };
  product:      { name: string };
  portalName:   string;
  baseUrl:      string;
  daysUntil?:   number;
}): Record<string, string> {
  const { customer, subscription, product, portalName, baseUrl, daysUntil } = params;
  return {
    customerName:  customer.fullName ?? customer.email,
    customerEmail: customer.email,
    portalName,
    productName:  product.name,
    expiryDate:   subscription.currentPeriodEnd ? formatDate(subscription.currentPeriodEnd) : "—",
    days:         daysUntil !== undefined ? String(daysUntil) : "—",
    link:         `${baseUrl}/dashboard/subscriptions`,
  };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

function formatAmount(cents: number, currency: string): string {
  const amount = cents / 100;
  if (currency === "SAR")
    return `SAR ${amount.toLocaleString("en-SA", { minimumFractionDigits: 2 })}`;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
