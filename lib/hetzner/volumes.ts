// lib/hetzner/volumes.ts
import type { HetznerVolumeItem } from "./types";
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

function parseVolume(v: unknown): HetznerVolumeItem | null {
  if (!isRecord(v)) return null;

  const id = v["id"];
  const name = s(v["name"]).trim();
  if (!isNum(id) || !name) return null;

  const sizeGb = isNum(v["size"]) ? v["size"] : null;
  const linuxDevice = s(v["linux_device"]).trim();
  const format = s(v["format"]).trim();
  const status = s(v["status"]).trim();

  return {
    id,
    name,
    sizeGb,
    linuxDevice: linuxDevice || null,
    format: format || null,
    status: status || null,
  };
}

export async function listVolumesForServer(
  token: string,
  serverIdNum: number
): Promise<HetznerVolumeItem[]> {
  const raw = await hzFetchJson(token, "GET", "/volumes");
  if (!isRecord(raw)) throw new Error("500:Invalid Hetzner response");

  const vols = raw["volumes"];
  if (!Array.isArray(vols)) return [];

  const out: HetznerVolumeItem[] = [];
  for (const v of vols) {
    const parsed = parseVolume(v);
    if (!parsed) continue;

    // Hetzner attaches via `server` property (number|null)
    // We filter by attached server id
    // Because parsedVolume doesn't include server field, check original
    if (!isRecord(v)) continue;
    const srv = v["server"];
    if (isNum(srv) && srv === serverIdNum) out.push(parsed);
  }

  return out;
}