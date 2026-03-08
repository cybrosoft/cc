//lib/otp.ts

import crypto from "crypto";

const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

export function generateOtp(): string {
  let otp = "";
  for (let i = 0; i < OTP_LENGTH; i++) otp += crypto.randomInt(0, 10).toString();
  return otp;
}

export function hashOtp(email: string, code: string): string {
  const secret = process.env.OTP_SECRET;
  if (!secret) throw new Error("Missing OTP_SECRET");
  return crypto.createHmac("sha256", secret).update(email + code).digest("hex");
}

export function getOtpExpiry(): Date {
  return new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
}