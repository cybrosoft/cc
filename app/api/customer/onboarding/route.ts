// app/api/customer/onboarding/route.ts
// Saves onboarding wizard data. Called on final step submission.
// After saving, notifies admins (in-app) and the sales inbox (email) —
// same alert mechanism as the customer RFQ route.
//
// Market correction: the account's market was fixed at initial signup
// (based on whatever the country switcher showed at that moment), which
// can be wrong if the customer didn't explicitly pick their country before
// submitting their email. Since a PENDING user has no subscriptions or
// invoices yet, it's safe to let the final profile-step country choice
// correct the account's marketId here. "saudi" -> KSA market, anything
// else -> Global market.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { AccountType } from "@prisma/client";
import { Resend } from "resend";
import { getEmailConfig } from "@/lib/email/email-config";
import { wrapEmailHtml, loadEmailBranding } from "@/lib/email/templates";

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const fullName    = str(body.fullName);
  const mobile      = str(body.mobile);
  const accountType = body.accountType === "BUSINESS" ? AccountType.BUSINESS : AccountType.PERSONAL;

  if (!fullName || !mobile) {
    return NextResponse.json({ error: "Full name and mobile are required." }, { status: 400 });
  }

  // ── Resolve the final market from the profile-step country choice ──────────
  // marketKey is sent by the signup page based on the country the customer
  // selected on this final step. Falls back to the account's existing market
  // if not provided (keeps old behavior for any caller that doesn't send it).
  const requestedMarketKey = str(body.marketKey)?.toLowerCase();
  let marketIdToUse = user.marketId;
  let isSaudi = user.market?.key?.toLowerCase() === "saudi";

  if (requestedMarketKey) {
    const resolvedMarket = await prisma.market.findFirst({
      where: { key: requestedMarketKey.toUpperCase(), isActive: true },
      select: { id: true, key: true },
    });
    if (resolvedMarket) {
      marketIdToUse = resolvedMarket.id;
      isSaudi = resolvedMarket.key.toLowerCase() === "saudi";
    }
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName,
      mobile,
      accountType,
      marketId: marketIdToUse,

      // Company fields — only if business
      ...(accountType === AccountType.BUSINESS ? {
        companyName: str(body.companyName),
        vatTaxId:    str(body.vatTaxId),
        commercialRegistrationNumber: isSaudi ? str(body.crn) : undefined,
        shortAddressCode:             isSaudi ? str(body.shortAddressCode) : undefined,
      } : {}),

      // Address
      province:     str(body.province),
      addressLine1: str(body.addressLine1),
      addressLine2: str(body.addressLine2),
      city:         str(body.city),
      postalCode:   str(body.postalCode),

      // KSA-only address fields
      ...(isSaudi ? {
        buildingNumber:  str(body.buildingNumber),
        secondaryNumber: str(body.secondaryNumber),
        district:        str(body.district),
      } : {}),

      // T&C
      tcAccepted: true,
      privacyAccepted: true,
    },
    select: {
      id: true, email: true, customerNumber: true, companyName: true,
      market: { select: { key: true, name: true } },
    },
  });

  // ── In-app notification to all admins — non-critical ───────────────────────
  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId: admin.id,
          type: "INFO" as const,
          title: "New profile completed",
          body: `${fullName}${updated.companyName ? ` (${updated.companyName})` : ""} completed profile registration — awaiting review.`,
          link: `/admin/customers/${updated.id}/edit`,
          eventType: "PROFILE_COMPLETED",
        })),
      });
    }
  } catch { /* non-critical */ }

  // ── Email alert to sales inbox — non-blocking (same pattern as RFQ) ────────
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const [emailCfg, branding] = await Promise.all([
        getEmailConfig("sales", updated.market?.key ?? "global"),
        loadEmailBranding(),
      ]);
      const salesAddr = emailCfg.from.match(/<(.+)>/)?.[1] ?? emailCfg.from;
      const adminUrl  = `${branding.baseUrl}/admin/customers/${updated.id}/edit`;

      const row = (label: string, value: string | null | undefined) => value ? `
        <tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;width:140px;">${label}</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-weight:600;">${value}</td></tr>` : "";

      const emailBody = `
        <h2 style="color:${branding.primaryColor};margin:0 0 8px;">New profile completed</h2>
        <p style="margin:0 0 16px;">A customer has completed profile registration and is awaiting review.</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          ${row("Customer ID", `#${updated.customerNumber}`)}
          ${row("Name", fullName)}
          ${row("Email", updated.email)}
          ${row("Mobile", mobile)}
          ${row("Account type", accountType === AccountType.BUSINESS ? "Business" : "Personal")}
          ${row("Company", updated.companyName)}
          ${row("Market", updated.market?.name ?? updated.market?.key ?? "")}
        </table>
        <div style="text-align:center;margin-top:24px;">
          <a href="${adminUrl}" style="display:inline-block;background:${branding.primaryColor};color:#fff;font-size:13px;font-weight:700;padding:12px 28px;text-decoration:none;">Review Customer</a>
        </div>
      `;

      const resend = new Resend(apiKey);
      await resend.emails.send({
        from: emailCfg.from,
        to: salesAddr,
        subject: `New profile completed — ${fullName}${updated.companyName ? ` (${updated.companyName})` : ""}`,
        html: wrapEmailHtml({
          body: emailBody,
          portalName: branding.portalName,
          logoUrl: branding.logoUrl,
          primaryColor: branding.primaryColor,
        }),
      });
    }
  } catch (e) {
    console.error("[onboarding] admin email alert failed:", e);
  }

  return NextResponse.json({ ok: true });
}
