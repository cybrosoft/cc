// app/api/auth/totp/verify/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { verify } from "otplib";
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.TOTP_ENCRYPTION_KEY ?? "cybrosoft-totp-key-32-bytes-!!!";
const ALGORITHM = "aes-256-cbc";

function decrypt(encrypted: string): string {
  const [ivHex, dataHex] = encrypted.split(":");
  const key  = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
  const iv   = Buffer.from(ivHex, "hex");
  const data = Buffer.from(dataHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { code?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const token = String(body.code ?? "").replace(/\s/g, "").trim();
  if (!token || token.length !== 6) {
    return NextResponse.json({ error: "Invalid code." }, { status: 400 });
  }

  const dbUser = await prisma.user.findUnique({
    where:  { id: user.id },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!dbUser?.totpSecret) {
    return NextResponse.json({ error: "No TOTP setup in progress." }, { status: 400 });
  }
  if (dbUser.totpEnabled) {
    return NextResponse.json({ error: "TOTP is already enabled." }, { status: 400 });
  }

  let secret: string;
  try { secret = decrypt(dbUser.totpSecret); }
  catch { return NextResponse.json({ error: "Failed to read TOTP secret." }, { status: 500 }); }

  // v13 API - verify returns a VerifyResult object with .valid boolean
  const result = await verify({ secret, token });
  if (!result.valid) {
    return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data:  { totpEnabled: true },
  });

  return NextResponse.json({ ok: true });
}
