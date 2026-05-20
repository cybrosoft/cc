// app/api/customer/sales/[id]/po-file/route.ts
// GET — generate signed URL for the PO file attached to a quotation.
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

// Sanitize key — strips JSON array brackets if stored incorrectly e.g. ["sales/doc/...pdf"]
function sanitizeKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && typeof parsed[0] === "string") return parsed[0];
    } catch { /**/ }
  }
  return trimmed;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const doc = await prisma.salesDocument.findFirst({
    where: {
      id:         params.id,
      customerId: user.id,
    },
    select: { rfqFileUrl: true },
  });

  if (!doc)            return NextResponse.json({ error: "Not found" },       { status: 404 });
  if (!doc.rfqFileUrl) return NextResponse.json({ error: "No PO attached" }, { status: 404 });

  const key = sanitizeKey(doc.rfqFileUrl);

  const url = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 3600 }
  );

  return NextResponse.json({ ok: true, url });
}
