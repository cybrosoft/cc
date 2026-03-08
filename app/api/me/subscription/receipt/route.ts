export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { s3 } from "@/lib/storage/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function GET() {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const subscription = await prisma.subscription.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  if (!subscription || !subscription.receiptUrl) {
    return NextResponse.json({ ok: false, error: "NO_RECEIPT" }, { status: 404 });
  }

  const command = new GetObjectCommand({
    Bucket: process.env.SUPABASE_RECEIPTS_BUCKET!,
    Key: subscription.receiptUrl,
  });

  const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

  return NextResponse.json({
    ok: true,
    url: signedUrl,
  });
}