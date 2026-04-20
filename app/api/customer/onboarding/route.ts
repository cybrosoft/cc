// app/api/customer/onboarding/route.ts
// Saves onboarding wizard data. Called on final step submission.
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { AccountType } from "@prisma/client";

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const fullName    = str(body.fullName);
  const mobile      = str(body.mobile);
  const accountType = body.accountType === "BUSINESS" ? AccountType.BUSINESS : AccountType.PERSONAL;

  if (!fullName || !mobile) {
    return NextResponse.json({ error: "Full name and mobile are required." }, { status: 400 });
  }

  const isSaudi = user.market?.key?.toLowerCase() === "saudi";

  await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName,
      mobile,
      accountType,
      // Company fields — only if business
      ...(accountType === AccountType.BUSINESS ? {
        companyName:                  str(body.companyName),
        vatTaxId:                     str(body.vatTaxId),
        commercialRegistrationNumber: isSaudi ? str(body.crn) : undefined,
        shortAddressCode:             isSaudi ? str(body.shortAddressCode) : undefined,
      } : {}),
      // Address
      province:    str(body.province),
      addressLine1: str(body.addressLine1),
      addressLine2: str(body.addressLine2),
      city:         str(body.city),
      postalCode:   str(body.postalCode),
      // KSA-only address fields
      ...(isSaudi ? {
        buildingNumber:  str(body.buildingNumber),
        secondaryNumber: str(body.secondaryNumber),
        district:        str(body.district),
      } : {}),
      // T&C
      tcAccepted:      true,
      privacyAccepted: true,
    },
  });

  return NextResponse.json({ ok: true });
}
