// app/api/auth/google/callback/route.ts
// Handles Google OAuth callback.
// Exchanges code for tokens, gets user profile, creates/finds user, creates session.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { dashboardUrl } from "@/lib/utils/dashboard-url";
import crypto from "crypto";

function getSessionExpiry(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

function errorRedirect(base: string, reason: string): NextResponse {
  return NextResponse.redirect(`${base}/login?error=${encodeURIComponent(reason)}`);
}

export async function GET(req: NextRequest) {
  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const baseUrl      = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const callback     = `${baseUrl}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return errorRedirect(baseUrl, "Google SSO not configured.");
  }

  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return errorRedirect(baseUrl, "Google sign-in was cancelled.");
  }

  // Decode market from state
  let market = "global";
  try {
    if (state) {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
      market = decoded.market ?? "global";
    }
  } catch { /* use default */ }

  // Exchange code for tokens
  let googleProfile: { sub: string; email: string; name?: string } | null = null;
  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: callback, grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.id_token) return errorRedirect(baseUrl, "Failed to get token from Google.");

    // Decode id_token payload (we trust Google's signature here for simplicity)
    const payload = JSON.parse(
      Buffer.from(tokenData.id_token.split(".")[1], "base64url").toString()
    );
    googleProfile = { sub: payload.sub, email: payload.email, name: payload.name };
  } catch {
    return errorRedirect(baseUrl, "Failed to authenticate with Google.");
  }

  if (!googleProfile?.email || !googleProfile?.sub) {
    return errorRedirect(baseUrl, "Google did not return a valid profile.");
  }

  try {
    // Find or create user
    const result = await prisma.$transaction(async tx => {
      // Check by googleId first
      let user = await tx.user.findFirst({
        where: { googleId: googleProfile!.sub },
        select: { id: true, role: true, status: true, market: { select: { key: true } } },
      });

      let isNewUser = false;

      if (!user) {
        // Check by email
        const byEmail = await tx.user.findUnique({
          where:  { email: googleProfile!.email },
          select: { id: true, role: true, status: true, market: { select: { key: true } }, googleId: true },
        });

        if (byEmail) {
          // Existing user — link Google account
          user = await tx.user.update({
            where:  { id: byEmail.id },
            data:   { googleId: googleProfile!.sub },
            select: { id: true, role: true, status: true, market: { select: { key: true } } },
          });
        } else {
          // New user — find market by key
          const marketRecord = await tx.market.findFirst({
            where:  { key: market.toUpperCase(), isActive: true },
            select: { id: true, key: true },
          });
          if (!marketRecord) return { ok: false as const, error: "Market not found." };

          user = await tx.user.create({
            data: {
              email:    googleProfile!.email,
              fullName: googleProfile!.name ?? null,
              googleId: googleProfile!.sub,
              role:     Role.CUSTOMER,
              marketId: marketRecord.id,
              status:   "PENDING" as never,
            },
            select: { id: true, role: true, status: true, market: { select: { key: true } } },
          });

          await tx.userStatusLog.create({
            data: {
              userId:      user.id,
              status:      "PENDING" as never,
              note:        "Account created via Google SSO — awaiting admin review.",
              isAutomatic: true,
            },
          });

          isNewUser = true;
        }
      }

      // Block rejected/suspended
      if (user.status === "REJECTED")  return { ok: false as const, error: "ACCOUNT_REJECTED" };
      if (user.status === "SUSPENDED") return { ok: false as const, error: "ACCOUNT_SUSPENDED" };

      const expiresAt = getSessionExpiry();
      const session   = await tx.session.create({
        data:   { userId: user.id, expiresAt, token: crypto.randomBytes(32).toString("hex") },
        select: { id: true },
      });

      const redirectTo = user.role === Role.ADMIN || user.role === Role.STAFF
        ? "/admin"
        : dashboardUrl(user.market.key);

      return { ok: true as const, sid: session.id, redirectTo, expiresAt, isNewUser };
    });

    if (!result.ok) {
      const reason = result.error === "ACCOUNT_REJECTED"  ? "rejected"  :
                     result.error === "ACCOUNT_SUSPENDED" ? "suspended" : result.error;
      return errorRedirect(baseUrl, reason);
    }

    const res = NextResponse.redirect(`${baseUrl}${result.redirectTo}`);
    res.cookies.set("sid", result.sid, {
      httpOnly: true, sameSite: "lax",
      secure:   process.env.NODE_ENV === "production",
      path:     "/", expires: result.expiresAt,
    });
    return res;

  } catch (e) {
    console.error("[google/callback]", e);
    return errorRedirect(baseUrl, "Server error during sign-in.");
  }
}
