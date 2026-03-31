// app/api/admin/users/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

// ─── GET — single user ────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id:             true,
      customerNumber: true,
      email:          true,
      fullName:       true,
      mobile:         true,
      accountType:    true,
      role:           true,
      marketId:       true,
      market:         { select: { id: true, key: true, name: true } },
      customerGroupId: true,
      customerGroup:  { select: { id: true, key: true, name: true } },
      companyName:    true,
      vatTaxId:       true,
      commercialRegistrationNumber: true,
      shortAddressCode:  true,
      country:           true,
      province:          true,
      addressLine1:      true,
      addressLine2:      true,
      buildingNumber:    true,
      secondaryNumber:   true,
      district:          true,
      city:              true,
      postalCode:        true,
      notePublic:        true,
      notePrivate:       true,
      tags:              { select: { id: true, key: true, name: true } },
      notifPrefs:        true,
      timezone:          true,
      createdAt:         true,
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Return { ok: true, data: user } — matches what CustomerForm expects (cr?.ok && cr.data)
  return NextResponse.json({ ok: true, data: user });
}

// ─── PATCH — update user ──────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { id } = await params;
  const body   = await req.json();

  const {
    email, fullName, mobile, accountType, marketId, customerGroupId,
    country, province,
    companyName, vatTaxId, commercialRegistrationNumber, shortAddressCode,
    addressLine1, addressLine2, buildingNumber, secondaryNumber,
    district, city, postalCode,
    notePublic, notePrivate,
    tagIds,
  } = body;

  // Only update fields that were actually sent
  const data: Record<string, unknown> = {};

  if ("email"           in body) data.email           = email           || null;
  if ("fullName"        in body) data.fullName         = fullName        || null;
  if ("mobile"          in body) data.mobile           = mobile          || null;
  if ("accountType"     in body) data.accountType      = accountType     || null;
  if ("marketId"        in body) data.marketId         = marketId        || null;
  if ("customerGroupId" in body) data.customerGroupId  = customerGroupId || null;
  if ("country"         in body) data.country          = country         || null;
  if ("province"        in body) data.province         = province        || null;
  if ("companyName"                  in body) data.companyName                  = companyName                  || null;
  if ("vatTaxId"                     in body) data.vatTaxId                     = vatTaxId                     || null;
  if ("commercialRegistrationNumber" in body) data.commercialRegistrationNumber = commercialRegistrationNumber || null;
  if ("shortAddressCode"             in body) data.shortAddressCode             = shortAddressCode             || null;
  if ("addressLine1"    in body) data.addressLine1     = addressLine1    || null;
  if ("addressLine2"    in body) data.addressLine2     = addressLine2    || null;
  if ("buildingNumber"  in body) data.buildingNumber   = buildingNumber  || null;
  if ("secondaryNumber" in body) data.secondaryNumber  = secondaryNumber || null;
  if ("district"        in body) data.district         = district        || null;
  if ("city"            in body) data.city             = city            || null;
  if ("postalCode"      in body) data.postalCode       = postalCode      || null;
  if ("notePublic"      in body) data.notePublic       = notePublic      || null;
  if ("notePrivate"     in body) data.notePrivate      = notePrivate     || null;

  // Tags — full replace
  if (Array.isArray(tagIds)) {
    data.tags = { set: tagIds.map((tid: string) => ({ id: tid })) };
  }

  const user = await prisma.user.update({ where: { id }, data });

  // Return { ok: true, data: user } — matches what CustomerForm checks (j?.ok)
  return NextResponse.json({ ok: true, data: user });
}
