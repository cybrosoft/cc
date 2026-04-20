// app/api/admin/sales/[id]/official-invoice/route.ts
// POST  — upload official invoice PDF to S3, save S3 key on document
// DELETE — remove official invoice PDF from S3, clear key on document

export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
  region:      process.env.SUPABASE_S3_REGION!,
  endpoint:    process.env.SUPABASE_S3_ENDPOINT!,
  credentials: {
    accessKeyId:     process.env.SUPABASE_S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.SUPABASE_S3_BUCKET!;

// ── POST — upload ─────────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const doc = await prisma.salesDocument.findUnique({
      where:  { id },
      select: {
        id: true, type: true, docNum: true,
        market:             { select: { key: true } },
        officialInvoiceUrl: true,
      },
    });

    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    if (!["INVOICE", "CREDIT_NOTE"].includes(doc.type)) {
      return NextResponse.json({ error: "Upload only allowed for INVOICE and CREDIT_NOTE" }, { status: 400 });
    }

    if (doc.market.key !== "SAUDI") {
      return NextResponse.json({ error: "Upload only for Saudi market" }, { status: 400 });
    }

    const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    if (!file)                            return NextResponse.json({ error: "No file provided" }, { status: 400 });
    if (file.type !== "application/pdf")  return NextResponse.json({ error: "Only PDF files allowed" }, { status: 400 });
    if (file.size > 10 * 1024 * 1024)    return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 });

    // Delete old file from S3 if exists
    if (doc.officialInvoiceUrl) {
      await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: doc.officialInvoiceUrl })).catch(() => {});
    }

    // Upload new file — store just the S3 key
    const buffer = Buffer.from(await file.arrayBuffer());
    const s3Key  = `official-invoices/${doc.docNum}-${Date.now()}.pdf`;

    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         s3Key,
      Body:        buffer,
      ContentType: "application/pdf",
    }));

    // Save S3 key (not full URL) — signed URL generated on the fly when serving
    await prisma.salesDocument.update({
      where: { id },
      data:  { officialInvoiceUrl: s3Key },
    });

    // Generate a signed URL for the "View" button in the UI
    const viewUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: s3Key }),
      { expiresIn: 3600 }
    );

    return NextResponse.json({ ok: true, officialInvoiceUrl: s3Key, viewUrl });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// ── DELETE — remove ───────────────────────────────────────────────────────────
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const doc = await prisma.salesDocument.findUnique({
      where:  { id },
      select: { id: true, officialInvoiceUrl: true },
    });

    if (!doc)                    return NextResponse.json({ error: "Document not found" }, { status: 404 });
    if (!doc.officialInvoiceUrl) return NextResponse.json({ ok: true });

    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: doc.officialInvoiceUrl })).catch(() => {});

    await prisma.salesDocument.update({
      where: { id },
      data:  { officialInvoiceUrl: null },
    });

    return NextResponse.json({ ok: true });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
