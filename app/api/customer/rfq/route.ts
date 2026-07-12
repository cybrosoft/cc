// app/api/customer/rfq/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { invalidateCustomer } from "@/lib/cache/customer-cache";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { parseAttachments, serializeAttachments } from "@/lib/sales/attachments";
import { randomUUID } from "crypto";
import { Resend } from "resend";
import { getEmailConfig } from "@/lib/email/email-config";
import { wrapEmailHtml, loadEmailBranding } from "@/lib/email/templates";

const s3 = new S3Client({
  region:   process.env.SUPABASE_S3_REGION!,
  endpoint: process.env.SUPABASE_S3_ENDPOINT!,
  credentials: {
    accessKeyId:     process.env.SUPABASE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});
const BUCKET = process.env.SUPABASE_S3_BUCKET ?? "uploads";

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf":                                                          "pdf",
  "image/png":                                                                "png",
  "image/jpeg":                                                               "jpg",
  "image/jpg":                                                                "jpg",
  "application/msword":                                                       "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel":                                                 "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":       "xlsx",
};

async function allocateDocNum(marketId: string): Promise<string> {
  const series = await prisma.numberSeries.findUnique({
    where: { marketId_docType: { marketId, docType: "RFQ" } },
  });
  if (!series) throw new Error("Number series not configured for RFQ in this market. Please contact support.");
  await prisma.numberSeries.update({
    where: { marketId_docType: { marketId, docType: "RFQ" } },
    data:  { nextNum: { increment: 1 } },
  });
  return `${series.prefix}-${series.nextNum}`;
}

async function uploadFile(file: File, prefix = "sales/rfq"): Promise<string> {
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) throw new Error(`Unsupported file type: ${file.type}`);
  if (file.size > 10 * 1024 * 1024) throw new Error("File too large — max 10 MB");
  const buffer = Buffer.from(await file.arrayBuffer());
  const key    = `${prefix}/${randomUUID()}.${ext}`;
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: file.type }));
  return key;
}

