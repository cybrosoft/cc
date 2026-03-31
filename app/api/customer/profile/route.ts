// app/api/customer/profile/route.ts
// GET  — return current customer's full profile
// PATCH — update personal/company info (safe fields only)

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { prisma } from "@/lib/prisma";
import { invalidateCustomer } from "@/lib/cache/customer-cache";

export async function GET(_req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id:             true,
      email:          true,
      customerNumber: true,
      fullName:       true,
      mobile:         true,
      accountType:    true,
      companyName:    true,
      vatTaxId:       true,
      commercialRegistrationNumber: true,
      shortAddressCode: true,
      country:        true,
      province:       true,
      addressLine1:   true,
      addressLine2:   true,
      buildingNumber:  true,
      secondaryNumber: true,
      district:       true,
      city:           true,
      postalCode:     true,
      notePublic:     true,
      timezone:       true,
      tcAccepted:     true,
      privacyAccepted: true,
      createdAt:      true,
      market: { select: { id: true, key: true, name: true, defaultCurrency: true } },
      customerGroup:  { select: { id: true, key: true, name: true } },
      tags:           { select: { key: true, name: true } },
    },
  });

  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    profile: {
      id:               profile.id,
      email:            profile.email,
      customerNumber:   profile.customerNumber,
      fullName:         profile.fullName          ?? null,
      mobile:           profile.mobile            ?? null,
      accountType:      profile.accountType       ?? null,
      companyName:      profile.companyName       ?? null,
      vatTaxId:         profile.vatTaxId          ?? null,
      crn:              profile.commercialRegistrationNumber ?? null,
      shortAddressCode: profile.shortAddressCode  ?? null,
      country:          profile.country           ?? null,
      province:         profile.province          ?? null,
      addressLine1:     profile.addressLine1      ?? null,
      addressLine2:     profile.addressLine2      ?? null,
      buildingNumber:   profile.buildingNumber    ?? null,
      secondaryNumber:  profile.secondaryNumber   ?? null,
      district:         profile.district          ?? null,
      city:             profile.city              ?? null,
      postalCode:       profile.postalCode        ?? null,
      notePublic:       profile.notePublic        ?? null,
      timezone:         profile.timezone          ?? null,
      tcAccepted:       profile.tcAccepted        ?? false,
      privacyAccepted:  profile.privacyAccepted   ?? false,
      createdAt:        profile.createdAt.toISOString(),
      market: {
        id:       profile.market.id,
        key:      profile.market.key,
        name:     profile.market.name,
        currency: profile.market.defaultCurrency,
      },
      customerGroup: profile.customerGroup
        ? { id: profile.customerGroup.id, key: profile.customerGroup.key, name: profile.customerGroup.name }
        : null,
      tags: profile.tags.map(t => ({ key: t.key, name: t.name })),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Fetch user's market to apply KSA-only rules
  const userRecord = await prisma.user.findUnique({
    where: { id: user.id },
    select: { accountType: true, market: { select: { key: true } } },
  });
  const isSaudi = userRecord?.market?.key?.toLowerCase() === "saudi";
  const isAlreadyBusiness = userRecord?.accountType === "BUSINESS";

  // Whitelist — only these fields can be updated by the customer
  const alwaysAllowed = [
    "fullName", "mobile", "province",
    "addressLine1", "addressLine2",
    "city", "postalCode", "timezone",
  ] as const;

  const saudiOnly = [
    "shortAddressCode", "buildingNumber", "secondaryNumber", "district",
  ] as const;

  type AllowedKey = typeof alwaysAllowed[number] | typeof saudiOnly[number] | "accountType";

  const data: Partial<Record<AllowedKey, string | null>> = {};

  // Always-allowed fields
  for (const key of alwaysAllowed) {
    if (key in body) {
      const val = body[key];
      data[key] = typeof val === "string" ? val.trim() || null : null;
    }
  }

  // Saudi-only fields — ignore silently for Global customers
  if (isSaudi) {
    for (const key of saudiOnly) {
      if (key in body) {
        const val = body[key];
        data[key] = typeof val === "string" ? val.trim() || null : null;
      }
    }
  }

  // accountType — allow Personal → Business upgrade only
  if ("accountType" in body && !isAlreadyBusiness) {
    const val = body["accountType"];
    if (val === "BUSINESS") data["accountType"] = "BUSINESS";
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: user.id }, data });

  await invalidateCustomer(user.id);

  return NextResponse.json({ ok: true });
}
