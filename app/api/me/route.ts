// app/api/me/route.ts
// GET   — return current logged-in user's profile
// PATCH — customer updates their own profile (restricted fields only)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/require-user";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: {
      id: true,
      customerNumber: true,
      email: true,
      fullName: true,
      mobile: true,
      accountType: true,
      role: true,
      market: { select: { id: true, key: true, name: true, defaultCurrency: true } },
      customerGroup: { select: { id: true, key: true, name: true } },
      companyName: true,
      vatTaxId: true,
      commercialRegistrationNumber: true,
      shortAddressCode: true,
      country: true,
      province: true,
      addressLine1: true,
      addressLine2: true,
      buildingNumber: true,
      secondaryNumber: true,
      district: true,
      city: true,
      postalCode: true,
      notePublic: true,
      // notePrivate is intentionally excluded — admin-only
      tags: { select: { id: true, key: true, name: true } },
      notifPrefs: true,
      timezone: true,
      dndStart: true,
      dndEnd: true,
      tcAccepted: true,
      privacyAccepted: true,
      marketingAccepted: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// ─── PATCH ────────────────────────────────────────────────────────────────────
// Customers may update their own personal/business/address info.
// They cannot change: email, role, marketId, customerGroupId, tags, notes.

export async function PATCH(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = await req.json();

  // Allowlist of fields a customer can self-update
  const allowed = [
    "fullName",
    "mobile",
    "accountType",
    "country",
    "province",
    // business
    "companyName",
    "vatTaxId",
    "commercialRegistrationNumber",
    "shortAddressCode",
    // address
    "addressLine1",
    "addressLine2",
    "buildingNumber",
    "secondaryNumber",
    "district",
    "city",
    "postalCode",
    // prefs
    "timezone",
    "dndStart",
    "dndEnd",
    "notifPrefs",
    // consent
    "tcAccepted",
    "privacyAccepted",
    "marketingAccepted",
  ];

  // Determine if this customer is Saudi so we can guard Saudi-only fields
  const userRecord = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { market: { select: { key: true } } },
  });
  const isSaudi =
    userRecord?.market?.key?.toLowerCase() === "saudi";

  const data: Record<string, unknown> = {};

  for (const field of allowed) {
    if (!(field in body)) continue;

    // Prevent non-Saudi customers from setting Saudi-only fields
    if (
      (field === "buildingNumber" || field === "secondaryNumber") &&
      !isSaudi
    ) {
      continue;
    }

    const val = body[field];
    // For string fields: treat empty string as null
    if (typeof val === "string") {
      data[field] = val.trim() || null;
    } else {
      data[field] = val ?? null;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: auth.user.id },
    data,
    select: {
      id: true,
      fullName: true,
      mobile: true,
      accountType: true,
      companyName: true,
      vatTaxId: true,
      commercialRegistrationNumber: true,
      shortAddressCode: true,
      country: true,
      province: true,
      addressLine1: true,
      addressLine2: true,
      buildingNumber: true,
      secondaryNumber: true,
      district: true,
      city: true,
      postalCode: true,
      timezone: true,
      dndStart: true,
      dndEnd: true,
      notifPrefs: true,
      tcAccepted: true,
      privacyAccepted: true,
      marketingAccepted: true,
    },
  });

  return NextResponse.json(user);
}
