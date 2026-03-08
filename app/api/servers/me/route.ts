export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { Role } from "@prisma/client";
import { getServerCore } from "@/lib/hetzner";

type ServerOut = {
  id: string;
  subscriptionId: string | null;

  productKey: string | null;
  productName: string | null;

  hetznerServerId: string | null;

  // Hetzner summary (safe)
  name: string | null;
  status: string | null; // "NA" on invalid token/id
  ipv4: string | null;
  ipv6: string | null;
  location: string | null;
  vcpu: number | null;
  ramGb: number | null;
  diskGb: number | null;
};

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    if (user.role !== Role.CUSTOMER) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const servers = await prisma.server.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        subscriptionId: true,
        hetznerServerId: true,
        hetznerApiToken: true,
        subscription: {
          select: {
            product: { select: { key: true, name: true } },
          },
        },
      },
    });

    const data: ServerOut[] = await Promise.all(
      servers.map(async (sv): Promise<ServerOut> => {
        const token = (sv.hetznerApiToken ?? "").trim();
        const hetznerServerId = (sv.hetznerServerId ?? "").trim();

        // defaults (blank fields)
        let name: string | null = null;
        let status: string | null = null;
        let ipv4: string | null = null;
        let ipv6: string | null = null;
        let location: string | null = null;
        let vcpu: number | null = null;
        let ramGb: number | null = null;
        let diskGb: number | null = null;

        if (!token || !hetznerServerId) {
          status = "NA";
        } else {
          try {
            const core = await getServerCore(token, hetznerServerId);
            name = core.name;
            status = core.status;
            ipv4 = core.ipv4;
            ipv6 = core.ipv6;
            location = core.location;
            vcpu = core.vcpu;
            ramGb = core.ramGb;
            diskGb = core.diskGb;
          } catch {
            // invalid token / invalid server id => NA + blanks
            status = "NA";
          }
        }

        return {
          id: sv.id,
          subscriptionId: sv.subscriptionId,
          productKey: sv.subscription?.product?.key ?? null,
          productName: sv.subscription?.product?.name ?? null,
          hetznerServerId: sv.hetznerServerId,
          name,
          status,
          ipv4,
          ipv6,
          location,
          vcpu,
          ramGb,
          diskGb,
        };
      })
    );

    return NextResponse.json({ ok: true, data });
  } catch {
    return NextResponse.json({ ok: false, error: "Request failed" }, { status: 500 });
  }
}