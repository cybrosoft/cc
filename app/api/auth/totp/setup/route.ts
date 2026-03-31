// app/api/auth/totp/setup/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { generateSecret, generateURI } from "otplib";
import QRCode from "qrcode";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY ?? "cybrosoft-totp-key-32-bytes-!!!";
const ALGORITHM = "aes-256-cbc";

function encrypt(text: string): string {
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // v13 API - generateSecret is sync
  const secret = generateSecret();

  // Encrypt and store (totpEnabled stays false until verified)
  await prisma.user.update({
    where: { id: user.id },
    data:  { totpSecret: encrypt(secret) },
  });

  // Generate OTP Auth URI for QR code - v13 uses generateURI
  const otpAuthUrl = generateURI({
    type:   "totp",
    label:  user.email,
    issuer: "Cybrosoft Console",
    secret,
  });

  const qrDataUrl = await QRCode.toDataURL(otpAuthUrl, {
    width: 200, margin: 1,
    color: { dark: "#111827", light: "#ffffff" },
  });

  return NextResponse.json({ ok: true, qrDataUrl, secret });
}
