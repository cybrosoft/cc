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
import { getServerCore, parsePrivateNets, rebootServer } from "./servers";
import { listBackups, listSnapshots } from "./images";
import { listFirewallsForServer } from "./firewalls";
import { listVolumesForServer } from "./volumes";
import type { HetznerServerFull } from "./types";

export { parseHetznerError, getServerCore, rebootServer };

export async function getServerFull(token: string, serverId: string): Promise<HetznerServerFull> {
  const core = await getServerCore(token, serverId);

  // We need private nets from the server payload. We already computed exist flag,
  // but full requires details. The simplest correct approach is to refetch core payload
  // and parse private_net; to avoid extra call later we can enhance getServerCore to return it.
  // For now: make one extra GET for private nets via servers endpoint.
  // (Still OK for detail page)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const privateNetworks = await (async () => {
    // Reuse servers endpoint via getServerCore? not enough. We parse by refetching minimal.
    // We'll do a local re-fetch using getServerCore isn't giving the raw, so keep it simple:
    // NOTE: This is the only place with a second server fetch; acceptable for now.
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