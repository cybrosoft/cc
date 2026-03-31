// FILE: app/api/auth/totp/challenge/route.ts
// Called after email OTP is verified and user has TOTP enabled.
// Verifies the TOTP code and creates the real session.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verify } from "otplib";
import { Role } from "@prisma/client";
import crypto from "crypto";
import { cookies } from "next/headers";

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

function getSessionExpiry(): Date { return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); }
function newSessionToken(): string { return crypto.randomBytes(32).toString("hex"); }
function getDashboardUrl(marketKey: string): string {
  return marketKey?.toLowerCase() === "saudi" ? "/sa/dashboard" : "/dashboard";
}

export async function POST(req: NextRequest) {
  try {
    let body: { code?: string } = {};
    try { body = await req.json(); } catch { /* ignore */ }

    const totpCode = String(body.code ?? "").replace(/\s/g, "").trim();
    if (!totpCode || totpCode.length !== 6) {
      return NextResponse.json({ ok: false, error: "Enter the 6-digit code from your authenticator app." }, { status: 400 });
    }

    // Read pending token from cookie
    const cookieStore = await cookies();
    const pendingToken = cookieStore.get("totp_pending")?.value ?? "";
    if (!pendingToken) {
      return NextResponse.json({ ok: false, error: "Session expired. Please sign in again." }, { status: 401 });
    }

    // Find the pending session
    const pendingSession = await prisma.session.findFirst({
      where: {
        token:     "pending:" + pendingToken,
        expiresAt: { gt: new Date() },
      },
      select: { id: true, userId: true },
    });

    if (!pendingSession) {
      return NextResponse.json({ ok: false, error: "Session expired. Please sign in again." }, { status: 401 });
    }

    // Get user with TOTP secret
    const user = await prisma.user.findUnique({
      where:  { id: pendingSession.userId },
      select: {
        id: true, role: true, totpSecret: true, totpEnabled: true,
        market: { select: { key: true } },
      },
    });

    if (!user?.totpEnabled || !user?.totpSecret) {
      return NextResponse.json({ ok: false, error: "TOTP not configured." }, { status: 400 });
    }

    // Decrypt secret and verify code
    let secret: string;
    try { secret = decrypt(user.totpSecret); }
    catch { return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 }); }

    const result = await verify({ secret, token: totpCode });
    if (!result.valid) {
      return NextResponse.json({ ok: false, error: "Invalid code. Please try again." }, { status: 400 });
    }

    // TOTP valid — delete pending session, create real session
    const expiresAt = getSessionExpiry();
    const token     = newSessionToken();

    await prisma.session.delete({ where: { id: pendingSession.id } });

    const session = await prisma.session.create({
      data:   { userId: user.id, expiresAt, token },
      select: { id: true },
    });

    const redirectTo = (user.role === Role.ADMIN || user.role === Role.STAFF)
      ? "/admin"
      : getDashboardUrl(user.market.key);

    const res = NextResponse.json({ ok: true, redirectTo });

    // Set real session cookie
    res.cookies.set("sid", session.id, {
      httpOnly: true, sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/", expires: expiresAt,
    });

    // Clear pending cookie
    res.cookies.set("totp_pending", "", {
      httpOnly: true, sameSite: "lax", path: "/", maxAge: 0,
    });

    return res;

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/auth/totp/challenge] error:", msg);
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}
