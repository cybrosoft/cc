// app/api/servers/me/route.ts
// Lists all server subscriptions for the current customer.
// Source of truth: Subscription model (category = "Server")
// Live provider data fetched from Server model if provisioned.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { getServerCore } from "@/lib/hetzner";
import { getOracleInstanceSummary } from "@/lib/oracle/compute";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    // Fetch all subscriptions for this customer where product is in "Server" category
    const subscriptions = await prisma.subscription.findMany({
      where: {
        userId: user.id,
        product: {
          category: { key: "server" },
        },
      },
      orderBy: { createdAt: "desc" },
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
          select: { key: true, name: true, categoryId: true, tags: { select: { key: true } } },
        },
        servers: {
          select: {
            id:                   true,
            hetznerServerId:      true,
            hetznerApiToken:      true,
            oracleInstanceId:      true,
            oracleInstanceRegion:  true,
            oracleCompartmentOcid: true,
          },
          take: 1,
        },
      },
    });

    // Fetch all locations for display
    const allLocations = await prisma.location.findMany({
      select: { code: true, name: true, countryCode: true },
    });
    const locationMap = new Map(allLocations.map(l => [l.code, l]));

    // For each subscription, fetch live server data if provisioned
    const data = await Promise.all(
      subscriptions.map(async (sub) => {
        const server = sub.servers[0] ?? null;

        const isHetzner = !!server?.hetznerServerId;
        const isOracle  = !!server?.oracleInstanceId;
        const provider  = isHetzner ? "HETZNER" : isOracle ? "ORACLE" : "UNKNOWN";

        let name:     string | null = null;
        let status:   string | null = "N/A";
        let ipv4:     string | null = null;
        let ipv6:     string | null = null;
        let location: string | null = null;
        let vcpu:     number | null = null;
        let ramGb:    number | null = null;
        let diskGb:   number | null = null;

        if (isHetzner && server?.hetznerApiToken) {
          try {
            const core = await getServerCore(server.hetznerApiToken, server.hetznerServerId!);
            name     = core.name;
            status   = core.status;
            ipv4     = core.ipv4;
            ipv6     = core.ipv6;
            location = core.location;
            vcpu     = core.vcpu;
            ramGb    = core.ramGb;
            diskGb   = core.diskGb;
          } catch {
            status = "N/A";
          }
        } else if (isOracle && server?.oracleInstanceId && server?.oracleInstanceRegion) {
          try {
            const o  = await getOracleInstanceSummary({
              instanceOcid:    server.oracleInstanceId,
              regionCode:      server.oracleInstanceRegion,
              compartmentOcid: server.oracleCompartmentOcid ?? undefined,
            });
            name     = o.name;
            status   = o.status;
            ipv4     = o.ipv4;
            location = o.location;
            vcpu     = o.vcpu;
            ramGb    = o.ramGb;
            diskGb   = o.diskGb;
          } catch {
            status = "N/A";
          }
        }

        return {
          // Subscription fields
          subscriptionId:     sub.id,
          subscriptionStatus: String(sub.status),
          paymentStatus:      String(sub.paymentStatus),
          billingPeriod:      String(sub.billingPeriod),
          periodEnd:          sub.currentPeriodEnd?.toISOString() ?? null,
          locationCode:       sub.locationCode ?? null,
          templateSlug:       sub.templateSlug ?? null,
          productKey:         sub.product.key,
          productName:        sub.product.name,
          serverName:         (() => {
            const firstLine = sub.productDetails ? sub.productDetails.split('\n')[0].trim() : null;
            if (!firstLine || firstLine === sub.product.name) return null;
            return firstLine;
          })(),
          createdAt:          sub.createdAt.toISOString(),
          os:                 sub.product.tags.map((t: any) => t.key.toLowerCase()).includes("windows") ? "Windows" : sub.product.tags.map((t: any) => t.key.toLowerCase()).includes("linux") ? "Linux" : null,
          locationDisplay:    (() => {
            const code = sub.locationCode;
            if (!code) return null;
            const loc = locationMap.get(code);
            if (!loc) return code;
            return loc.countryCode ? `${loc.countryCode} - ${loc.name}` : loc.name;
          })(),
          // Server fields
          serverId:           server?.id ?? null,
          provider,
          provisioned:        !!server,
          // Live provider data
          name, status, ipv4, ipv6, location, vcpu, ramGb, diskGb,
        };
      })
    );

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message ?? "Request failed" }, { status: 500 });
  }
}
