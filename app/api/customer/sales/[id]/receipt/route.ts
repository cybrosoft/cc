// app/api/customer/sales/[id]/receipt/route.ts
// GET ?key=payment-receipts/xxx.pdf
// Returns a signed URL for a payment receipt uploaded by this customer.
// Verifies the key is actually associated with a payment_notification log on this doc.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const key    = req.nextUrl.searchParams.get("key");
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

    // Verify doc belongs to this customer
    const doc = await prisma.salesDocument.findFirst({
      where: { id, customerId: user.id },
      select: { id: true },
    });
    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Verify the key actually belongs to a payment_notification log on this doc
    const log = await prisma.salesDocumentLog.findFirst({
      where: {
        documentId: id,
        field:      "payment_notification",
        newValue:   key,
      },
      select: { id: true },
    });
    if (!log) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: 3600 },
    );

    return NextResponse.json({ ok: true, url });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
