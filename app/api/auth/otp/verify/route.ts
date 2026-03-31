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
  const v = obj[key]; return typeof v === "string" ? v : null;
}
function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
function normalizeCode(code: string): string { return code.replace(/\s+/g, "").trim(); }
function getSessionExpiry(): Date { return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); }
function newSessionToken(): string { return crypto.randomBytes(32).toString("hex"); }
function getDashboardUrl(marketKey: string): string {
  return marketKey?.toLowerCase() === "saudi" ? "/sa/dashboard" : "/dashboard";
}

type VerifyOk   = { ok: true; redirectTo: string };
type VerifyTotp = { ok: true; requiresTotp: true };
type VerifyErr  = { ok: false; error: string };
type VerifyResp = VerifyOk | VerifyTotp | VerifyErr;

export async function POST(req: Request) {
  try {
    const raw = (await req.json().catch(() => null)) as unknown;
    if (!raw || !isRecord(raw)) {
      return NextResponse.json<VerifyResp>({ ok: false, error: "INVALID_REQUEST" }, { status: 400 });
    }

    const email = normalizeEmail(String(readString(raw, "email") ?? ""));
    const code  = normalizeCode(String(readString(raw, "code")  ?? ""));

    if (!email || !code) {
      return NextResponse.json<VerifyResp>({ ok: false, error: "INVALID_CODE" }, { status: 400 });
    }

    const now = new Date();

    const otps = await prisma.loginOtp.findMany({
      where: { email, consumedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, codeHash: true, attemptCount: true },
    });

    if (otps.length === 0) {
      return NextResponse.json<VerifyResp>({ ok: false, error: "INVALID_CODE" }, { status: 400 });
    }

    const expectedHash = hashOtp(email, code);
    const matched = otps.find(o => o.codeHash === expectedHash) ?? null;

    if (!matched) {
      await prisma.loginOtp.update({
        where: { id: otps[0].id },
        data:  { attemptCount: otps[0].attemptCount + 1 },
      });
      return NextResponse.json<VerifyResp>({ ok: false, error: "INVALID_CODE" }, { status: 400 });
    }

    const expiresAt = getSessionExpiry();
    const token     = newSessionToken();

    const result = await prisma.$transaction(async tx => {
      let user = await tx.user.findUnique({
        where:  { email },
        select: {
          id: true, role: true, status: true, totpEnabled: true,
          market: { select: { key: true } },
        },
      });

      let isNewUser = false;

      if (!user) {
        const pending = await tx.pendingSignup.findUnique({
          where:  { email },
          select: { marketId: true, expiresAt: true },
        });
        if (!pending || pending.expiresAt.getTime() <= Date.now()) {
          return { ok: false as const, error: "SIGNUP_EXPIRED" as const };
        }
        user = await tx.user.create({
          data: { email, role: Role.CUSTOMER, marketId: pending.marketId, status: "PENDING" },
          select: {
            id: true, role: true, status: true, totpEnabled: true,
            market: { select: { key: true } },
          },
        });
        try {
          await tx.userStatusLog.create({
            data: {
              userId: user.id, status: "PENDING" as never,
              note: "Account created — awaiting admin review.", isAutomatic: true,
            },
          });
        } catch { /* non-fatal */ }
        await tx.pendingSignup.delete({ where: { email } });
        isNewUser = true;
      }

      if (user.status === "REJECTED")  return { ok: false as const, error: "ACCOUNT_REJECTED"  as const };
      if (user.status === "SUSPENDED") return { ok: false as const, error: "ACCOUNT_SUSPENDED" as const };

      // ── TOTP check ───────────────────────────────────────────────────────────
      // If user has TOTP enabled, consume the email OTP but don't create session yet.
      // Store a short-lived pending-auth token in a cookie so the TOTP challenge
      // endpoint can complete the login.
      if (user.totpEnabled && !isNewUser) {
        await tx.loginOtp.update({
          where: { id: matched.id },
          data:  { consumedAt: now },
        });

        const pendingToken = crypto.randomBytes(32).toString("hex");
        // Store pending token in DB temporarily — reuse Session table with a marker
        // We store as a special session that expires in 5 minutes and is not valid
        // for auth until TOTP is confirmed. We use a "pending:" prefix on the token.
        await tx.session.create({
          data: {
            userId:    user.id,
            token:     "pending:" + pendingToken,
            expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
          },
        });

        return { ok: true as const, requiresTotp: true as const, pendingToken };
      }
      // ── End TOTP check ───────────────────────────────────────────────────────

      const session = await tx.session.create({
        data:   { userId: user.id, expiresAt, token },
        select: { id: true },
      });

      await tx.loginOtp.update({
        where: { id: matched.id },
        data:  { consumedAt: now },
      });

      let redirectTo: string;
      if (user.role === Role.ADMIN || user.role === Role.STAFF) {
        redirectTo = "/admin";
      } else {
        redirectTo = getDashboardUrl(user.market.key);
      }

      return { ok: true as const, sid: session.id, redirectTo, isNewUser };
    });

    if (!result.ok) {
      const statusMap: Record<string, number> = {
        SIGNUP_EXPIRED: 400, ACCOUNT_REJECTED: 403, ACCOUNT_SUSPENDED: 403,
      };
      return NextResponse.json<VerifyResp>(
        { ok: false, error: result.error },
        { status: statusMap[result.error] ?? 400 }
      );
    }

    // TOTP required — set pending cookie and tell frontend
    if ("requiresTotp" in result && result.requiresTotp) {
      const res = NextResponse.json<VerifyResp>({ ok: true, requiresTotp: true });
      res.cookies.set("totp_pending", result.pendingToken, {
        httpOnly: true, sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/", maxAge: 5 * 60, // 5 minutes
      });
      return res;
    }

    // Normal login — set session cookie
    const res = NextResponse.json<VerifyResp>({ ok: true, redirectTo: result.redirectTo });
    res.cookies.set("sid", result.sid, {
      httpOnly: true, sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/", expires: expiresAt,
    });
    return res;

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[api/auth/otp/verify] error:", msg);
    return NextResponse.json<VerifyResp>({ ok: false, error: "SERVER_ERROR" }, { status: 500 });
  }
}
