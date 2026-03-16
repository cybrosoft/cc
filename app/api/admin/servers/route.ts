// app/api/admin/servers/route.ts
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import { getServerCore } from "@/lib/hetzner";
import { listBackups, listSnapshots } from "@/lib/hetzner/images";
import { listFirewallsForServer } from "@/lib/hetzner/firewalls";
import { getOracleInstanceSummary } from "@/lib/oracle/compute";

function s(v: unknown): string { return typeof v === "string" ? v : ""; }

async function requireAdmin(): Promise<void> {
  const jar = await cookies();
  const sid = jar.get("sid")?.value ?? "";
  if (!sid) throw new Error("unauthorized");
  const now     = new Date();
  const session = await prisma.session.findUnique({
    where:  { id: sid },
    select: { expiresAt: true, user: { select: { role: true } } },
  });
  if (!session) throw new Error("unauthorized");
  if (session.expiresAt.getTime() <= now.getTime()) throw new Error("unauthorized");
  if (session.user.role !== Role.ADMIN && session.user.role !== Role.STAFF) throw new Error("unauthorized");
}

type Vendor = "HETZNER" | "ORACLE" | "UNKNOWN";

type EnrichedSummary = {
  vendor: Vendor;
  status: "OK" | "NA" | null;
  serverStatus: string | null;
  name: string | null;
  ipv4: string | null;
  location: string | null;
  vcpu: number | null;
  ramGb: number | null;
  diskGb: number | null;
  backupExists: boolean | null;
  backupBootExists: boolean | null;
  backupBlockExists: boolean | null;
  snapshotExists: boolean | null;
  firewallExists: boolean | null;
  privateNetworkExists: boolean | null;
  volumesExists: boolean | null;
};

function emptyEnriched(vendor: Vendor): EnrichedSummary {
  return {
    vendor, status: "NA", serverStatus: null,
    name: null, ipv4: null, location: null,
    vcpu: null, ramGb: null, diskGb: null,
    backupExists: null, backupBootExists: null, backupBlockExists: null,
    snapshotExists: null, firewallExists: null,
    privateNetworkExists: null, volumesExists: null,
  };
}

// Detect vendor from product tags: "or" = Oracle, "hz" = Hetzner
// Falls back to checking which IDs are set
function detectVendor(tagKeys: string[], hetznerServerId: string | null, oracleInstanceId: string | null): Vendor {
  const tags = tagKeys.map(t => t.toLowerCase());
  if (tags.includes("or")) return "ORACLE";
  if (tags.includes("hz")) return "HETZNER";
  if (oracleInstanceId) return "ORACLE";
  if (hetznerServerId)  return "HETZNER";
  return "UNKNOWN";
}

