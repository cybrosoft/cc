// FILE: app/api/auth/signup/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOtp, getOtpExpiry, hashOtp } from "@/lib/otp";
import { sendOtpEmail } from "@/lib/email/send-otp";
import { AccountType } from "@prisma/client";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

function readBoolean(obj: Record<string, unknown>, key: string): boolean | null {
  const v = obj[key];
  return typeof v === "boolean" ? v : null;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getPendingSignupExpiry(): Date {
  return new Date(Date.now() + 30 * 60 * 1000);
}

function readAccountType(obj: Record<string, unknown>, key: string): AccountType | null {
  const v = obj[key];
  if (v === "BUSINESS") return AccountType.BUSINESS;
  if (v === "PERSONAL") return AccountType.PERSONAL;
  return null;
}

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => null)) as unknown;

    if (!raw || !isRecord(raw)) {
      return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
    }

    const normalizedEmail = normalizeEmail(String(readString(raw, "email") ?? ""));
    const marketId = String(readString(raw, "marketId") ?? "").trim();

    const fullName = String(readString(raw, "fullName") ?? "").trim();
    const mobile = String(readString(raw, "mobile") ?? "").trim();

    const accountType = readAccountType(raw, "accountType");

    const companyName = readString(raw, "companyName")?.trim() || null;
    const vatTaxId = readString(raw, "vatTaxId")?.trim() || null;
    const commercialRegistrationNumber = readString(raw, "commercialRegistrationNumber")?.trim() || null;

    const addressLine1 = readString(raw, "addressLine1")?.trim() || null;
    const addressLine2 = readString(raw, "addressLine2")?.trim() || null;
    const district = readString(raw, "district")?.trim() || null;
    const city = readString(raw, "city")?.trim() || null;

    const country = readString(raw, "country")?.trim() || null;
    const province = readString(raw, "province")?.trim() || null;

    const tcAccepted = readBoolean(raw, "tcAccepted");
    const privacyAccepted = readBoolean(raw, "privacyAccepted");
    const marketingAccepted = readBoolean(raw, "marketingAccepted");

    if (!normalizedEmail) {
      return NextResponse.json({ ok: false, error: "Email required." }, { status: 400 });
    }
    if (!marketId) {
      return NextResponse.json({ ok: false, error: "Market required." }, { status: 400 });
    }
    if (!fullName || !mobile) {
      return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
    }
    if (tcAccepted !== true || privacyAccepted !== true) {
      return NextResponse.json({ ok: false, error: "Terms & Privacy must be accepted." }, { status: 400 });
    }

    const market = await prisma.market.findFirst({
      where: { id: marketId, isActive: true },
      select: { id: true },
    });

    if (!market) {
      return NextResponse.json({ ok: false, error: "Invalid market." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json({ ok: true, userExists: true });
    }

    await prisma.pendingSignup.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        marketId: market.id,
        expiresAt: getPendingSignupExpiry(),

        fullName,
        mobile,
        accountType,

        companyName,
        vatTaxId,
        commercialRegistrationNumber,

        addressLine1,
        addressLine2,
        district,
        city,
        country,
        province,

        tcAccepted: true,
        privacyAccepted: true,
        marketingAccepted: marketingAccepted === true,
      },
      update: {
        marketId: market.id,
        expiresAt: getPendingSignupExpiry(),

        fullName,
        mobile,
        accountType,

        companyName,
        vatTaxId,
        commercialRegistrationNumber,

        addressLine1,
        addressLine2,
        district,
        city,
        country,
        province,

        tcAccepted: true,
        privacyAccepted: true,
        marketingAccepted: marketingAccepted === true,
      },
    });

    const code = generateOtp();
    const codeHash = hashOtp(normalizedEmail, code);

    await prisma.loginOtp.create({
      data: {
        email: normalizedEmail,
        codeHash,
        expiresAt: getOtpExpiry(),
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