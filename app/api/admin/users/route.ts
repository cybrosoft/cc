// app/api/admin/users/route.ts

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/require-admin";

// ─── GET — list users ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search   = searchParams.get("search")   ?? "";
  const marketId = searchParams.get("marketId") ?? "";
  const groupId  = searchParams.get("groupId")  ?? "";
  const role     = searchParams.get("role")     ?? "CUSTOMER";

  const users = await prisma.user.findMany({
    where: {
      role: role as "ADMIN" | "STAFF" | "CUSTOMER",
      ...(marketId ? { marketId } : {}),
      ...(groupId  ? { customerGroupId: groupId } : {}),
      ...(search
        ? {
            OR: [
              { email:       { contains: search, mode: "insensitive" } },
              { fullName:    { contains: search, mode: "insensitive" } },
              { companyName: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
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
      notePrivate:    true,
      tags:           { select: { id: true, key: true, name: true } },
      createdAt:      true,
    },
    orderBy: { customerNumber: "desc" },
  });

  return NextResponse.json(users);
}

// ─── POST — create customer ───────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = await req.json();

  const {
    email, fullName, mobile, accountType, marketId, customerGroupId,
    country, province,
    companyName, vatTaxId, commercialRegistrationNumber, shortAddressCode,
    addressLine1, addressLine2, buildingNumber, secondaryNumber,
    district, city, postalCode,
    notePublic, notePrivate,
    tagIds,
  } = body;

  if (!email)    return NextResponse.json({ error: "Email is required"  }, { status: 400 });
  if (!marketId) return NextResponse.json({ error: "Market is required" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)  return NextResponse.json({ error: "A user with this email already exists" }, { status: 409 });

  const user = await prisma.user.create({
    data: {
      email,
      role: "CUSTOMER",
      marketId,
      customerGroupId: customerGroupId || null,
      fullName:  fullName  || null,
      mobile:    mobile    || null,
      accountType: accountType || null,
      country:   country   || null,
      province:  province  || null,
      companyName:                  companyName                  || null,
      vatTaxId:                     vatTaxId                     || null,
      commercialRegistrationNumber: commercialRegistrationNumber || null,
      shortAddressCode:             shortAddressCode             || null,
      addressLine1:   addressLine1   || null,
      addressLine2:   addressLine2   || null,
      buildingNumber:  buildingNumber  || null,
      secondaryNumber: secondaryNumber || null,
      district:       district        || null,
      city:           city            || null,
      postalCode:     postalCode      || null,
      notePublic:     notePublic      || null,
      notePrivate:    notePrivate     || null,
      ...(Array.isArray(tagIds) && tagIds.length > 0
        ? { tags: { connect: tagIds.map((id: string) => ({ id })) } }
        : {}),
    },
  });

  return NextResponse.json(user, { status: 201 });
}
