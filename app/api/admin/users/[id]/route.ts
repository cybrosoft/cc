// app/api/admin/users/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { AccountType }    from "@prisma/client";

const VALID_ACCOUNT_TYPES: AccountType[] = ["BUSINESS", "PERSONAL"];

// ── GET /api/admin/users/[id] ─────────────────────────────────────────────────
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, fullName: true, mobile: true,
      role: true, accountType: true,
      marketId: true, customerGroupId: true,
      country: true, province: true, city: true, district: true,
      addressLine1: true, addressLine2: true,
      companyName: true, vatTaxId: true, commercialRegistrationNumber: true,
      notePublic: true, notePrivate: true,
      customerNumber: true, createdAt: true,
      market:        { select: { id: true, key: true, name: true, defaultCurrency: true, vatPercent: true } },
      customerGroup: { select: { id: true, key: true, name: true } },
      tags:          { select: { id: true, key: true, name: true } },
      subscriptions: { select: { id: true, status: true } },
      servers:       { select: { id: true } },
    },
  });

  if (!user) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, data: user });
}

// ── PATCH /api/admin/users/[id] ───────────────────────────────────────────────
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { id: userId } = await params;

  const body = (await req.json().catch(() => null)) as {
    marketId?:                     string;
    customerGroupId?:              string | null;
    fullName?:                     string | null;
    mobile?:                       string | null;
    accountType?:                  AccountType | null;
    country?:                      string | null;
    province?:                     string | null;
    companyName?:                  string | null;
    vatTaxId?:                     string | null;
    commercialRegistrationNumber?: string | null;
    addressLine1?:                 string | null;
    addressLine2?:                 string | null;
    district?:                     string | null;
    city?:                         string | null;
    notePublic?:                   string | null;
    notePrivate?:                  string | null;
  } | null;

  if (!body) return NextResponse.json({ ok: false, error: "No body" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  if (body.accountType && !VALID_ACCOUNT_TYPES.includes(body.accountType)) {
    return NextResponse.json({ ok: false, error: "Invalid accountType" }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(body.marketId                     !== undefined ? { marketId:                     body.marketId }                     : {}),
      ...(body.customerGroupId              !== undefined ? { customerGroupId:              body.customerGroupId }              : {}),
      ...(body.fullName                     !== undefined ? { fullName:                     body.fullName }                     : {}),
      ...(body.mobile                       !== undefined ? { mobile:                       body.mobile }                       : {}),
      ...(body.accountType                  !== undefined ? { accountType:                  body.accountType }                  : {}),
      ...(body.country                      !== undefined ? { country:                      body.country }                      : {}),
      ...(body.province                     !== undefined ? { province:                     body.province }                     : {}),
      ...(body.companyName                  !== undefined ? { companyName:                  body.companyName }                  : {}),
      ...(body.vatTaxId                     !== undefined ? { vatTaxId:                     body.vatTaxId }                     : {}),
      ...(body.commercialRegistrationNumber !== undefined ? { commercialRegistrationNumber: body.commercialRegistrationNumber } : {}),
      ...(body.addressLine1                 !== undefined ? { addressLine1:                 body.addressLine1 }                 : {}),
      ...(body.addressLine2                 !== undefined ? { addressLine2:                 body.addressLine2 }                 : {}),
      ...(body.district                     !== undefined ? { district:                     body.district }                     : {}),
      ...(body.city                         !== undefined ? { city:                         body.city }                         : {}),
      ...(body.notePublic                   !== undefined ? { notePublic:                   body.notePublic }                   : {}),
      ...(body.notePrivate                  !== undefined ? { notePrivate:                  body.notePrivate }                  : {}),
    },
    select: {
      id: true, email: true, fullName: true, customerNumber: true,
      market: { select: { id: true, key: true, name: true, defaultCurrency: true, vatPercent: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "CUSTOMER_UPDATED",
      entityType:   "User",
      entityId:     userId,
      metadataJson: JSON.stringify(body),
    },
  });

  return NextResponse.json({ ok: true, data: updated });
}