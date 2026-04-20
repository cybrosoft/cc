// app/api/admin/sales/[id]/official-invoice/view/route.ts
// GET — return a signed URL for viewing the official invoice PDF
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
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

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;

    const doc = await prisma.salesDocument.findUnique({
      where:  { id },
      select: { officialInvoiceUrl: true },
    });

    if (!doc?.officialInvoiceUrl) return NextResponse.json({ error: "No official invoice" }, { status: 404 });

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: doc.officialInvoiceUrl }),
      { expiresIn: 3600 }
    );

    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
