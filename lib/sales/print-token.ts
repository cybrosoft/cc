// lib/sales/print-token.ts
import { createHmac } from "crypto";

export function generatePrintToken(docId: string): string {
  const secret = process.env.PRINT_TOKEN_SECRET ?? "fallback-secret";
  return createHmac("sha256", secret).update(docId).digest("hex");
}

export function verifyPrintToken(docId: string, token: string): boolean {
  const expected = generatePrintToken(docId);
  // Constant-time comparison to prevent timing attacks
  if (expected.length !== token.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return diff === 0;
}
