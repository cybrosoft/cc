// FILE: app/api/auth/signup/route.ts
// Updated for Step 10 minimal signup flow:
// - Accepts marketKey ("saudi" | "global") instead of marketId
// - fullName, mobile, tcAccepted no longer required at signup (collected in Onboarding Wizard)
// - Only email + marketKey required
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOtp, getOtpExpiry, hashOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email/send-otp";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getPendingSignupExpiry(): Date {
  // 30 minutes — enough time to complete OTP + onboarding
  return new Date(Date.now() + 30 * 60 * 1000);
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => null)) as unknown;

    if (!raw || !isRecord(raw)) {
      return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(String(readString(raw, "email") ?? ""));

    // Accept marketKey ("saudi" | "global") — uppercase to match DB keys (SAUDI, GLOBAL)
    const marketKey = readString(raw, "marketKey")?.trim().toUpperCase() || null;
    const marketId  = readString(raw, "marketId")?.trim() || null;

    if (!normalizedEmail) {
      return NextResponse.json({ ok: false, error: "Email is required." }, { status: 400 });
    }

    if (!marketKey && !marketId) {
      return NextResponse.json({ ok: false, error: "Market is required." }, { status: 400 });
    }

    // Resolve market record
    const market = await prisma.market.findFirst({
      where: marketKey
        ? { key: marketKey, isActive: true }
        : { id: marketId!, isActive: true },
      select: { id: true, key: true },
    });

    if (!market) {
      return NextResponse.json({ ok: false, error: "Market not found." }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where:  { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json({ ok: true, userExists: true });
    }

    // Create or update pending signup — only email + marketId required now
    // All other fields (name, mobile, address, T&C) collected in Onboarding Wizard
    await prisma.pendingSignup.upsert({
      where:  { email: normalizedEmail },
      create: {
        email:     normalizedEmail,
        marketId:  market.id,
        expiresAt: getPendingSignupExpiry(),
      },
      update: {
        marketId:  market.id,
        expiresAt: getPendingSignupExpiry(),
      },
    });

    // Generate and send OTP
    const code     = generateOtp();
    const codeHash = hashOtp(normalizedEmail, code);

    await prisma.loginOtp.create({
      data: {
        email:        normalizedEmail,
        codeHash,
        expiresAt:    getOtpExpiry(),
        attemptCount: 0,
      },
    });

    await sendOtpEmail(normalizedEmail, code);

    return NextResponse.json({ ok: true, userExists: false });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[signup] error:", msg);
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 500 });
  }
}
