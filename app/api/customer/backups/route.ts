// app/api/customer/backups/route.ts
// Lists backups and snapshots across the customer's active server subscriptions.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { getServerFull } from "@/lib/hetzner";
import { getOracleInstanceSummary } from "@/lib/oracle/compute";

type BackupRow = {
  serverName:  string;
  description: string;
  created:     string;
  sizeGb:      number | null;
  status:      string | null;
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

    const backupRows: BackupRow[]   = [];
    const snapshotRows: BackupRow[] = [];

    for (const sub of subscriptions) {
      const server = sub.servers[0] ?? null;
      if (!server) continue;

      const serverName = (() => {
        const firstLine = sub.productDetails ? sub.productDetails.split("\n")[0].trim() : null;
        if (!firstLine || firstLine === sub.product.name) return sub.product.name;
        return firstLine;
      })();

      // ── Hetzner ──────────────────────────────────────────────────────────
      if (server.hetznerServerId && server.hetznerApiToken) {
        try {
          const full = await getServerFull(server.hetznerApiToken, String(server.hetznerServerId));

          for (const b of full.backups) {
            backupRows.push({
              serverName,
              description: b.description ?? "—",
              created:     b.created,
              sizeGb:      b.sizeGb,
              status:      b.status,
            });
          }
          for (const s of full.snapshots) {
            snapshotRows.push({
              serverName,
              description: s.description ?? "—",
              created:     s.created,
              sizeGb:      s.sizeGb,
              status:      s.status,
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

          // Oracle exposes backup existence only as boolean flags (no per-item detail)
          if (o.backupBootExists) {
            backupRows.push({
              serverName,
              description: "Boot Volume Backup",
              created:     new Date().toISOString(),
              sizeGb:      null,
              status:      "available",
            });
          }
          if (o.backupBlockExists) {
            backupRows.push({
              serverName,
              description: "Block Volume Backup",
              created:     new Date().toISOString(),
              sizeGb:      null,
              status:      "available",
            });
          }
          // Snapshots (custom images) — not yet implemented for Oracle
        } catch {
          // provider unreachable — skip this server
        }
      }
    }

    // Sort by server name
    backupRows.sort((a, b) => a.serverName.localeCompare(b.serverName));
    snapshotRows.sort((a, b) => a.serverName.localeCompare(b.serverName));

    return NextResponse.json({ ok: true, backups: backupRows, snapshots: snapshotRows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "Request failed" }, { status: 500 });
  }
}
