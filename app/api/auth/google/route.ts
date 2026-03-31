// app/api/auth/google/route.ts
// Initiates Google OAuth flow.
// Redirects user to Google consent screen.
// Market is passed via ?market=saudi|global and stored in state param.

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google SSO not configured." }, { status: 503 });
  }

  const { searchParams } = req.nextUrl;
  const market = searchParams.get("market") ?? "global"; // "saudi" | "global"

  const baseUrl   = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const callback  = `${baseUrl}/api/auth/google/callback`;

  // Encode market in state so callback knows which market to assign
  const state = Buffer.from(JSON.stringify({ market })).toString("base64url");

  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  callback,
    response_type: "code",
    scope:         "openid email profile",
    state,
    access_type:   "online",
    prompt:        "select_account",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
