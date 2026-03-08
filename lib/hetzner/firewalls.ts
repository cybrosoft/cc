// lib/hetzner/firewalls.ts
import type { HetznerFirewallDetails, HetznerFirewallRule } from "./types";
import { hzFetchJson } from "./http";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function parseRule(v: unknown): HetznerFirewallRule | null {
  if (!isRecord(v)) return null;

  const direction = s(v["direction"]).trim();
  if (direction !== "in" && direction !== "out") return null;

  const protocol = s(v["protocol"]).trim();
  if (!protocol) return null;

  const portRaw = v["port"];
  const port = typeof portRaw === "string" ? portRaw : null;

  const src = v["source_ips"];
  const dst = v["destination_ips"];

  const sourceIps =
    Array.isArray(src) ? src.map((x) => s(x).trim()).filter((x) => x.length > 0) : [];
  const destinationIps =
    Array.isArray(dst) ? dst.map((x) => s(x).trim()).filter((x) => x.length > 0) : [];

  const description = s(v["description"]).trim();

  return {
    direction,
    protocol,
    port,
    sourceIps,
    destinationIps,
    description: description || null,
  };
}

function firewallAppliesToServer(fw: Record<string, unknown>, serverIdNum: number): boolean {
  const appliedTo = fw["applied_to"];
  if (!Array.isArray(appliedTo)) return false;

  for (const a of appliedTo) {
    if (!isRecord(a)) continue;
    const type = s(a["type"]).trim();
    const srv = a["server"];
    if (type !== "server" || !isRecord(srv)) continue;
    const id = srv["id"];
    if (isNum(id) && id === serverIdNum) return true;
  }

  return false;
}

export async function listFirewallsForServer(
  token: string,
  serverIdNum: number
): Promise<HetznerFirewallDetails[]> {
  const raw = await hzFetchJson(token, "GET", "/firewalls");
  if (!isRecord(raw)) throw new Error("500:Invalid Hetzner response");

  const firewalls = raw["firewalls"];
  if (!Array.isArray(firewalls)) return [];

  const out: HetznerFirewallDetails[] = [];

  for (const fw of firewalls) {
    if (!isRecord(fw)) continue;
    if (!firewallAppliesToServer(fw, serverIdNum)) continue;

    const id = fw["id"];
    const name = s(fw["name"]).trim();
    if (!isNum(id) || !name) continue;

    const rulesRaw = fw["rules"];
    const rules: HetznerFirewallRule[] = Array.isArray(rulesRaw)
      ? rulesRaw.map(parseRule).filter((x): x is HetznerFirewallRule => x !== null)
      : [];

    out.push({ id, name, rules });
  }

  return out;
}