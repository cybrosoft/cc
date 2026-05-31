// lib/hetzner/index.ts
export type {
  HetznerError,
  HetznerServerCore,
  HetznerServerFull,
  HetznerImageItem,
  HetznerFirewallDetails,
  HetznerFirewallRule,
  HetznerPrivateNetItem,
  HetznerVolumeItem,
} from "./types";

import { parseHetznerError } from "./http";
import { getServerCore, parsePrivateNets, rebootServer, listFloatingIpsForServer, getNetworkName } from "./servers";
import { listBackups, listSnapshots } from "./images";
import { listFirewallsForServer } from "./firewalls";
import { listVolumesForServer } from "./volumes";
import type { HetznerServerFull } from "./types";

export { parseHetznerError, getServerCore, rebootServer, listFloatingIpsForServer, getNetworkName };

export async function getServerFull(token: string, serverId: string): Promise<HetznerServerFull> {
  const core = await getServerCore(token, serverId);

  const privateNetworks = await (async () => {
    const { hzFetchJson } = await import("./http");
    const raw = await hzFetchJson(token, "GET", `/servers/${encodeURIComponent(serverId)}`);
    if (typeof raw !== "object" || raw === null) return [];
    const r = raw as Record<string, unknown>;
    const srv = r["server"];
    if (typeof srv !== "object" || srv === null) return [];
    return parsePrivateNets(srv as Record<string, unknown>);
  })();

  const [backups, snapshots, firewalls, volumes] = await Promise.all([
    listBackups(token, serverId),
    listSnapshots(token, serverId),
    listFirewallsForServer(token, core.id),
    listVolumesForServer(token, core.id),
  ]);

  return {
    core,
    backups,
    snapshots,
    firewalls,
    privateNetworks,
    volumes,
  };
}
