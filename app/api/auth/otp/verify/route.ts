// FILE: app/api/auth/otp/verify/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashOtp } from "@/lib/otp";
import { Role } from "@prisma/client";
import crypto from "crypto";

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

function normalizeCode(code: string): string {
  return code.replace(/\s+/g, "").trim();
}

function getSessionExpiry(): Date {
  // 30 days
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

function newSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

type VerifyOk = { ok: true; redirectTo: string };
type VerifyErr = { ok: false; error: string };
type VerifyResp = VerifyOk | VerifyErr;

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => null)) as unknown;
    if (!raw || !isRecord(raw)) {
      return NextResponse.json<VerifyResp>({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
    }

    const email = normalizeEmail(String(readString(raw, "email") ?? ""));
    const code = normalizeCode(String(readString(raw, "code") ?? ""));

    if (!email || !code) {
      return NextResponse.json<VerifyResp>({ ok: false, error: "INVALID_CODE" }, { status: 400 });
    }

    const now = new Date();

    // IMPORTANT: More than one OTP can exist. Accept any valid (unconsumed + unexpired).
    const otps = await prisma.loginOtp.findMany({
      where: {
        email,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, codeHash: true, attemptCount: true },
    });

    if (otps.length === 0) {
      return NextResponse.json<VerifyResp>({ ok: false, error: "INVALID_CODE" }, { status: 400 });
    }

    // Match OTP
    const expectedHash = hashOtp(email, code);
    const matched = otps.find((o) => o.codeHash === expectedHash) ?? null;

    if (!matched) {
      // increment attempt on newest (best effort)
      await prisma.loginOtp.update({
        where: { id: otps[0].id },
        data: { attemptCount: otps[0].attemptCount + 1 },
      });

      return NextResponse.json<VerifyResp>({ ok: false, error: "INVALID_CODE" }, { status: 400 });
    }

    const expiresAt = getSessionExpiry();
    const token = newSessionToken(); // Session.token is REQUIRED in your schema

    const result = await prisma.$transaction(async (tx) => {
      // Ensure user exists (login OR finalize signup)
      let user = await tx.user.findUnique({
        where: { email },
        select: { id: true, role: true },
      });

      if (!user) {
        const pending = await tx.pendingSignup.findUnique({
          where: { email },
          select: { marketId: true, expiresAt: true },
        });

        if (!pending || pending.expiresAt.getTime() <= Date.now()) {
          return { ok: false as const, error: "SIGNUP_EXPIRED" as const };
        }

        user = await tx.user.create({
          data: {
            email,
            role: Role.CUSTOMER,
            marketId: pending.marketId,
          },
          select: { id: true, role: true },
        });

        await tx.pendingSignup.delete({ where: { email } });
      }

      // Create session
      const session = await tx.session.create({
        data: {
          userId: user.id,
          expiresAt,
          token,
        },
        select: { id: true },
      });

      // Consume only the matched OTP
      await tx.loginOtp.update({
        where: { id: matched.id },
        data: { consumedAt: now },
      });

      const redirectTo = user.role === Role.CUSTOMER ? "/dashboard" : "/admin";

      return { ok: true as const, sid: session.id, redirectTo };
    });

    if (!result.ok) {
      return NextResponse.json<VerifyResp>({ ok: false, error: result.error }, { status: 400 });
    }

    // ✅ Return JSON (your login page expects JSON)
    const res = NextResponse.json<VerifyResp>({ ok: true, redirectTo: result.redirectTo });

    // ✅ Your auth expects sid=Session.id
    res.cookies.set("sid", result.sid, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });

    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/auth/otp/verify] error:", msg);
    return NextResponse.json<VerifyResp>({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}