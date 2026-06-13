// app/api/customer/network/route.ts
// Lists all public IPs (primary + additional/floating) across the customer's
// active server subscriptions.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { getServerCore } from "@/lib/hetzner";
import { listFloatingIps } from "@/lib/hetzner/floating-ips";
import { getOracleInstanceSummary } from "@/lib/oracle/compute";

type IpRow = {
  ip:       string;
  type:     "4" | "6";
  location: string | null;
  role:     "Primary" | "Additional";
  reserved: boolean;
  serverName: string;
};

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: user.id,
        status: "ACTIVE",
        product: {
          category: { key: "server" },
        },
      },
      select: {
        id:             true,
        locationCode:   true,
        productDetails: true,
        product: { select: { name: true } },
        servers: {
          select: {
            id:                    true,
            hetznerServerId:       true,
            hetznerApiToken:       true,
            oracleInstanceId:      true,
            oracleInstanceRegion:  true,
            oracleCompartmentOcid: true,
          },
          take: 1,
        },
      },
    });

    const allLocations = await prisma.location.findMany({
      select: { code: true, name: true, countryCode: true },
    });
    const locationMap = new Map(allLocations.map(l => [l.code, l]));

    function locationDisplay(code: string | null): string | null {
      if (!code) return null;
      const loc = locationMap.get(code);
      if (!loc) return code;
      return loc.countryCode ? `${loc.countryCode} - ${loc.name}` : loc.name;
    }

    const rows: IpRow[] = [];

    // Cache one floating-ip list per Hetzner token (avoid repeat calls if multiple servers share a token)
    const floatingIpsCache = new Map<string, Awaited<ReturnType<typeof listFloatingIps>>>();

    for (const sub of subscriptions) {
      const server = sub.servers[0] ?? null;
      if (!server) continue;

      const serverName = (() => {
        const firstLine = sub.productDetails ? sub.productDetails.split("\n")[0].trim() : null;
        if (!firstLine || firstLine === sub.product.name) return sub.product.name;
        return firstLine;
      })();

      const subLocation = locationDisplay(sub.locationCode);

      // ── Hetzner ──────────────────────────────────────────────────────────
      if (server.hetznerServerId && server.hetznerApiToken) {
        try {
          const core = await getServerCore(server.hetznerApiToken, server.hetznerServerId);

          if (core.ipv4) {
            rows.push({
              ip: core.ipv4, type: "4",
              location: subLocation,
              role: "Primary", reserved: false,
              serverName,
            });
          }
          if (core.ipv6) {
            rows.push({
              ip: core.ipv6, type: "6",
              location: subLocation,
              role: "Primary", reserved: false,
              serverName,
            });
          }

          // Additional / floating IPs
          let floating = floatingIpsCache.get(server.hetznerApiToken);
          if (!floating) {
            floating = await listFloatingIps(server.hetznerApiToken).catch(() => []);
            floatingIpsCache.set(server.hetznerApiToken, floating);
          }

          const serverIdNum = Number(server.hetznerServerId);
          for (const f of floating) {
            if (f.serverId !== serverIdNum) continue;
            rows.push({
              ip: f.ip, type: f.type === "ipv6" ? "6" : "4",
              location: subLocation,
              role: "Additional", reserved: true,
              serverName,
            });
          }
        } catch {
          // provider unreachable — skip this server's IPs
        }
      }

      // ── Oracle ───────────────────────────────────────────────────────────
      else if (server.oracleInstanceId && server.oracleInstanceRegion) {
        try {
          const o = await getOracleInstanceSummary({
            instanceOcid:    server.oracleInstanceId,
            regionCode:      server.oracleInstanceRegion,
            compartmentOcid: server.oracleCompartmentOcid ?? undefined,
          });

          if (o.ipv4) {
            rows.push({
              ip: o.ipv4, type: "4",
              location: subLocation,
              role: "Primary", reserved: false,
              serverName,
            });
          }
          // Oracle reserved/secondary public IPs not yet implemented
        } catch {
          // provider unreachable — skip this server's IPs
        }
      }
    }

    return NextResponse.json({ ok: true, data: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "Request failed" }, { status: 500 });
  }
}