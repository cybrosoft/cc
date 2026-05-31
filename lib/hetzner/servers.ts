// lib/hetzner/servers.ts
import type { HetznerPrivateNetItem, HetznerServerCore } from "./types";
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

function parseLocation(serverObj: Record<string, unknown>): string | null {
  const dc = serverObj["datacenter"];
  if (!isRecord(dc)) return null;
  const loc = dc["location"];
  if (!isRecord(loc)) return null;
  const name    = s(loc["name"]).trim();
  const city    = s(loc["city"]).trim();
  const country = s(loc["country"]).trim();
  const parts   = [name, city, country].filter((x) => x.length > 0);
  return parts.length ? parts.join(" / ") : null;
}

function parseIps(serverObj: Record<string, unknown>): {
  ipv4: string | null;
  ipv4Reserved: boolean | null;
  ipv6: string | null;
  additionalIps: string[];
} {
  let ipv4:         string | null  = null;
  let ipv4Reserved: boolean | null = null;
  let ipv6:         string | null  = null;
  const additionalIps: string[]    = [];

  const publicNet = serverObj["public_net"];
  if (!isRecord(publicNet)) return { ipv4, ipv4Reserved, ipv6, additionalIps };

  // Collect floating IP addresses first (from public_net.floating_ips)
  // In Hetzner API these are integer IDs only — full details fetched separately
  // via listFloatingIpsForServer. Here we only parse if full objects are returned.
  const floatingIpAddresses: string[] = [];
  const floatingIpsRaw = publicNet["floating_ips"];
  if (Array.isArray(floatingIpsRaw)) {
    for (const fip of floatingIpsRaw) {
      if (isRecord(fip)) {
        const ip = s(fip["ip"]).trim();
        if (ip) floatingIpAddresses.push(ip);
      }
    }
  }

  // Primary IPv4
  const ipv4Obj = publicNet["ipv4"];
  if (isRecord(ipv4Obj)) {
    const ip = s(ipv4Obj["ip"]).trim();
    ipv4 = ip || null;
    // Reserved if this same IP appears as a floating IP
    // (floating IPs persist after server deletion = reserved)
    if (ip) {
      ipv4Reserved = floatingIpAddresses.includes(ip) ? true : false;
    }
  }

  // Primary IPv6
  const ipv6Obj = publicNet["ipv6"];
  if (isRecord(ipv6Obj)) {
    const ip = s(ipv6Obj["ip"]).trim().replace(/\/\d+$/, "");
    ipv6 = ip || null;
  }

  return { ipv4, ipv4Reserved, ipv6, additionalIps };
}

function parseSpecs(serverObj: Record<string, unknown>): {
  vcpu: number | null;
  ramGb: number | null;
  diskGb: number | null;
} {
  const st = serverObj["server_type"];
  if (!isRecord(st)) return { vcpu: null, ramGb: null, diskGb: null };
  const cores  = st["cores"];
  const memory = st["memory"];
  const disk   = st["disk"];
  return {
    vcpu:   isNum(cores)  ? cores  : null,
    ramGb:  isNum(memory) ? memory : null,
    diskGb: isNum(disk)   ? disk   : null,
  };
}

function parseExistFlags(serverObj: Record<string, unknown>): {
  firewallActive: boolean | null;
  privateNetworkActive: boolean | null;
  volumesActive: boolean | null;
} {
  const fw   = serverObj["firewalls"];
  const pn   = serverObj["private_net"];
  const vols = serverObj["volumes"];
  return {
    firewallActive:       Array.isArray(fw)   ? fw.length   > 0 : null,
    privateNetworkActive: Array.isArray(pn)   ? pn.length   > 0 : null,
    volumesActive:        Array.isArray(vols) ? vols.length > 0 : null,
  };
}

