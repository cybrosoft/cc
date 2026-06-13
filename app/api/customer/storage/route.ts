// app/api/customer/storage/route.ts
// Lists boot disks and additional storage volumes for the customer's
// active server subscriptions.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { getServerCore } from "@/lib/hetzner";
import { listVolumesForServer } from "@/lib/hetzner/volumes";
import { getOracleInstanceSummary } from "@/lib/oracle/compute";

type StorageRow = {
  serverName: string;
  sizeGb:     number | null;
  location:   string | null;
  status:     string | null;
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

    const bootRows: StorageRow[]   = [];
    const volumeRows: StorageRow[] = [];

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

          bootRows.push({
            serverName,
            sizeGb:   core.diskGb,
            location: subLocation,
            status:   core.status,
          });

          const volumes = await listVolumesForServer(server.hetznerApiToken, Number(server.hetznerServerId)).catch(() => []);
          for (const v of volumes) {
            volumeRows.push({
              serverName,
              sizeGb:   v.sizeGb,
              location: subLocation,
              status:   v.status,
            });
          }
        } catch {
          // provider unreachable — skip this server
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

          bootRows.push({
            serverName,
            sizeGb:   o.diskGb,
            location: subLocation,
            status:   o.status,
          });

          // Oracle additional volumes — only a boolean flag is available today,
          // so show a single summary row when present (no per-volume sizes).
          if (o.volumesExists) {
            volumeRows.push({
              serverName,
              sizeGb:   null,
              location: subLocation,
              status:   "attached",
            });
          }
        } catch {
          // provider unreachable — skip this server
        }
      }
    }

    return NextResponse.json({ ok: true, boot: bootRows, volumes: volumeRows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "Request failed" }, { status: 500 });
  }
}
