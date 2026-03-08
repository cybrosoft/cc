// app/api/admin/servers/update/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Role, Prisma } from "@prisma/client";

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

type Vendor = "HETZNER" | "ORACLE" | "UNKNOWN";

function isVendor(v: string): v is Vendor {
  return v === "HETZNER" || v === "ORACLE" || v === "UNKNOWN";
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

function mapError(e: unknown): { status: number; message: string } {
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      return { status: 409, message: "Server ID is already assigned to another record." };
    }
  }
  if (e instanceof Error && e.message.includes("unauthorized")) {
    return { status: 401, message: "Unauthorized" };
  }
  return { status: 500, message: "Request failed" };
}

export async function POST(req: Request) {
  try {
    const { actorUserId } = await requireAdminActor();

    const body = (await req.json().catch(() => null)) as
      | {
          serverRecordId?: unknown;
          vendor?: unknown;

          // Hetzner
          hetznerServerId?: unknown;
          hetznerApiToken?: unknown;

          // Oracle
          oracleInstanceId?: unknown;
          oracleInstanceRegion?: unknown;
          oracleCompartmentOcid?: unknown;
        }
      | null;

    const serverRecordId = s(body?.serverRecordId).trim();
    if (!serverRecordId) {
      return NextResponse.json({ ok: false, error: "serverRecordId required" }, { status: 400 });
    }

    const vendorRaw = s(body?.vendor).trim();
    const vendor: Vendor = isVendor(vendorRaw) ? vendorRaw : "UNKNOWN";

    const existing = await prisma.server.findUnique({
      where: { id: serverRecordId },
      select: {
        id: true,
        hetznerServerId: true,
        oracleInstanceId: true,
        oracleInstanceRegion: true,
        oracleCompartmentOcid: true,
        userId: true,
        subscriptionId: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ ok: false, error: "Server record not found" }, { status: 404 });
    }

    if (vendor === "ORACLE") {
      const ocidTrim = s(body?.oracleInstanceId).trim();
      const regionTrim = s(body?.oracleInstanceRegion).trim();
      const compTrim = s(body?.oracleCompartmentOcid).trim();

      const updated = await prisma.server.update({
        where: { id: serverRecordId },
        data: {
          oracleInstanceId: ocidTrim.length > 0 ? ocidTrim : null,
          oracleInstanceRegion: regionTrim.length > 0 ? regionTrim : null,
          oracleCompartmentOcid: compTrim.length > 0 ? compTrim : null,
        },
        select: { id: true },
      });

      await prisma.auditLog.create({
        data: {
          actorUserId,
          action: "server.update",
          entityType: "Server",
          entityId: updated.id,
          metadataJson: JSON.stringify({
            vendor: "ORACLE",
            oracleInstanceId: { from: existing.oracleInstanceId, to: ocidTrim.length > 0 ? ocidTrim : null },
            oracleInstanceRegion: { from: existing.oracleInstanceRegion, to: regionTrim.length > 0 ? regionTrim : null },
            oracleCompartmentOcid: { from: existing.oracleCompartmentOcid, to: compTrim.length > 0 ? compTrim : null },
            userId: existing.userId,
            subscriptionId: existing.subscriptionId,
          }),
        },
      });

      return NextResponse.json({ ok: true, serverId: updated.id, message: "Server updated successfully." });
    }

    // ✅ Hetzner path (keep behavior same as before)
    const serverIdTrim = s(body?.hetznerServerId).trim();
    const newHetznerServerId = serverIdTrim.length > 0 ? serverIdTrim : null;
    const tokenTrim = s(body?.hetznerApiToken).trim();

    const updated = await prisma.server.update({
      where: { id: serverRecordId },
      data: {
        hetznerServerId: newHetznerServerId,
        ...(tokenTrim.length > 0 ? { hetznerApiToken: tokenTrim } : {}),
      },
      select: { id: true },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId,
        action: "server.update",
        entityType: "Server",
        entityId: updated.id,
        metadataJson: JSON.stringify({
          vendor: "HETZNER",
          hetznerServerId: { from: existing.hetznerServerId, to: newHetznerServerId },
          hetznerApiTokenUpdated: tokenTrim.length > 0,
          userId: existing.userId,
          subscriptionId: existing.subscriptionId,
        }),
      },
    });

    return NextResponse.json({ ok: true, serverId: updated.id, message: "Server updated successfully." });
  } catch (e) {
    const { status, message } = mapError(e);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}