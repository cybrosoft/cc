// lib/sales/invalidate-pdf.ts
// Call this from any PATCH route that edits a SalesDocument
// Deletes the cached PDF from S3 and clears pdfKey in DB
import { prisma } from "@/lib/prisma";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

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

export async function invalidatePdf(docId: string): Promise<void> {
  try {
    const docById = await prisma.salesDocument.findUnique({
      where:  { id: docId },
      select: { pdfKey: true },
    });

    if (!docById?.pdfKey) return;

    // Delete from S3
    await s3.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key:    docById.pdfKey,
    })).catch(() => { /* best-effort */ });

    // Clear pdfKey in DB
    await prisma.salesDocument.update({
      where: { id: docId },
      data:  { pdfKey: null },
    });
  } catch {
    // best-effort — don't fail the PATCH if this errors
  }
}
