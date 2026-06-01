// app/api/customer/servers/[id]/oracle-firewall/route.ts
// [id] = subscriptionId
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { setOracleSecurityRules } from "@/lib/oracle/compute";
import type { OracleFwRule } from "@/lib/oracle/compute";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

    const { id: subscriptionId } = await context.params;

    const sub = await prisma.subscription.findFirst({
      where:  { id: subscriptionId, userId: user.id },
      select: {
        servers: {
          select: {
            oracleInstanceId:      true,
            oracleInstanceRegion:  true,
            oracleCompartmentOcid: true,
          },
          take: 1,
        },
      },
    });

    if (!sub) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const server = sub.servers[0];
    if (!server?.oracleInstanceId || !server?.oracleInstanceRegion || !server?.oracleCompartmentOcid)
      return NextResponse.json({ ok: false, error: "NOT_AN_ORACLE_SERVER" }, { status: 400 });

    const body  = await req.json().catch(() => null);
    const rules = body?.rules;
    if (!Array.isArray(rules))
      return NextResponse.json({ ok: false, error: "RULES_REQUIRED" }, { status: 400 });

    // Validate each rule
    const validProtocols = ["tcp", "udp", "icmp", "all"];
    for (const r of rules) {
      if (!["in", "out"].includes(r.direction))
        return NextResponse.json({ ok: false, error: `Invalid direction: ${r.direction}` }, { status: 400 });
      if (!validProtocols.includes((r.protocol ?? "").toLowerCase()))
        return NextResponse.json({ ok: false, error: `Invalid protocol: ${r.protocol}` }, { status: 400 });
    }

    const typedRules: OracleFwRule[] = rules.map(r => ({
      direction:      r.direction,
      protocol:       r.protocol.toLowerCase(),
      port:           r.port || null,
      sourceIps:      r.sourceIps      ?? [],
      destinationIps: r.destinationIps ?? [],
      description:    r.description    || null,
    }));

    await setOracleSecurityRules({
      instanceOcid:    server.oracleInstanceId,
      regionCode:      server.oracleInstanceRegion,
      compartmentOcid: server.oracleCompartmentOcid,
      rules:           typedRules,
    });

    return NextResponse.json({ ok: true });

  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[oracle-firewall route]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
