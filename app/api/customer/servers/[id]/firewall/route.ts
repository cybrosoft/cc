// app/api/customer/servers/[id]/firewall/route.ts
// [id] = subscriptionId
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth/get-session-user";
import { listFirewallsForServer, setFirewallRules } from "@/lib/hetzner/firewalls";
import type { HetznerFirewallRule } from "@/lib/hetzner/types";

function s(v: unknown): string { return typeof v === "string" ? v : ""; }

// POST — save updated rules
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { id: subscriptionId } = await context.params;

  const sub = await prisma.subscription.findFirst({
    where:  { id: subscriptionId, userId: user.id },
    select: {
      servers: {
        select: {
          hetznerServerId: true,
          hetznerApiToken: true,
        },
        take: 1,
      },
    },
  });

  if (!sub) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const server = sub.servers[0];
  if (!server?.hetznerServerId || !server?.hetznerApiToken)
    return NextResponse.json({ ok: false, error: "NOT_A_HETZNER_SERVER" }, { status: 400 });

  const body = await req.json().catch(() => null);
  const rules = body?.rules;

  if (!Array.isArray(rules))
    return NextResponse.json({ ok: false, error: "RULES_REQUIRED" }, { status: 400 });

  // Validate each rule
  const validProtocols = ["tcp", "udp", "icmp", "esp", "gre"];
  for (const r of rules) {
    if (!["in", "out"].includes(r.direction))
      return NextResponse.json({ ok: false, error: `Invalid direction: ${r.direction}` }, { status: 400 });
    if (!validProtocols.includes((r.protocol ?? "").toLowerCase()))
      return NextResponse.json({ ok: false, error: `Invalid protocol: ${r.protocol}` }, { status: 400 });
  }

  // Get first firewall ID
  const firewalls = await listFirewallsForServer(
    server.hetznerApiToken,
    parseInt(server.hetznerServerId, 10)
  );

  if (!firewalls.length)
    return NextResponse.json({ ok: false, error: "NO_FIREWALL_ATTACHED" }, { status: 404 });

  const firewallId = firewalls[0].id;

  const typedRules: HetznerFirewallRule[] = rules.map(r => ({
    direction:       r.direction,
    protocol:        r.protocol.toLowerCase(),
    port:            r.port || null,
    sourceIps:       r.sourceIps ?? [],
    destinationIps:  r.destinationIps ?? [],
    description:     r.description || null,
  }));

  await setFirewallRules(server.hetznerApiToken, firewallId, typedRules);

  return NextResponse.json({ ok: true });
}
