import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Direct login disabled. Use OTP: /api/auth/otp/request then /api/auth/otp/verify",
    },
    { status: 410 }
  );
}