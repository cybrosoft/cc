// app/api/customer/rfq/attachment/route.ts
// GET — returns a signed URL for a specific attachment key on the customer's own RFQ.
// ?docId=xxx&key=sales/rfq/xxx.pdf
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { parseAttachments } from "@/lib/sales/attachments";
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

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const docId = req.nextUrl.searchParams.get("docId");
    const key   = req.nextUrl.searchParams.get("key");
    if (!docId) return NextResponse.json({ error: "docId required" }, { status: 400 });
    if (!key)   return NextResponse.json({ error: "key required" },   { status: 400 });

    // Verify RFQ belongs to this customer and the key is one of its attachments
    const doc = await prisma.salesDocument.findFirst({
      where:  { id: docId, customerId: user.id, type: "RFQ" },
      select: { rfqFileUrl: true },
    });

    if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const keys = parseAttachments(doc.rfqFileUrl);
    if (!keys.includes(key)) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });

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
