// FILE: app/api/auth/otp/request/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOtp, hashOtp, getOtpExpiry } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email/send-otp";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: unknown };
    const normalizedEmail = normalizeEmail(String(body?.email ?? ""));

    // Always generic OK to avoid enumeration
    const ok = () => NextResponse.json({ ok: true });

    if (!normalizedEmail) return ok();

    // Only allow existing users (your original behavior)
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (!user) {
      // prevent enumeration
      return ok();
    }

    const code = generateOtp();
    const codeHash = hashOtp(normalizedEmail, code);

    await prisma.loginOtp.create({
      data: {
        email: normalizedEmail,
        codeHash,
        expiresAt: getOtpExpiry(),
        attemptCount: 0, // ✅ REQUIRED (fix)
      },
    });

    await sendOtpEmail(normalizedEmail, code);

    return ok();
  } catch (e: unknown) {
    // still return ok to avoid leaking whether email exists
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/auth/otp/request] error:", msg);
    return NextResponse.json({ ok: true });
  }
}