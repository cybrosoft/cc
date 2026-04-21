// app/api/admin/sales/[id]/send-email/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { Resend } from "resend";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { generatePrintToken } from "@/lib/sales/print-token";
import { DOC_TYPE_LABEL, fmtAmount, fmtDate } from "@/lib/sales/document-helpers";
import { getEmailConfig } from "@/lib/email/email-config";

const s3pdf = new S3Client({
  region:   process.env.SUPABASE_S3_REGION!,
  endpoint: process.env.SUPABASE_S3_ENDPOINT!,
  credentials: {
    accessKeyId:     process.env.SUPABASE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});
const BUCKET_PDF = process.env.SUPABASE_S3_BUCKET ?? "uploads";

const PERIOD_LABEL: Record<string, string> = {
  MONTHLY: "Monthly", SIX_MONTHS: "6 Months",
  YEARLY: "Yearly",   ONE_TIME: "One-time",
};

// Billing docs → billing@, Sales docs → sales@
const EMAIL_TYPE_MAP: Record<string, "billing" | "sales"> = {
  INVOICE:       "billing",
  PROFORMA:      "billing",
  CREDIT_NOTE:   "billing",
  QUOTATION:     "sales",
  RFQ:           "sales",
  DELIVERY_NOTE: "sales",
  PO:            "sales",
};

async function logStatusChange(docId: string, oldStatus: string, newStatus: string, note: string, changedById: string) {
  try {
    await prisma.salesDocumentLog.create({
      data: { documentId: docId, field: "status", oldValue: oldStatus, newValue: newStatus, note, changedById },
    });
  } catch { /* best-effort */ }
}

// ── Helper: get PDF buffer ────────────────────────────────────────────────────
// Priority:
//   1. officialInvoiceUrl — uploaded Saudi official PDF (S3 key)
//   2. pdfKey             — cached Puppeteer-generated PDF (S3 key)
//   3. Puppeteer          — generate fresh
async function getPdfBuffer(
  docId:               string,
  docNum:              string,
  pdfKey:              string | null,
  officialInvoiceUrl:  string | null = null,
): Promise<Buffer | null> {
  try {
    // 1. Saudi official invoice — use uploaded file as attachment
    if (officialInvoiceUrl) {
      const cmd = new GetObjectCommand({ Bucket: BUCKET_PDF, Key: officialInvoiceUrl });
      const res = await s3pdf.send(cmd);
      const chunks: Uint8Array[] = [];
      const stream = res.Body as any;
      for await (const chunk of stream) chunks.push(chunk);
      return Buffer.concat(chunks);
    }

    // 2. Cached Puppeteer PDF
    if (pdfKey) {
      const cmd = new GetObjectCommand({ Bucket: BUCKET_PDF, Key: pdfKey });
      const res = await s3pdf.send(cmd);
      const chunks: Uint8Array[] = [];
      const stream = res.Body as any;
      for await (const chunk of stream) chunks.push(chunk);
      return Buffer.concat(chunks);
    }

    // 3. Generate via Puppeteer
    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const token    = generatePrintToken(docId);
    const printUrl = `${baseUrl}/print/sales/${docId}?token=${token}`;

    const puppeteer = await import("puppeteer");
    const browser   = await puppeteer.default.launch({
      headless: true,
      args: ["--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage","--disable-gpu"],
    });

    try {
      const page = await browser.newPage();
      await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30000 });
      await page.waitForSelector("body", { timeout: 10000 });
      await new Promise(r => setTimeout(r, 800));
      const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" } });
      const buf = Buffer.from(pdf);
      const key = `sales-docs/${docNum}.pdf`;
      await s3pdf.send(new PutObjectCommand({ Bucket: BUCKET_PDF, Key: key, Body: buf, ContentType: "application/pdf" }));
      return buf;
    } finally {
      await browser.close();
    }
  } catch (e) {
    console.error("[send-email] PDF generation failed:", e);
    return null;
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const body   = await req.json().catch(() => ({}));
    const mode   = (body.mode ?? "default") as "default" | "resend" | "reminder" | "custom" | "mark_as_sent";

    const doc = await prisma.salesDocument.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, fullName: true, email: true } },
        market: {
          select: {
            key: true, name: true, defaultCurrency: true,
            legalInfo: true, companyProfile: true,
            showPayOnline: true, stripePublicKey: true,
          },
        },
        lines:    { orderBy: { sortOrder: "asc" } },
        payments: { orderBy: { paidAt: "desc" } },
      },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // ── Mark as Sent ──────────────────────────────────────────────────────────
    if (mode === "mark_as_sent") {
      const now = new Date();
      const statusUpdates: Array<{ from: string; to: string }> = [];
      let currentStatus = doc.status;
      if (currentStatus === "DRAFT")  { statusUpdates.push({ from: "DRAFT",  to: "ISSUED" }); currentStatus = "ISSUED"; }
      if (currentStatus === "ISSUED") { statusUpdates.push({ from: "ISSUED", to: "SENT"   }); currentStatus = "SENT";   }

      await prisma.salesDocument.update({
        where: { id },
        data: {
          emailSentAt: now, emailSentCount: { increment: 1 }, manualSent: true,
          ...(statusUpdates.length > 0 ? { status: currentStatus as any } : {}),
        },
      });

      for (const s of statusUpdates) await logStatusChange(id, s.from, s.to, "Auto-advanced on mark as sent", auth.user.id);

      await prisma.auditLog.create({
        data: {
          actorUserId: auth.user.id, action: "SALES_DOCUMENT_MARKED_AS_SENT",
          entityType: "SalesDocument", entityId: id,
          metadataJson: JSON.stringify({ docNum: doc.docNum, statusAdvanced: currentStatus }),
        },
      });

      return NextResponse.json({
        ok: true, emailSentAt: now.toISOString(),
        emailSentCount: (doc.emailSentCount ?? 0) + 1, manualSent: true,
      });
    }

    // ── All other modes — actual email send ───────────────────────────────────
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Email not configured — RESEND_API_KEY missing" }, { status: 500 });

    if (mode === "reminder") {
      if (doc.type !== "INVOICE") return NextResponse.json({ error: "Reminders are only available for invoices" }, { status: 400 });
      const unpaidStatuses = ["ISSUED", "SENT", "PARTIALLY_PAID", "OVERDUE"];
      if (!unpaidStatuses.includes(doc.status)) return NextResponse.json({ error: "Reminders can only be sent for unpaid invoices" }, { status: 400 });
      if ((doc.reminderCount ?? 0) >= 4) return NextResponse.json({ error: "Maximum 4 reminders already sent" }, { status: 400 });
    }

    const li       = (doc.market.legalInfo ?? {}) as Record<string, any>;
    const cp       = (doc.market.companyProfile ?? {}) as Record<string, any>;
    const currency = doc.currency;
    const fromName = li.companyName ?? doc.market.name;

    const emailType  = EMAIL_TYPE_MAP[doc.type] ?? "sales";
    const emailCfg   = await getEmailConfig(emailType, doc.market.key);
    const fromDisplayName = emailCfg.from.split(" <")[0] || fromName;

    // Addresses
    let toAddr  = doc.customer.email;
    let ccAddr  = "";
    let bccAddr = emailCfg.bcc ?? "";
    let replyTo = emailCfg.replyTo ?? "";

    if (mode === "custom") {
      toAddr  = body.to      ?? toAddr;
      ccAddr  = body.cc      ?? "";
      bccAddr = body.bcc     ?? bccAddr;
      if (body.saveDefaults) {
        // persist custom defaults back to DB if needed — omitted for brevity
      }
    }

    // Subject
    const docLabel  = (DOC_TYPE_LABEL as any)[doc.type] ?? doc.type;
    const baseSubject = `${docLabel} ${doc.docNum}`;
    let subject = mode === "resend"   ? `Reminder: ${baseSubject}`
                : mode === "reminder" ? `Payment Reminder: ${baseSubject}`
                : mode === "custom"   ? (body.customSubject ?? baseSubject)
                : baseSubject;

    // Totals
    const totalPaid  = (doc.payments ?? []).reduce((s: number, p: any) => s + p.amountCents, 0);
    const balanceDue = doc.total - totalPaid;

    // Bank details HTML
    const bd = li.bankDetails ?? {};
    const bankHtml = bd.bankName
      ? `<tr><td style="padding:16px 32px 0;">
          <div style="background:#f9fafb;border:1px solid #e5e7eb;padding:14px 16px;font-size:12px;">
            <div style="font-weight:700;color:#111827;margin-bottom:8px;">Bank Transfer Details</div>
            ${bd.bankName    ? `<div style="color:#6b7280;margin-bottom:4px;">Bank: <span style="color:#111827;font-weight:600;">${bd.bankName}</span></div>` : ""}
            ${bd.accountName ? `<div style="color:#6b7280;margin-bottom:4px;">Account Name: <span style="color:#111827;font-weight:600;">${bd.accountName}</span></div>` : ""}
            ${bd.iban        ? `<div style="color:#6b7280;margin-bottom:4px;">IBAN: <span style="color:#111827;font-weight:600;font-family:monospace;">${bd.iban}</span></div>` : ""}
            ${bd.swift       ? `<div style="color:#6b7280;margin-bottom:4px;">SWIFT: <span style="color:#111827;font-weight:600;font-family:monospace;">${bd.swift}</span></div>` : ""}
            ${bd.currency    ? `<div style="color:#6b7280;">Currency: <span style="color:#111827;font-weight:600;">${bd.currency}</span></div>` : ""}
          </div>
        </td></tr>`
      : "";

    // Pay Online button
    const baseUrl       = process.env.NEXT_PUBLIC_BASE_URL ?? "https://console.cybrosoft.com";
    const marketPrefix  = doc.market.key === "SAUDI" ? "/sa" : "";
    const payUrl        = `${baseUrl}${marketPrefix}/dashboard/invoices/${doc.id}`;
    const payButtonHtml = (doc.market.showPayOnline && balanceDue > 0)
      ? `<tr><td style="padding:16px 32px 0;text-align:center;">
          <a href="${payUrl}" style="display:inline-block;background:#318774;color:#fff;font-size:13px;font-weight:700;padding:12px 28px;text-decoration:none;">Pay Online</a>
        </td></tr>`
      : "";

    // Line items HTML
    const linesHtml = (doc.lines ?? []).map((ln: any) =>
      `<tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:8px 12px;font-size:13px;">${ln.description}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:center;">${ln.billingPeriod ? PERIOD_LABEL[ln.billingPeriod] ?? ln.billingPeriod : ""}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:right;">${Number(ln.quantity)}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:right;">${fmtAmount(ln.unitPrice, currency)}</td>
        <td style="padding:8px 12px;font-size:13px;text-align:right;font-weight:600;">${fmtAmount(ln.lineTotal, currency)}</td>
      </tr>`
    ).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0;">
<tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e5e7eb;max-width:600px;width:100%;">

    <!-- Header -->
    <tr><td style="padding:28px 32px;background:#318774;">
      <div style="color:#fff;font-size:20px;font-weight:700;">${fromDisplayName}</div>
      ${li.tagline ? `<div style="color:#a7f3d0;font-size:12px;margin-top:4px;">${li.tagline}</div>` : ""}
    </td></tr>

    <!-- Doc info -->
    <tr><td style="padding:24px 32px 0;">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:16px;">
        <div>
          <div style="font-size:22px;font-weight:700;color:#111827;">${docLabel}</div>
          <div style="font-size:13px;color:#6b7280;margin-top:4px;">${doc.docNum}</div>
        </div>
        <div style="text-align:right;">
          ${doc.issueDate ? `<div style="font-size:12px;color:#6b7280;">Date: <strong>${fmtDate(doc.issueDate)}</strong></div>` : ""}
          ${doc.dueDate   ? `<div style="font-size:12px;color:#6b7280;margin-top:2px;">Due: <strong style="color:#dc2626;">${fmtDate(doc.dueDate)}</strong></div>` : ""}
        </div>
      </div>
    </td></tr>

    <!-- Bill To -->
    <tr><td style="padding:16px 32px 0;">
      <div style="font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">Bill To</div>
      <div style="font-size:13px;font-weight:600;color:#111827;">${doc.customer.fullName ?? ""}</div>
      <div style="font-size:12px;color:#6b7280;">${doc.customer.email}</div>
    </td></tr>

    <!-- Line Items -->
    <tr><td style="padding:20px 32px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;">
        <thead>
          <tr style="background:#f9fafb;">
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;">Description</th>
            <th style="padding:10px 12px;text-align:center;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;">Period</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;">Qty</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;">Unit Price</th>
            <th style="padding:10px 12px;text-align:right;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;">Total</th>
          </tr>
        </thead>
        <tbody>${linesHtml}</tbody>
        <tfoot>
          <tr><td colspan="4" style="padding:6px 12px;text-align:right;font-size:12px;color:#6b7280;">Subtotal</td>
              <td style="padding:6px 12px;text-align:right;font-size:12px;">${fmtAmount(doc.subtotal, currency)}</td></tr>
          ${Number(doc.vatPercent) > 0
            ? `<tr><td colspan="4" style="padding:6px 12px;text-align:right;font-size:12px;color:#6b7280;">VAT (${Number(doc.vatPercent)}%)</td><td style="padding:6px 12px;text-align:right;font-size:12px;">${fmtAmount(doc.vatAmount, currency)}</td></tr>`
            : ""}
          <tr style="background:#f9fafb;"><td colspan="4" style="padding:10px 12px;text-align:right;font-size:14px;font-weight:700;">Total</td><td style="padding:10px 12px;text-align:right;font-size:14px;font-weight:700;color:#318774;">${fmtAmount(doc.total, currency)}</td></tr>
          ${totalPaid > 0 ? `<tr><td colspan="4" style="padding:6px 12px;text-align:right;font-size:12px;color:#15803d;">Paid</td><td style="padding:6px 12px;text-align:right;font-size:12px;color:#15803d;">− ${fmtAmount(totalPaid, currency)}</td></tr>` : ""}
          ${balanceDue > 0 && totalPaid > 0 ? `<tr style="background:#fef9c3;"><td colspan="4" style="padding:10px 12px;text-align:right;font-size:14px;font-weight:700;color:#92400e;">Balance Due</td><td style="padding:10px 12px;text-align:right;font-size:14px;font-weight:700;color:#92400e;">${fmtAmount(balanceDue, currency)}</td></tr>` : ""}
        </tfoot>
      </table>
      ${doc.notes ? `<p style="font-size:12px;color:#6b7280;margin:8px 0 0;padding:10px 14px;background:#f9fafb;border-left:2px solid #d1d5db;">${doc.notes}</p>` : ""}
      ${bankHtml}
    </td></tr>

    ${payButtonHtml}

    <!-- Footer -->
    <tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="font-size:11px;color:#9ca3af;text-align:center;margin:0;">
        ${li.footerText ?? `${fromDisplayName}${li.email ? ` · ${li.email}` : ""}`}
      </p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;

    const resend    = new Resend(apiKey);

    // Get PDF attachment — official uploaded PDF takes priority for Saudi INVOICE/CREDIT_NOTE
    const pdfBuffer = await getPdfBuffer(
      id,
      doc.docNum,
      (doc as any).pdfKey ?? null,
      (doc as any).officialInvoiceUrl ?? null,
    );

    const { error: sendError } = await resend.emails.send({
      ...emailCfg,
      to:      toAddr,
      subject,
      html,
      ...(ccAddr  ? { cc:  ccAddr }  : {}),
      ...(bccAddr ? { bcc: bccAddr } : {}),
      ...(pdfBuffer ? { attachments: [{ filename: `${doc.docNum}.pdf`, content: pdfBuffer.toString("base64") }] } : {}),
    });

    if (sendError) {
      console.error("[send-email] Resend error:", sendError);
      return NextResponse.json({ error: sendError.message }, { status: 500 });
    }

    // Auto-advance status
    const statusUpdates: Array<{ from: string; to: string }> = [];
    let currentStatus = doc.status;
    if (currentStatus === "DRAFT")  { statusUpdates.push({ from: "DRAFT",  to: "ISSUED" }); currentStatus = "ISSUED"; }
    if (currentStatus === "ISSUED") { statusUpdates.push({ from: "ISSUED", to: "SENT"   }); currentStatus = "SENT";   }

    const updateData: Record<string, any> = {
      emailSentAt: new Date(), emailSentCount: { increment: 1 }, manualSent: false,
      ...(statusUpdates.length > 0 ? { status: currentStatus as any } : {}),
    };
    if (mode === "reminder") { updateData.reminderCount = { increment: 1 }; updateData.reminderLastSentAt = new Date(); }

    await prisma.salesDocument.update({ where: { id }, data: updateData });
    for (const s of statusUpdates) await logStatusChange(id, s.from, s.to, `Auto-advanced on email send (mode: ${mode})`, auth.user.id);

    await prisma.auditLog.create({
      data: {
        actorUserId: auth.user.id, action: "SALES_DOCUMENT_EMAIL_SENT",
        entityType: "SalesDocument", entityId: id,
        metadataJson: JSON.stringify({ docNum: doc.docNum, mode, emailType, to: toAddr, cc: ccAddr ?? null, bcc: bccAddr ?? null, subject, statusAdvanced: statusUpdates.length > 0 ? currentStatus : null }),
      },
    });

    return NextResponse.json({
      ok: true, emailSentAt: new Date().toISOString(),
      emailSentCount: (doc.emailSentCount ?? 0) + 1, manualSent: false,
      reminderCount: mode === "reminder" ? (doc.reminderCount ?? 0) + 1 : undefined,
    });

  } catch (e: any) {
    console.error("[send-email] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
