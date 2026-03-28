// app/api/customer/sales/[id]/pdf/route.ts
// GET — serve PDF for a sales document owned by the current customer.
// Reuses cached S3 key if available, generates fresh via Puppeteer if not.
// Blocks DRAFT and WRITTEN_OFF documents entirely.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { generatePrintToken } from "@/lib/sales/print-token";

const s3 = new S3Client({
  region:      process.env.SUPABASE_S3_REGION!,
  endpoint:    process.env.SUPABASE_S3_ENDPOINT!,
  credentials: {
    accessKeyId:     process.env.SUPABASE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.SUPABASE_S3_BUCKET ?? "uploads";

async function signedUrl(key: string): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 3600 }
  );
}

async function generatePdfBuffer(docId: string): Promise<Buffer> {
  const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const token    = generatePrintToken(docId);
  const printUrl = `${baseUrl}/print/sales/${docId}?token=${token}`;

  const puppeteer = await import("puppeteer");
  const browser   = await puppeteer.default.launch({
    headless: true,
    args: [
      "--no-sandbox", "--disable-setuid-sandbox",
      "--disable-dev-shm-usage", "--disable-gpu",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 30000 });
    await page.waitForSelector("body", { timeout: 10000 });
    await new Promise(r => setTimeout(r, 800));
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    const pdf = await page.pdf({
      format: "A4", printBackground: true,
      margin: { top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const doc = await prisma.salesDocument.findFirst({
      where: {
        id:         params.id,
        customerId: user.id,                          // ownership check
        status:     { notIn: ["DRAFT", "WRITTEN_OFF"] }, // never expose drafts
      },
      select: { id: true, docNum: true, type: true, pdfKey: true },
    });

    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Serve from S3 cache if available
    if (doc.pdfKey) {
      const url = await signedUrl(doc.pdfKey);
      return NextResponse.redirect(url);
    }

    // Generate fresh PDF
    const pdfBuffer = await generatePdfBuffer(doc.id);

    const key = `sales-docs/${doc.docNum}.pdf`;
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET, Key: key,
      Body: pdfBuffer, ContentType: "application/pdf",
    }));

    await prisma.salesDocument.update({
      where: { id: doc.id },
      data:  { pdfKey: key },
    });

    const url = await signedUrl(key);
    return NextResponse.redirect(url);

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "PDF generation failed";
    console.error("[customer/pdf]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
