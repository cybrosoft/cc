// app/api/admin/sales/upload/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { s3 } from "@/lib/storage/s3";
import { randomUUID } from "crypto";

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

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

    const file    = form.get("file");
    const docType = String(form.get("docType") ?? "DOCUMENT").toUpperCase();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = ALLOWED_TYPES[file.type];
    if (!ext) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type}` }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large — max 10 MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key    = `sales/${docType.toLowerCase()}/${randomUUID()}.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      Body:        buffer,
      ContentType: file.type,
    }));

    const endpoint = process.env.SUPABASE_S3_ENDPOINT?.replace(/\/$/, "") ?? "";
    const url = `${endpoint}/${BUCKET}/${key}`;

    return NextResponse.json({ ok: true, url, key });
  } catch (e: any) {
    console.error("[sales/upload] error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}