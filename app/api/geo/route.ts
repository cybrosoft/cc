// app/api/geo/route.ts
// Server-side IP detection — avoids CORS issues with ip-api.com
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    // Get client IP from headers
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const url = ip
      ? `https://ip-api.com/json/${ip}?fields=countryCode`
      : `https://ip-api.com/json/?fields=countryCode`;

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (typeof data?.countryCode === "string") {
      return NextResponse.json({ countryCode: data.countryCode.toUpperCase() });
    }
    return NextResponse.json({ countryCode: null });
  } catch {
    return NextResponse.json({ countryCode: null });
  }
}
