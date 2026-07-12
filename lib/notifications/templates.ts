// lib/notifications/templates.ts
// Template variable substitution engine.
// Variables use {curlyBrace} syntax: {customerName}, {docNum}, {amount} etc.
//
// NOTE: the branded HTML shell now lives in lib/email/templates.ts (single
// source for ALL emails). Re-exported here for backward compatibility.
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

export { wrapEmailHtml } from "@/lib/email/templates";

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
