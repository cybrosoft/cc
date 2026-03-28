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
      country:        true,
      province:       true,
      addressLine1:   true,
      addressLine2:   true,
      district:       true,
      city:           true,
      notePublic:     true,
      timezone:       true,
      tcAccepted:     true,
      privacyAccepted:true,
      createdAt:      true,
      market: {
        select: { id: true, key: true, name: true, defaultCurrency: true },
      },
      customerGroup: {
        select: { id: true, key: true, name: true },
      },
      tags: {
        select: { key: true, name: true },
      },
    },
  });

  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({
    profile: {
      id:             profile.id,
      email:          profile.email,
      customerNumber: profile.customerNumber,
      fullName:       profile.fullName       ?? null,
      mobile:         profile.mobile         ?? null,
      accountType:    profile.accountType    ?? null,
      companyName:    profile.companyName    ?? null,
      vatTaxId:       profile.vatTaxId       ?? null,
      crn:            profile.commercialRegistrationNumber ?? null,
      country:        profile.country        ?? null,
      province:       profile.province       ?? null,
      addressLine1:   profile.addressLine1   ?? null,
      addressLine2:   profile.addressLine2   ?? null,
      district:       profile.district       ?? null,
      city:           profile.city           ?? null,
      notePublic:     profile.notePublic     ?? null,
      timezone:       profile.timezone       ?? null,
      tcAccepted:     profile.tcAccepted     ?? false,
      privacyAccepted:profile.privacyAccepted ?? false,
      createdAt:      profile.createdAt.toISOString(),
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

  // Whitelist — customer can only update these fields
  const allowed = [
    "fullName", "mobile",
    "companyName", "vatTaxId", "commercialRegistrationNumber",
    "country", "province",
    "addressLine1", "addressLine2", "district", "city",
    "timezone",
  ] as const;

  type AllowedKey = typeof allowed[number];

  const data: Partial<Record<AllowedKey, string | null>> = {};
  for (const key of allowed) {
    if (key in body) {
      const val = body[key];
      data[key] = typeof val === "string" ? val.trim() || null : null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data,
  });

  // Bust customer cache so dashboard reflects updated name etc.
  await invalidateCustomer(user.id);

  return NextResponse.json({ ok: true });
}
