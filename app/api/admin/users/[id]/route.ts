// FILE: app/api/admin/users/[id]/route.ts
export const runtime = "nodejs";

import { NextResponse }    from "next/server";
import { prisma }          from "@/lib/prisma";
import { getSessionUser }  from "@/lib/auth/get-session-user";
import { AccountType }     from "@prisma/client";

const VALID_ACCOUNT_TYPES: AccountType[] = ["BUSINESS", "PERSONAL"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const { id: userId } = await params;
  if (!userId) return NextResponse.json({ ok: false, error: "Missing id" }, { status: 400 });

  const body = (await req.json().catch(() => null)) as {
    email?:                        string;
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
  } | null;

  if (!body) return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

  const email = body.email?.trim().toLowerCase();
  if (!email)         return NextResponse.json({ ok: false, error: "Email is required" },   { status: 400 });
  if (!body.marketId) return NextResponse.json({ ok: false, error: "Market is required" },  { status: 400 });

  if (body.accountType && !VALID_ACCOUNT_TYPES.includes(body.accountType)) {
    return NextResponse.json({ ok: false, error: "Invalid accountType" }, { status: 400 });
  }

  // Confirm user exists and is a CUSTOMER
  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!existing) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
  if (existing.role !== "CUSTOMER") return NextResponse.json({ ok: false, error: "User is not a customer" }, { status: 400 });

  // Email conflict check
  const conflict = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
  if (conflict) return NextResponse.json({ ok: false, error: "Email already in use" }, { status: 409 });

  const isBusinessType = body.accountType === "BUSINESS" || (!body.accountType);

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      email,
      marketId:        body.marketId,
      customerGroupId: body.customerGroupId ?? null,
      fullName:        body.fullName  ?? null,
      mobile:          body.mobile    ?? null,
      accountType:     body.accountType ?? null,
      country:         body.country   ?? null,
      province:        body.province  ?? null,
      // Business fields — clear if personal
      companyName:                  isBusinessType ? (body.companyName  ?? null) : null,
      vatTaxId:                     isBusinessType ? (body.vatTaxId     ?? null) : null,
      commercialRegistrationNumber: isBusinessType ? (body.commercialRegistrationNumber ?? null) : null,
      // Address
      addressLine1: body.addressLine1 ?? null,
      addressLine2: body.addressLine2 ?? null,
      district:     body.district     ?? null,
      city:         body.city         ?? null,
    },
    select: { id: true, email: true, marketId: true, customerGroupId: true },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "CUSTOMER_UPDATED",
      entityType:   "User",
      entityId:     userId,
      metadataJson: JSON.stringify({ email, marketId: body.marketId }),
    },
  });

  return NextResponse.json({ ok: true, user: updated });
}