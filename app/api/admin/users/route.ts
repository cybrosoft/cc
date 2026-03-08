// FILE: app/api/admin/users/route.ts
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { AccountType }    from "@prisma/client";

const VALID_ACCOUNT_TYPES: AccountType[] = ["BUSINESS", "PERSONAL"];

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

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

  const email = body?.email?.trim().toLowerCase();
  if (!email)          return NextResponse.json({ ok: false, error: "Email is required" },  { status: 400 });
  if (!body?.marketId) return NextResponse.json({ ok: false, error: "Market is required" }, { status: 400 });

  if (body.accountType && !VALID_ACCOUNT_TYPES.includes(body.accountType)) {
    return NextResponse.json({ ok: false, error: "Invalid accountType" }, { status: 400 });
  }

  // Email conflict
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ ok: false, error: "Email already in use" }, { status: 409 });

  // Resolve customer group — use provided, else fall back to standard/default
  let resolvedGroupId = body.customerGroupId ?? null;
  if (!resolvedGroupId) {
    const defaultGroup = await prisma.customerGroup.findFirst({
      where:   { isActive: true, key: "standard" },
      select:  { id: true },
    }) ?? await prisma.customerGroup.findFirst({
      where:   { isActive: true },
      orderBy: { createdAt: "asc" },
      select:  { id: true },
    });
    resolvedGroupId = defaultGroup?.id ?? null;
  }

  const isBusinessType = (body.accountType ?? "BUSINESS") === "BUSINESS";

  const created = await prisma.user.create({
    data: {
      email,
      role:            "CUSTOMER",
      marketId:        body.marketId,
      customerGroupId: resolvedGroupId,
      fullName:        body.fullName  ?? null,
      mobile:          body.mobile    ?? null,
      accountType:     body.accountType ?? "BUSINESS",
      country:         body.country   ?? null,
      province:        body.province  ?? null,
      companyName:                  isBusinessType ? (body.companyName  ?? null) : null,
      vatTaxId:                     isBusinessType ? (body.vatTaxId     ?? null) : null,
      commercialRegistrationNumber: isBusinessType ? (body.commercialRegistrationNumber ?? null) : null,
      addressLine1: body.addressLine1 ?? null,
      addressLine2: body.addressLine2 ?? null,
      district:     body.district     ?? null,
      city:         body.city         ?? null,
    },
    select: {
      id:              true,
      email:           true,
      role:            true,
      marketId:        true,
      customerGroupId: true,
      createdAt:       true,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "CUSTOMER_CREATED",
      entityType:   "User",
      entityId:     created.id,
      metadataJson: JSON.stringify({ email, marketId: body.marketId }),
    },
  });

  return NextResponse.json({ ok: true, user: created });
}