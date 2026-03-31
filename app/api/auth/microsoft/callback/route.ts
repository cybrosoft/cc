// app/api/auth/microsoft/callback/route.ts
// Handles Microsoft OAuth callback.
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
  const clientId     = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const baseUrl      = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const callback     = `${baseUrl}/api/auth/microsoft/callback`;

  if (!clientId || !clientSecret) {
    return errorRedirect(baseUrl, "Microsoft SSO not configured.");
  }

  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error || !code) {
    return errorRedirect(baseUrl, "Microsoft sign-in was cancelled.");
  }

  let market = "global";
  try {
    if (state) {
      const decoded = JSON.parse(Buffer.from(state, "base64url").toString());
      market = decoded.market ?? "global";
    }
  } catch { /* use default */ }

  // Exchange code for tokens
  let msProfile: { sub: string; email: string; name?: string } | null = null;
  try {
    const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, client_id: clientId, client_secret: clientSecret,
        redirect_uri: callback, grant_type: "authorization_code",
        scope: "openid email profile User.Read",
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) return errorRedirect(baseUrl, "Failed to get token from Microsoft.");

    // Get user profile from Microsoft Graph
    const profileRes = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    const email = profile.mail ?? profile.userPrincipalName ?? null;
    if (!email || !profile.id) return errorRedirect(baseUrl, "Microsoft did not return a valid profile.");

    msProfile = { sub: profile.id, email, name: profile.displayName };
  } catch {
    return errorRedirect(baseUrl, "Failed to authenticate with Microsoft.");
  }

  if (!msProfile) return errorRedirect(baseUrl, "Failed to get Microsoft profile.");

  try {
    const result = await prisma.$transaction(async tx => {
      // Check by microsoftId first
      let user = await tx.user.findFirst({
        where:  { microsoftId: msProfile!.sub },
        select: { id: true, role: true, status: true, market: { select: { key: true } } },
      });

      let isNewUser = false;

      if (!user) {
        const byEmail = await tx.user.findUnique({
          where:  { email: msProfile!.email },
          select: { id: true, role: true, status: true, market: { select: { key: true } }, microsoftId: true },
        });

        if (byEmail) {
          user = await tx.user.update({
            where:  { id: byEmail.id },
            data:   { microsoftId: msProfile!.sub },
            select: { id: true, role: true, status: true, market: { select: { key: true } } },
          });
        } else {
          const marketRecord = await tx.market.findFirst({
            where:  { key: market.toUpperCase(), isActive: true },
            select: { id: true, key: true },
          });
          if (!marketRecord) return { ok: false as const, error: "Market not found." };

          user = await tx.user.create({
            data: {
              email:       msProfile!.email,
              fullName:    msProfile!.name ?? null,
              microsoftId: msProfile!.sub,
              role:        Role.CUSTOMER,
              marketId:    marketRecord.id,
              status:      "PENDING" as never,
            },
            select: { id: true, role: true, status: true, market: { select: { key: true } } },
          });

          await tx.userStatusLog.create({
            data: {
              userId:      user.id,
              status:      "PENDING" as never,
              note:        "Account created via Microsoft SSO — awaiting admin review.",
              isAutomatic: true,
            },
          });

          isNewUser = true;
        }
      }

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
    console.error("[microsoft/callback]", e);
    return errorRedirect(baseUrl, "Server error during sign-in.");
  }
}
