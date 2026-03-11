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
      market:        { select: { id: true, key: true, name: true } },
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
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false, error: "INVALID_INPUT" }, { status: 400 });

  const email = body.email?.trim().toLowerCase();
  if (!email)         return NextResponse.json({ ok: false, error: "Email is required" },  { status: 400 });
  if (!body.marketId) return NextResponse.json({ ok: false, error: "Market is required" }, { status: 400 });

  if (body.accountType && !VALID_ACCOUNT_TYPES.includes(body.accountType))
    return NextResponse.json({ ok: false, error: "Invalid accountType" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!existing) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const conflict = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
  if (conflict) return NextResponse.json({ ok: false, error: "Email already in use" }, { status: 409 });

  const isBusiness = (body.accountType ?? "BUSINESS") === "BUSINESS";

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      email,
      marketId:        body.marketId,
      customerGroupId: body.customerGroupId ?? null,
      fullName:        body.fullName  ?? null,
      mobile:          body.mobile    ?? null,
      accountType:     body.accountType ?? "BUSINESS",
      country:         body.country   ?? null,
      province:        body.province  ?? null,
      city:            body.city      ?? null,
      district:        body.district  ?? null,
      addressLine1:    body.addressLine1 ?? null,
      addressLine2:    body.addressLine2 ?? null,
      companyName:                  isBusiness ? (body.companyName  ?? null) : null,
      vatTaxId:                     isBusiness ? (body.vatTaxId     ?? null) : null,
      commercialRegistrationNumber: isBusiness ? (body.commercialRegistrationNumber ?? null) : null,
      notePublic:  body.publicNote  ?? null,
      notePrivate: body.privateNote ?? null,
    },
    select: { id: true, email: true },
  });

  // Update tags if provided
  if (Array.isArray(body.tagIds)) {
    await prisma.user.update({
      where: { id: userId },
      data: { tags: { set: body.tagIds.map((id: string) => ({ id })) } },
    });
  }

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "CUSTOMER_UPDATED",
      entityType:   "User",
      entityId:     userId,
      metadataJson: JSON.stringify({ email }),
    },
  });

  return NextResponse.json({ ok: true, data: updated });
}