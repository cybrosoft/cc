// app/api/customer/profile/route.ts
export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { requireUserApi } from "@/lib/auth/require-user";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { user, error } = await requireUserApi("/api/customer/profile/read");
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true, email: true, customerNumber: true, fullName: true, mobile: true,
      accountType: true, companyName: true, vatTaxId: true,
      commercialRegistrationNumber: true, shortAddressCode: true,
      country: true, province: true, addressLine1: true, addressLine2: true,
      buildingNumber: true, secondaryNumber: true, district: true,
      city: true, postalCode: true, notePublic: true, timezone: true,
      tcAccepted: true, privacyAccepted: true, createdAt: true,
      market: { select: { id: true, key: true, name: true, defaultCurrency: true } },
      customerGroup: { select: { id: true, key: true, name: true } },
      tags: { select: { key: true, name: true } },
    },
  });

  if (!profile) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({
    profile: {
      ...profile,
      crn: profile.commercialRegistrationNumber,
      currency: profile.market.defaultCurrency,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireUserApi("/api/customer/profile/write");
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  // PENDING cannot edit — only INFO_REQUIRED and ACTIVE
  if ((user.status as string) === "PENDING") {
    return NextResponse.json({ error: "Profile editing is not available until your account is approved." }, { status: 403 });
  }

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const str = (v: unknown) => typeof v === "string" && v.trim() ? v.trim() : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName:         str(body.fullName)    ?? undefined,
      mobile:           str(body.mobile)      ?? undefined,
      timezone:         str(body.timezone)    ?? undefined,
      accountType:      body.accountType === "BUSINESS" ? "BUSINESS" : undefined,
      province:         str(body.province)    ?? undefined,
      addressLine1:     str(body.addressLine1) ?? undefined,
      addressLine2:     str(body.addressLine2) ?? undefined,
      city:             str(body.city)         ?? undefined,
      postalCode:       str(body.postalCode)   ?? undefined,
      shortAddressCode: str(body.shortAddressCode) ?? undefined,
      buildingNumber:   str(body.buildingNumber)   ?? undefined,
      secondaryNumber:  str(body.secondaryNumber)  ?? undefined,
      district:         str(body.district)         ?? undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