export function parsePrivateNets(serverObj: Record<string, unknown>): HetznerPrivateNetItem[] {
  const pn = serverObj["private_net"];
  if (!Array.isArray(pn)) return [];

  const out: HetznerPrivateNetItem[] = [];
  for (const item of pn) {
    if (!isRecord(item)) continue;
    const networkIdRaw = item["network"];
    const ip           = s(item["ip"]).trim();
    const mac          = s(item["mac_address"]).trim();
    const aliasRaw     = item["alias_ips"];
    const aliasIps: string[] = Array.isArray(aliasRaw)
      ? aliasRaw.map((x) => s(x).trim()).filter((x) => x.length > 0)
      : [];
    if (!isNum(networkIdRaw) || !ip) continue;
    out.push({ networkId: networkIdRaw, ip, aliasIps, macAddress: mac || null });
  }
  return out;
}

export async function getServerCore(token: string, serverId: string): Promise<HetznerServerCore> {
  const raw = await hzFetchJson(token, "GET", `/servers/${encodeURIComponent(serverId)}`);
  if (!isRecord(raw)) throw new Error("500:Invalid Hetzner response");

  const srv = raw["server"];
  if (!isRecord(srv)) throw new Error("500:Invalid Hetzner response");

  const idRaw  = srv["id"];
  const name   = s(srv["name"]).trim();
  const status = s(srv["status"]).trim();
  if (!isNum(idRaw) || !name || !status) throw new Error("500:Invalid Hetzner server payload");

  const { ipv4, ipv4Reserved, ipv6, additionalIps } = parseIps(srv);
  const location = parseLocation(srv);
  const { vcpu, ramGb, diskGb } = parseSpecs(srv);
  const outgoingTrafficBytes = isNum(srv["outgoing_traffic"]) ? srv["outgoing_traffic"] : null;
  const { firewallActive, privateNetworkActive, volumesActive } = parseExistFlags(srv);

  return {
    id: idRaw,
    name,
    status,
    ipv4,
    ipv4Reserved,
    ipv6,
    additionalIps,
    location,
    vcpu,
    ramGb,
    diskGb,
    outgoingTrafficBytes,
    firewallActive,
    privateNetworkActive,
    volumesActive,
  };
}

export async function listFloatingIpsForServer(token: string, serverId: string): Promise<{
  ips: Array<{ id: number; ip: string; type: string }>;
}> {
  // Hetzner: GET /floating_ips?server=<id>
  const raw = await hzFetchJson(token, "GET", `/floating_ips?server=${encodeURIComponent(serverId)}`);
  if (!isRecord(raw)) return { ips: [] };
  const items = raw["floating_ips"];
  if (!Array.isArray(items)) return { ips: [] };

  const ips: Array<{ id: number; ip: string; type: string }> = [];
  for (const fip of items) {
    if (!isRecord(fip)) continue;
    const id   = fip["id"];
    const ip   = s(fip["ip"]).trim();
    const type = s(fip["type"]).trim(); // "ipv4" | "ipv6"
    if (isNum(id) && ip) ips.push({ id, ip, type });
  }
  return { ips };
}

export async function rebootServer(token: string, serverId: string): Promise<{ actionId: number }> {
  const raw = await hzFetchJson(token, "POST", `/servers/${encodeURIComponent(serverId)}/actions/reboot`);
  if (!isRecord(raw)) throw new Error("500:Invalid Hetzner response");
  const action = raw["action"];
  if (!isRecord(action)) throw new Error("500:Invalid Hetzner response");
  const idRaw = action["id"];
  if (!isNum(idRaw)) throw new Error("500:Invalid Hetzner action payload");
  return { actionId: idRaw };
}

export async function getNetworkName(token: string, networkId: number): Promise<string | null> {
  try {
    const raw = await hzFetchJson(token, "GET", `/networks/${encodeURIComponent(String(networkId))}`);
    if (!isRecord(raw)) return null;
    const net = raw["network"];
    if (!isRecord(net)) return null;
    return s(net["name"]).trim() || null;
  } catch {
    return null;
  }
}