export async function GET(req: Request) {
  try {
    await requireAdmin();

    const url      = new URL(req.url);
    const email    = s(url.searchParams.get("email")).trim().toLowerCase();
    const marketId = s(url.searchParams.get("marketId")).trim();
    const page     = Math.max(1, Number(s(url.searchParams.get("page"))) || 1);
    const pageSize = 20;

    const where = email || marketId ? {
      user: {
        ...(email    ? { email: { contains: email, mode: "insensitive" as const } } : {}),
        ...(marketId ? { marketId } : {}),
      },
    } : {};

    const [total, servers] = await Promise.all([
      prisma.server.count({ where }),
      prisma.server.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip:    (page - 1) * pageSize,
        take:    pageSize,
        select: {
          id:                    true,
          createdAt:             true,
          hetznerServerId:       true,
          hetznerApiToken:       true,   // used for API calls only, never returned
          oracleInstanceId:      true,
          oracleInstanceRegion:  true,
          oracleCompartmentOcid: true,
          userId:                true,
          subscriptionId:        true,
          user: { select: { id: true, email: true } },
          subscription: {
            select: {
              id:               true,
              status:           true,
              currentPeriodEnd: true,
              product: {
                select: {
                  name: true,
                  tags: { select: { key: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const data = await Promise.all(
      servers.map(async (sv) => {
        const tagKeys = sv.subscription?.product?.tags?.map(t => t.key) ?? [];
        const vendor  = detectVendor(tagKeys, sv.hetznerServerId, sv.oracleInstanceId);

        const serverId =
          vendor === "ORACLE"  ? sv.oracleInstanceId  :
          vendor === "HETZNER" ? sv.hetznerServerId    :
          sv.hetznerServerId ?? sv.oracleInstanceId ?? null;

        let enriched: EnrichedSummary = emptyEnriched(vendor);

        if (vendor === "HETZNER") {
          const token = (sv.hetznerApiToken ?? "").trim();
          const hzId  = (sv.hetznerServerId ?? "").trim();
          if (token && hzId) {
            try {
              const core = await getServerCore(token, hzId);
              const [backups, snapshots, fw] = await Promise.all([
                listBackups(token, hzId),
                listSnapshots(token, hzId),
                listFirewallsForServer(token, core.id),
              ]);
              enriched = {
                vendor: "HETZNER", status: "OK",
                serverStatus:        core.status,
                name:                core.name,
                ipv4:                core.ipv4,
                location:            core.location,
                vcpu:                core.vcpu,
                ramGb:               core.ramGb,
                diskGb:              core.diskGb,
                backupExists:        backups.length > 0,
                backupBootExists:    null,
                backupBlockExists:   null,
                snapshotExists:      snapshots.length > 0,
                firewallExists:      fw.length > 0,
                privateNetworkExists: core.privateNetworkActive,
                volumesExists:       core.volumesActive,
              };
            } catch { enriched = emptyEnriched("HETZNER"); }
          }
        } else if (vendor === "ORACLE") {
          const ocid   = (sv.oracleInstanceId ?? "").trim();
          const region = (sv.oracleInstanceRegion ?? "").trim();
          if (ocid && region) {
            try {
              const o = await getOracleInstanceSummary({
                instanceOcid:     ocid,
                regionCode:       region,
                compartmentOcid:  sv.oracleCompartmentOcid ?? undefined,
              });
              enriched = {
                vendor: "ORACLE", status: "OK",
                serverStatus:        o.status,
                name:                o.name,
                ipv4:                o.ipv4,
                location:            o.location,
                vcpu:                o.vcpu,
                ramGb:               o.ramGb,
                diskGb:              o.diskGb,
                backupExists:        o.backupBootExists,
                backupBootExists:    o.backupBootExists,
                backupBlockExists:   o.backupBlockExists,
                snapshotExists:      null,
                firewallExists:      o.firewallExists,
                privateNetworkExists: o.privateNetworkExists,
                volumesExists:       o.volumesExists,
              };
            } catch { enriched = emptyEnriched("ORACLE"); }
          }
        }

        return {
          id:                    sv.id,
          createdAt:             sv.createdAt.toISOString(),
          hetznerServerId:       sv.hetznerServerId,
          oracleInstanceId:      sv.oracleInstanceId,
          oracleInstanceRegion:  sv.oracleInstanceRegion,
          oracleCompartmentOcid: sv.oracleCompartmentOcid,
          serverId,
          user:                  sv.user,
          subscription: sv.subscription ? {
            id:               sv.subscription.id,
            status:           sv.subscription.status,
            productName:      sv.subscription.product?.name ?? null,
            currentPeriodEnd: sv.subscription.currentPeriodEnd?.toISOString() ?? null,
          } : null,
          enriched,
        };
      })
    );

    return NextResponse.json({ ok: true, page, pageSize, total, data });
  } catch (e) {
    const msg    = e instanceof Error ? e.message : "Unknown error";
    const status = msg.includes("unauthorized") ? 401 : 500;
    return NextResponse.json(
      { ok: false, error: status === 401 ? "Unauthorized" : msg },
      { status }
    );
  }
}