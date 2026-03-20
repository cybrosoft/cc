// app/api/admin/sales/attachment/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
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
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const key = req.nextUrl.searchParams.get("key");
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 });

    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: 3600 } // 1 hour
    );

    return NextResponse.json({ ok: true, url: signedUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}