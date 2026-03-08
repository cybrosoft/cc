// app/api/admin/servers/reboot/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { rebootServer } from "@/lib/hetzner";
import { rebootOracleInstance } from "@/lib/oracle/compute";

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

async function requireAdminActor(): Promise<{ actorUserId: string }> {
  const jar = await cookies();
  const sid = jar.get("sid")?.value ?? "";
  if (!sid) throw new Error("unauthorized");

  const now = new Date();

  const session = await prisma.session.findUnique({
    where: { id: sid },
    select: {
      expiresAt: true,
      user: { select: { id: true, role: true } },
    },
  });

  if (!session) throw new Error("unauthorized");
  if (session.expiresAt.getTime() <= now.getTime()) throw new Error("unauthorized");

  if (session.user.role !== Role.ADMIN && session.user.role !== Role.STAFF) {
    throw new Error("unauthorized");
  }

  return { actorUserId: session.user.id };
}

type Vendor = "HETZNER" | "ORACLE" | "UNKNOWN";

function detectVendor(args: {
  productCategoryKey: string | null;
  hetznerServerId: string | null;
  oracleInstanceId: string | null;
}): Vendor {
  const key = (args.productCategoryKey ?? "").trim().toLowerCase();
  if (key === "servers-g") return "HETZNER";
  if (key === "servers-o") return "ORACLE";
  if (args.oracleInstanceId) return "ORACLE";
  if (args.hetznerServerId) return "HETZNER";
  return "UNKNOWN";
}

export async function POST(req: Request) {
  try {
    const { actorUserId } = await requireAdminActor();

    const body = (await req.json().catch(() => null)) as { serverRecordId?: unknown } | null;
    const serverRecordId = s(body?.serverRecordId).trim();
    if (!serverRecordId) {
      return NextResponse.json({ ok: false, error: "serverRecordId required" }, { status: 400 });
    }

    const server = await prisma.server.findUnique({
      where: { id: serverRecordId },
      select: {
        id: true,

        hetznerServerId: true,
        hetznerApiToken: true,

        oracleInstanceId: true,
        oracleInstanceRegion: true,

        subscription: {
          select: {
            product: { select: { category: { select: { key: true } } } },
          },
        },
      },
    });

    if (!server) {
      return NextResponse.json({ ok: false, error: "Server record not found" }, { status: 404 });
    }

    const productCategoryKey = server.subscription?.product?.category?.key ?? null;

    const vendor = detectVendor({
      productCategoryKey,
      hetznerServerId: server.hetznerServerId,
      oracleInstanceId: server.oracleInstanceId,
    });

    // -----------------------------
    // HETZNER (keep EXACT behavior)
    // -----------------------------
    if (vendor === "HETZNER") {
      const token = (server.hetznerApiToken ?? "").trim();
      const hetznerId = (server.hetznerServerId ?? "").trim();

      if (!token || !hetznerId) {
        return NextResponse.json({ ok: false, error: "Server is not configured for Hetzner" }, { status: 400 });
      }

      const { actionId } = await rebootServer(token, hetznerId);

      await prisma.auditLog.create({
        data: {
          actorUserId,
          action: "server.reboot",
          entityType: "Server",
          entityId: server.id,
          metadataJson: JSON.stringify({ vendor: "HETZNER", hetznerServerId: hetznerId, actionId }),
        },
      });

      return NextResponse.json({ ok: true, actionId });
    }

    // -----------------------------
    // ORACLE
    // -----------------------------
    if (vendor === "ORACLE") {
      const instanceOcid = (server.oracleInstanceId ?? "").trim();
      const regionCode = (server.oracleInstanceRegion ?? "").trim();

      if (!instanceOcid) {
        return NextResponse.json({ ok: false, error: "Oracle Instance OCID is missing" }, { status: 400 });
      }
      if (!regionCode) {
        return NextResponse.json({ ok: false, error: "Oracle Instance Region code is missing" }, { status: 400 });
      }

      // If env creds are missing, rebootOracleInstance() will throw;
      // we catch and return a clean error below.
      const { requestId } = await rebootOracleInstance({ instanceOcid, regionCode });

      await prisma.auditLog.create({
        data: {
          actorUserId,
          action: "server.reboot",
          entityType: "Server",
          entityId: server.id,
          metadataJson: JSON.stringify({ vendor: "ORACLE", instanceOcid, regionCode, requestId }),
        },
      });

      return NextResponse.json({ ok: true, actionId: requestId });
    }

    return NextResponse.json({ ok: false, error: "Unknown vendor (cannot reboot)" }, { status: 400 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("unauthorized") ? 401 : 500;
    const safe = status === 401 ? "Unauthorized" : msg || "Request failed";
    return NextResponse.json({ ok: false, error: safe }, { status });
  }
}