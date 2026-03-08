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
function b(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}

function parseLocation(serverObj: Record<string, unknown>): string | null {
  const dc = serverObj["datacenter"];
  if (!isRecord(dc)) return null;
  const loc = dc["location"];
  if (!isRecord(loc)) return null;

  const name = s(loc["name"]).trim();
  const city = s(loc["city"]).trim();
  const country = s(loc["country"]).trim();
  const parts = [name, city, country].filter((x) => x.length > 0);
  return parts.length ? parts.join(" / ") : null;
}

function parseIps(serverObj: Record<string, unknown>): { ipv4: string | null; ipv6: string | null } {
  let ipv4: string | null = null;
  let ipv6: string | null = null;

  const publicNet = serverObj["public_net"];
  if (!isRecord(publicNet)) return { ipv4, ipv6 };

  const ipv4Obj = publicNet["ipv4"];
  if (isRecord(ipv4Obj)) {
    const ip = s(ipv4Obj["ip"]).trim();
    ipv4 = ip || null;
  }

  const ipv6Obj = publicNet["ipv6"];
  if (isRecord(ipv6Obj)) {
    const ip = s(ipv6Obj["ip"]).trim();
    ipv6 = ip || null;
  }

  return { ipv4, ipv6 };
}

function parseSpecs(serverObj: Record<string, unknown>): { vcpu: number | null; ramGb: number | null; diskGb: number | null } {
  const st = serverObj["server_type"];
  if (!isRecord(st)) return { vcpu: null, ramGb: null, diskGb: null };

  const cores = st["cores"];
  const memory = st["memory"]; // GB
  const disk = st["disk"]; // GB

  return {
    vcpu: isNum(cores) ? cores : null,
    ramGb: isNum(memory) ? memory : null,
    diskGb: isNum(disk) ? disk : null,
  };
}

function parseExistFlags(serverObj: Record<string, unknown>): {
  firewallActive: boolean | null;
  privateNetworkActive: boolean | null;
  volumesActive: boolean | null;
} {
  const fw = serverObj["firewalls"];
  const pn = serverObj["private_net"];
  const vols = serverObj["volumes"];

  const firewallActive = Array.isArray(fw) ? fw.length > 0 : null;
  const privateNetworkActive = Array.isArray(pn) ? pn.length > 0 : null;
  const volumesActive = Array.isArray(vols) ? vols.length > 0 : null;

  return { firewallActive, privateNetworkActive, volumesActive };
}

export function parsePrivateNets(serverObj: Record<string, unknown>): HetznerPrivateNetItem[] {
  const pn = serverObj["private_net"];
  if (!Array.isArray(pn)) return [];

  const out: HetznerPrivateNetItem[] = [];
  for (const item of pn) {
    if (!isRecord(item)) continue;

    const networkIdRaw = item["network"];
    const ip = s(item["ip"]).trim();
    const mac = s(item["mac_address"]).trim();

    const aliasRaw = item["alias_ips"];
    const aliasIps: string[] = Array.isArray(aliasRaw)
      ? aliasRaw.map((x) => s(x).trim()).filter((x) => x.length > 0)
      : [];

    if (!isNum(networkIdRaw) || !ip) continue;

    out.push({
      networkId: networkIdRaw,
      ip,
      aliasIps,
      macAddress: mac || null,
    });
  }

  return out;
}

export async function getServerCore(token: string, serverId: string): Promise<HetznerServerCore> {
  const raw = await hzFetchJson(token, "GET", `/servers/${encodeURIComponent(serverId)}`);
  if (!isRecord(raw)) throw new Error("500:Invalid Hetzner response");

  const srv = raw["server"];
  if (!isRecord(srv)) throw new Error("500:Invalid Hetzner response");

  const idRaw = srv["id"];
  const name = s(srv["name"]).trim();
  const status = s(srv["status"]).trim();

  if (!isNum(idRaw) || !name || !status) throw new Error("500:Invalid Hetzner server payload");

  const { ipv4, ipv6 } = parseIps(srv);
  const location = parseLocation(srv);
  const { vcpu, ramGb, diskGb } = parseSpecs(srv);

  const outgoingTrafficBytes = isNum(srv["outgoing_traffic"]) ? srv["outgoing_traffic"] : null;

  const { firewallActive, privateNetworkActive, volumesActive } = parseExistFlags(srv);

  return {
    id: idRaw,
    name,
    status,
    ipv4,
    ipv6,
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

export async function rebootServer(token: string, serverId: string): Promise<{ actionId: number }> {
  const raw = await hzFetchJson(token, "POST", `/servers/${encodeURIComponent(serverId)}/actions/reboot`);
  if (!isRecord(raw)) throw new Error("500:Invalid Hetzner response");

  const action = raw["action"];
  if (!isRecord(action)) throw new Error("500:Invalid Hetzner response");

  const idRaw = action["id"];
  if (!isNum(idRaw)) throw new Error("500:Invalid Hetzner action payload");

  return { actionId: idRaw };
}