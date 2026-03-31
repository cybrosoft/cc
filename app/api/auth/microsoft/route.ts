// app/api/auth/microsoft/route.ts
// Initiates Microsoft OAuth flow (Azure AD / Microsoft Entra).
// Uses common tenant so both personal and work accounts can sign in.

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Microsoft SSO not configured." }, { status: 503 });
  }

  const { searchParams } = req.nextUrl;
  const market = searchParams.get("market") ?? "global";

  const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const callback = `${baseUrl}/api/auth/microsoft/callback`;
  const state    = Buffer.from(JSON.stringify({ market })).toString("base64url");

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  callback,
    response_type: "code",
    response_mode: "query",
    scope:         "openid email profile User.Read",
    state,
    prompt:        "select_account",
  });

  // "common" tenant allows both personal Microsoft accounts and work/school accounts
  return NextResponse.redirect(`https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`);
}