// ── POST — submit new RFQ ─────────────────────────────────────────────────────
// Customer-submitted RFQs are always visibleToCustomer: true
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let title = "";
  let notes = "";
  const uploadedKeys: string[] = [];
  const emailAttachments: { filename: string; content: string }[] = [];

  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

    title = String(form.get("title") ?? "").trim();
    notes = String(form.get("notes") ?? "").trim();

    const files = form.getAll("files").concat(form.getAll("file"))
      .filter((f): f is File => f instanceof File && f.size > 0);

    for (const file of files) {
      try {
        const key = await uploadFile(file);
        uploadedKeys.push(key);
        // Keep buffer for the sales alert email attachment
        emailAttachments.push({
          filename: file.name,
          content:  Buffer.from(await file.arrayBuffer()).toString("base64"),
        });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }
  } else {
    try {
      const body = await req.json();
      title = String(body.title ?? "").trim();
      notes = String(body.notes ?? "").trim();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
  }

  if (!title) return NextResponse.json({ error: "Title is required" }, { status: 400 });

  const fullUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { id: true, marketId: true, market: { select: { key: true, defaultCurrency: true } } },
  });
  if (!fullUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let docNum: string;
  try { docNum = await allocateDocNum(fullUser.marketId); }
  catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed to allocate number" }, { status: 500 });
  }

  const doc = await prisma.salesDocument.create({
    data: {
      docNum,
      type:               "RFQ",
      status:             "PENDING",
      marketId:           fullUser.marketId,
      customerId:         user.id,
      currency:           fullUser.market.defaultCurrency,
      rfqTitle:           title,
      notes:              notes || null,
      rfqFileUrl:         serializeAttachments(uploadedKeys),
      visibleToCustomer:  true, // customer-submitted RFQs are always visible
      issueDate:          new Date(),
      subtotal:   0,
      vatPercent: 0,
      vatAmount:  0,
      total:      0,
    },
    select: { id: true, docNum: true },
  });

  await prisma.salesDocumentLog.create({
    data: {
      documentId:  doc.id,
      field:       "status",
      oldValue:    null,
      newValue:    "PENDING",
      note:        "RFQ submitted by customer via portal",
      changedById: user.id,
    },
  });

  try {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map(admin => ({
          userId:    admin.id,
          type:      "INFO" as const,
          title:     "New RFQ received",
          body:      `${user.fullName ?? user.email} submitted RFQ ${doc.docNum}: "${title}"`,
          link:      `/admin/sales/rfq/${doc.id}`,
          eventType: "RFQ_SUBMITTED",
        })),
      });
    }
  } catch { /* non-critical */ }

  // Email alert to sales inbox — non-blocking
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (apiKey) {
      const [emailCfg, branding] = await Promise.all([
        getEmailConfig("sales", fullUser.market.key),
        loadEmailBranding(),
      ]);

      const salesAddr = emailCfg.from.match(/<(.+)>/)?.[1] ?? emailCfg.from;
      const adminUrl  = `${branding.baseUrl}/admin/sales/rfq/${doc.id}`;

      const emailBody = `
        <h2 style="color:${branding.primaryColor};margin:0 0 8px;">New RFQ received</h2>
        <p style="margin:0 0 16px;">A customer has submitted a new request for quotation via the portal.</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;width:120px;">RFQ</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-weight:600;font-family:monospace;">${doc.docNum}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;">Customer</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;font-weight:600;">${user.fullName ?? user.email}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;">Email</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">${user.email}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;">Title</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">${title}</td></tr>
          ${notes ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;vertical-align:top;">Notes</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">${notes}</td></tr>` : ""}
          ${uploadedKeys.length > 0 ? `<tr><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;color:#9ca3af;">Attachments</td><td style="padding:8px 0;border-bottom:1px solid #f3f4f6;">${uploadedKeys.length} file${uploadedKeys.length > 1 ? "s" : ""}</td></tr>` : ""}
        </table>
        <div style="text-align:center;margin-top:24px;">
          <a href="${adminUrl}" style="display:inline-block;background:${branding.primaryColor};color:#fff;font-size:13px;font-weight:700;padding:12px 28px;text-decoration:none;">Open RFQ</a>
        </div>
      `;

      const resend = new Resend(apiKey);
      await resend.emails.send({
        from:    emailCfg.from,
        to:      salesAddr,
        subject: `New RFQ ${doc.docNum} — ${title}`,
        html: wrapEmailHtml({
          body:         emailBody,
          portalName:   branding.portalName,
          logoUrl:      branding.logoUrl,
          primaryColor: branding.primaryColor,
        }),
        ...(emailAttachments.length > 0 ? { attachments: emailAttachments } : {}),
      });
    }
  } catch (e) {
    console.error("[customer rfq] sales email alert failed:", e);
  }

  await invalidateCustomer(user.id);
  return NextResponse.json({ ok: true, docNum: doc.docNum, id: doc.id }, { status: 201 });
}

// ── GET — list customer's own visible RFQs ────────────────────────────────────
// Only returns RFQs where visibleToCustomer = true
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rfqs = await prisma.salesDocument.findMany({
    where:   {
      customerId:        user.id,
      type:              "RFQ",
      visibleToCustomer: true,  // ← only show visible ones
    },
    orderBy: { createdAt: "desc" },
    take:    50,
    select: {
      id: true, docNum: true, status: true,
      rfqTitle: true, notes: true, rfqFileUrl: true,
      issueDate: true, createdAt: true,
      derivedDocs: {
        where:  { type: "QUOTATION", status: { notIn: ["DRAFT", "VOID"] } },
        select: { id: true, docNum: true, type: true, status: true },
        take:   1,
      },
    },
  });

  return NextResponse.json({
    rfqs: rfqs.map(r => ({
      id:          r.id,
      docNum:      r.docNum,
      status:      String(r.status),
      title:       r.rfqTitle ?? null,
      notes:       r.notes    ?? null,
      attachments: parseAttachments(r.rfqFileUrl),
      issueDate:   r.issueDate.toISOString(),
      createdAt:   r.createdAt.toISOString(),
      quotation:   r.derivedDocs[0]
        ? { id: r.derivedDocs[0].id, docNum: r.derivedDocs[0].docNum, status: String(r.derivedDocs[0].status) }
        : null,
    })),
  });
}
