// lib/hetzner/floating-ips.ts
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

export type HetznerFloatingIp = {
  id: number;
  ip: string;
  type: "ipv4" | "ipv6";
  serverId: number | null;
  homeLocation: string | null;
};

function parseFloatingIp(v: unknown): HetznerFloatingIp | null {
  if (!isRecord(v)) return null;

  const id = v["id"];
  const ip = s(v["ip"]).trim();
  const type = s(v["type"]).trim();

  if (!isNum(id) || !ip || (type !== "ipv4" && type !== "ipv6")) return null;

  const serverRaw = v["server"];
  const serverId = isNum(serverRaw) ? serverRaw : null;

  const homeLoc = v["home_location"];
  const homeLocation = isRecord(homeLoc) ? (s(homeLoc["name"]).trim() || null) : null;

  return { id, ip, type, serverId, homeLocation };
}

// Returns all floating IPs on the account, filterable by serverId afterwards
export async function listFloatingIps(token: string): Promise<HetznerFloatingIp[]> {
  const raw = await hzFetchJson(token, "GET", "/floating_ips");
  if (!isRecord(raw)) return [];

  const items = raw["floating_ips"];
  if (!Array.isArray(items)) return [];

  return items.map(parseFloatingIp).filter((x): x is HetznerFloatingIp => x !== null);
}
