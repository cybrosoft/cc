// app/api/admin/users/route.ts
export const runtime = "nodejs";

import { NextResponse }   from "next/server";
import { prisma }         from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { AccountType, Role } from "@prisma/client";

const VALID_ACCOUNT_TYPES: AccountType[] = ["BUSINESS", "PERSONAL"];
const PAGE_SIZE = 50;

// ─── GET /api/admin/users — paginated customer list ──────────────────────────

export async function GET(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const page              = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSizeParam     = Number(searchParams.get("pageSize") ?? String(PAGE_SIZE));
  const effectivePageSize = Math.min(9999, Math.max(1, Number.isFinite(pageSizeParam) ? pageSizeParam : PAGE_SIZE));
  const search            = searchParams.get("search")?.trim() ?? "";
  const marketId          = searchParams.get("marketId")?.trim() ?? "";
  const role              = searchParams.get("role")?.trim() ?? "";
  const accountType       = searchParams.get("accountType")?.trim() ?? "";

  const where: Record<string, unknown> = {
    role: (role && Object.values(Role).includes(role as Role)) ? role as Role : Role.CUSTOMER,
  };

  if (marketId) where.marketId = marketId;

  if (accountType && VALID_ACCOUNT_TYPES.includes(accountType as AccountType)) {
    where.accountType = accountType as AccountType;
  }

  if (search) {
    where.OR = [
      { email:       { contains: search, mode: "insensitive" } },
      { fullName:    { contains: search, mode: "insensitive" } },
      { companyName: { contains: search, mode: "insensitive" } },
    ];
  }

  const [total, data] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip:    (page - 1) * effectivePageSize,
      take:    effectivePageSize,
      select: {
        id:             true,
        customerNumber: true,
        email:          true,
        fullName:       true,
        mobile:         true,
        role:           true,
        accountType:    true,
        country:        true,
        city:           true,
        companyName:    true,
        createdAt:      true,
        market:         { select: { id: true, name: true, key: true, defaultCurrency: true, vatPercent: true } },
        customerGroup:  { select: { id: true, name: true, key: true } },
        tags:           { select: { id: true, key: true, name: true } },
        _count:         { select: { subscriptions: true, servers: true } },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, data, total, page, pageSize: effectivePageSize });
}

// ─── POST /api/admin/users — create customer ─────────────────────────────────

export async function POST(req: Request) {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "ADMIN")
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

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
    notePublic?:                   string | null;
    notePrivate?:                  string | null;
    tagKeys?:                      string[];
  } | null;

  const email    = body?.email?.trim().toLowerCase();
  const marketId = body?.marketId?.trim();

  if (!email)    return NextResponse.json({ ok: false, error: "email is required" },    { status: 400 });
  if (!marketId) return NextResponse.json({ ok: false, error: "marketId is required" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)  return NextResponse.json({ ok: false, error: "A customer with this email already exists" }, { status: 409 });

  const market = await prisma.market.findUnique({ where: { id: marketId } });
  if (!market)   return NextResponse.json({ ok: false, error: "Market not found" }, { status: 404 });

  // Resolve customerGroupId — use provided or fall back to default group
  let customerGroupId: string | null = body?.customerGroupId ?? null;
  if (!customerGroupId) {
    const defaultGroup = await prisma.customerGroup.findFirst({ orderBy: { name: "asc" } });
    customerGroupId = defaultGroup?.id ?? null;
  }

  // Resolve tag ids
  const tagKeys: string[] = body?.tagKeys ?? [];
  const tags = tagKeys.length
    ? await prisma.tag.findMany({ where: { key: { in: tagKeys } }, select: { id: true } })
    : [];

  const user = await prisma.user.create({
    data: {
      email,
      marketId,
      customerGroupId,
      fullName:                     body?.fullName    ?? null,
      mobile:                       body?.mobile      ?? null,
      accountType:                  body?.accountType ?? null,
      country:                      body?.country     ?? null,
      province:                     body?.province    ?? null,
      companyName:                  body?.companyName ?? null,
      vatTaxId:                     body?.vatTaxId    ?? null,
      commercialRegistrationNumber: body?.commercialRegistrationNumber ?? null,
      addressLine1:                 body?.addressLine1 ?? null,
      addressLine2:                 body?.addressLine2 ?? null,
      district:                     body?.district    ?? null,
      city:                         body?.city        ?? null,
      notePublic:                   body?.notePublic  ?? null,
      notePrivate:                  body?.notePrivate ?? null,
      tags: tags.length ? { connect: tags.map(t => ({ id: t.id })) } : undefined,
    },
    select: {
      id: true, customerNumber: true, email: true, fullName: true,
      market: { select: { id: true, key: true, name: true, defaultCurrency: true, vatPercent: true } },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId:  admin.id,
      action:       "CUSTOMER_CREATED",
      entityType:   "User",
      entityId:     user.id,
      metadataJson: JSON.stringify({ email, marketId }),
    },
  });

  return NextResponse.json({ ok: true, data: user }, { status: 201 });
}