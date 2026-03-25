// app/api/admin/sales/[id]/pdf/route.ts
// GET — generate PDF via Puppeteer, cache to S3, return signed URL
// DELETE — invalidate cached PDF (called on document edit)
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { generatePrintToken } from "@/lib/sales/print-token";

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

// ── Helper: generate signed URL from S3 key ───────────────────────────────────
async function signedUrl(key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 3600 }
  );
}

// ── Helper: generate PDF buffer via Puppeteer ─────────────────────────────────
async function generatePdfBuffer(docId: string): Promise<Buffer> {
  const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const token    = generatePrintToken(docId);
  const printUrl = `${baseUrl}/print/sales/${docId}?token=${token}`;

  const puppeteer = await import("puppeteer");
  const browser   = await puppeteer.default.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-web-security",
    ],
  });

  try {
    const page = await browser.newPage();

    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30000 });

    // Wait for document content
    await page.waitForSelector("body", { timeout: 10000 });

    // Small settle delay for fonts/images
    await new Promise(r => setTimeout(r, 800));

    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });

    const pdf = await page.pdf({
      format:          "A4",
      printBackground: true,
      printBackground: true,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
      scale: 1,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ── GET /api/admin/sales/[id]/pdf ─────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const doc = await prisma.salesDocument.findUnique({
      where:  { id },
      select: { id: true, docNum: true, type: true, pdfKey: true },
    });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // ── Serve from cache if available ────────────────────────────────────────
    if (doc.pdfKey) {
      const url = await signedUrl(doc.pdfKey);
      return NextResponse.redirect(url);
    }

    // ── Generate fresh PDF ───────────────────────────────────────────────────
    const pdfBuffer = await generatePdfBuffer(id);

    // Upload to S3
    const key = `sales-docs/${doc.docNum}.pdf`;
    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        pdfBuffer,
      ContentType: "application/pdf",
    }));

    // Save key to DB
    await prisma.salesDocument.update({
      where: { id },
      data:  { pdfKey: key },
    });

    // Return signed URL redirect
    const url = await signedUrl(key);
    return NextResponse.redirect(url);

  } catch (e: any) {
    console.error("[pdf] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── DELETE /api/admin/sales/[id]/pdf — invalidate cache ───────────────────────
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const doc = await prisma.salesDocument.findUnique({
      where:  { id },
      select: { pdfKey: true },
    });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (doc.pdfKey) {
      // Delete from S3
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: doc.pdfKey })).catch(() => {});
      // Clear key in DB
      await prisma.salesDocument.update({
        where: { id },
        data:  { pdfKey: null },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
