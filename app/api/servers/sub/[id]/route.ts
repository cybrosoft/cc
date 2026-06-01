// app/api/servers/sub/[id]/route.ts
// Fetches server detail by subscriptionId — works provisioned or not
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { getServerCore, getServerFull, listFloatingIpsForServer } from "@/lib/hetzner";
import type { HetznerImageItem, HetznerFirewallDetails, HetznerPrivateNetItem, HetznerVolumeItem } from "@/lib/hetzner";
import { getOracleInstanceSummary, getOracleSecurityRules } from "@/lib/oracle/compute";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { id: subscriptionId } = await context.params;
  if (!subscriptionId) return NextResponse.json({ ok: false, error: "INVALID_ID" }, { status: 400 });

  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, userId: user.id },
    select: {
      id:                 true,
      status:             true,
      paymentStatus:      true,
      billingPeriod:      true,
      currentPeriodStart: true,
      currentPeriodEnd:   true,
      locationCode:       true,
      templateSlug:       true,
      productDetails:     true,
      createdAt:          true,
      product: {
        select: {
          key:  true,
          name: true,
          tags: { select: { key: true } },
        },
      },
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

  if (!sub) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const serverName = (() => {
    const firstLine = sub.productDetails ? sub.productDetails.split('\n')[0].trim() : null;
    if (!firstLine || firstLine === sub.product.name) return null;
    return firstLine;
  })();

  const server      = sub.servers[0] ?? null;
  const isHetzner   = !!server?.hetznerServerId;
  const isOracle    = !!server?.oracleInstanceId;
  const provider    = isHetzner ? "HETZNER" : isOracle ? "ORACLE" : null;
  const provisioned = !!server;

  const templateInfo = sub.templateSlug
    ? await prisma.osTemplate.findFirst({
        where:  { slug: sub.templateSlug },
        select: { name: true, family: true },
      })
    : null;
  const templateDisplay = templateInfo
    ? [templateInfo.family, templateInfo.name].filter(Boolean).join(" — ")
    : (sub.templateSlug ?? null);

  const locRecord = sub.locationCode
    ? await prisma.location.findFirst({
        where:  { code: sub.locationCode },
        select: { name: true, countryCode: true },
      })
    : null;
  const locationDisplay = locRecord
    ? (locRecord.countryCode ? `${locRecord.countryCode} - ${locRecord.name}` : locRecord.name)
    : (sub.locationCode ?? null);

  const tagKeys = sub.product.tags.map(t => t.key.toLowerCase());
  const os = tagKeys.includes("windows") ? "Windows" : tagKeys.includes("linux") ? "Linux" : null;

  // Live provider data — graceful fallback
  let liveStatus:         string | null            = null;
  let liveIpv4:           string | null            = null;
  let liveIpv6:           string | null            = null;
  let liveLocation:       string | null            = null;
  let liveVcpu:           number | null            = null;
  let liveRamGb:          number | null            = null;
  let liveDiskGb:         number | null            = null;
  let liveHostname:       string | null            = null;
  let livePrivateIp:      string | null            = null;
  let liveIpv4Reserved:   boolean | null           = null;
  let liveIpv6Reserved:   boolean | null           = null;
  let liveAdditionalIps:  string[]                 = [];
  let liveAdditionalDisk: number | null            = null;
  let liveBackups:        HetznerImageItem[]       = [];
  let liveSnapshots:      HetznerImageItem[]       = [];
  let liveFirewalls:      HetznerFirewallDetails[] = [];
  let livePrivateNets:    HetznerPrivateNetItem[]  = [];
  let liveVolumes:        HetznerVolumeItem[]      = [];

  if (isHetzner && server?.hetznerApiToken) {
    try {
      const full    = await getServerFull(server.hetznerApiToken, String(server.hetznerServerId!));
      const core    = full.core;
      liveStatus    = core.status;
      liveIpv4      = core.ipv4;
      liveIpv6      = core.ipv6;
      liveLocation  = core.location;
      liveVcpu      = core.vcpu;
      liveRamGb     = core.ramGb;
      liveDiskGb    = core.diskGb;
      liveHostname  = core.name;
      liveBackups   = full.backups;
      liveSnapshots = full.snapshots;
      liveFirewalls = full.firewalls;
      liveVolumes   = full.volumes;
      livePrivateIp   = full.privateNetworks[0]?.ip ?? null;
      livePrivateNets = full.privateNetworks;
      liveIpv4Reserved = full.core.ipv4Reserved ?? null;
      try {
        const floatingData = await listFloatingIpsForServer(server.hetznerApiToken!, String(server.hetznerServerId!));
        liveAdditionalIps  = floatingData.ips.map(f => f.ip);
        if (liveIpv4 && floatingData.ips.some(f => f.ip === liveIpv4 && f.type === "ipv4")) {
          liveIpv4Reserved = true;
        } else if (liveIpv4) {
          liveIpv4Reserved = false;
        }
        const floatingIpv6 = floatingData.ips.find(f => f.type === "ipv6");
        if (liveIpv6 && floatingIpv6) {
          const liveBase     = liveIpv6.replace(/\/\d+$/, "").toLowerCase();
          const floatingBase = floatingIpv6.ip.replace(/\/\d+$/, "").toLowerCase();
          liveIpv6Reserved   = liveBase === floatingBase ? true : false;
        } else if (liveIpv6) {
          liveIpv6Reserved = false;
        }
      } catch { liveAdditionalIps = []; }
      liveAdditionalDisk = full.volumes.reduce((sum, v) => sum + (v.sizeGb ?? 0), 0) || null;
    } catch {
      liveStatus = "N/A";
    }

  } else if (isOracle && server?.oracleInstanceId && server?.oracleInstanceRegion) {
    try {
      const o = await getOracleInstanceSummary({
        instanceOcid:    server.oracleInstanceId,
        regionCode:      server.oracleInstanceRegion,
        compartmentOcid: server.oracleCompartmentOcid ?? undefined,
      });

      liveStatus        = o.status;
      liveIpv4          = o.ipv4;
      liveLocation      = o.location;
      liveVcpu          = o.vcpu;
      liveRamGb         = o.ramGb;
      liveDiskGb        = o.diskGb;
      liveHostname      = o.name;
      liveIpv4Reserved  = o.ipv4Reserved ?? null;
      liveAdditionalIps = o.additionalIps ?? [];
      liveAdditionalDisk = o.additionalDiskGb ?? null;

      // Map Oracle privateNetworkExists → privateNetworks array
      if (o.privateNetworkExists) {
        livePrivateIp = liveIpv4; // Oracle private IP is separate — best we have without extra call
        livePrivateNets = [{
          networkId:  0,
          ip:         liveIpv4 ?? "N/A",
          aliasIps:   [],
          macAddress: null,
        }];
      }

      // Map Oracle volumesExists → volumes array (count only, no detail without extra call)
      if (o.volumesExists) {
        liveVolumes = [{
          id:          0,
          name:        "Block Volume",
          sizeGb:      o.additionalDiskGb ?? null,
          linuxDevice: null,
          format:      null,
          status:      "available",
        }];
      }

      // Map Oracle backups → backups array
      if (o.backupBootExists) {
        liveBackups = [{
          id:          0,
          type:        "backup",
          description: "Boot Volume Backup",
          created:     new Date().toISOString(), // exact date not available without extra call
          status:      "available",
          sizeGb:      null,
        }];
      }
      if (o.backupBlockExists) {
        liveBackups = [...liveBackups, {
          id:          1,
          type:        "backup",
          description: "Block Volume Backup",
          created:     new Date().toISOString(),
          status:      "available",
          sizeGb:      null,
        }];
      }

      // Firewalls — fetch Oracle Security List rules
      try {
        if (server?.oracleCompartmentOcid) {
          const oracleFws = await getOracleSecurityRules({
            instanceOcid:    server.oracleInstanceId!,
            regionCode:      server.oracleInstanceRegion!,
            compartmentOcid: server.oracleCompartmentOcid,
          });
          // Map OracleFirewall → HetznerFirewallDetails shape (same structure)
          liveFirewalls = oracleFws.map(fw => ({
            id:    0,
            name:  fw.name,
            rules: fw.rules.map(r => ({
              direction:      r.direction,
              protocol:       r.protocol,
              port:           r.port,
              sourceIps:      r.sourceIps,
              destinationIps: r.destinationIps,
              description:    r.description,
            })),
          }));
        }
      } catch {
        // Security list fetch failed — leave empty, don't break the page
        liveFirewalls = [];
      }

    } catch {
      liveStatus = "N/A";
    }
  }

  return NextResponse.json({
    ok: true,
    server: {
      subscriptionId:     sub.id,
      subscriptionStatus: String(sub.status),
      paymentStatus:      String(sub.paymentStatus),
      billingPeriod:      String(sub.billingPeriod),
      periodEnd:          sub.currentPeriodEnd?.toISOString() ?? null,
      locationCode:       sub.locationCode ?? null,
      locationDisplay,
      templateSlug:       sub.templateSlug ?? null,
      templateDisplay,
      productKey:         sub.product.key,
      productName:        sub.product.name,
      serverName,
      os,
      createdAt:          sub.createdAt.toISOString(),
      serverId:           server?.id ?? null,
      provider,
      provisioned,
      hetznerServerId:    server?.hetznerServerId ?? null,
      oracleInstanceId:   server?.oracleInstanceId ?? null,
      oracleRegion:       server?.oracleInstanceRegion ?? null,
      status:             liveStatus,
      hostname:           liveHostname,
      ipv4:               liveIpv4,
      ipv6:               liveIpv6,
      location:           liveLocation,
      vcpu:               liveVcpu,
      ramGb:              liveRamGb,
      diskGb:             liveDiskGb,
      privateIp:          livePrivateIp,
      ipv4Reserved:       liveIpv4Reserved,
      ipv6Reserved:       liveIpv6Reserved,
      additionalIps:      liveAdditionalIps,
      additionalDiskGb:   liveAdditionalDisk,
      backups:            liveBackups,
      snapshots:          liveSnapshots,
      firewalls:          liveFirewalls,
      privateNetworks:    livePrivateNets,
      volumes:            liveVolumes,
    },
  });
}
