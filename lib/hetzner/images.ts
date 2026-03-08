// lib/hetzner/images.ts
import type { HetznerImageItem } from "./types";
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

function parseImage(item: unknown, type: "backup" | "snapshot"): HetznerImageItem | null {
  if (!isRecord(item)) return null;

  const id = item["id"];
  const created = s(item["created"]).trim();

  if (!isNum(id) || !created) return null;

  const description = s(item["description"]).trim();
  const status = s(item["status"]).trim();

  // may be number (GB) or something else depending on API; treat carefully
  const sizeGb = isNum(item["image_size"]) ? item["image_size"] : null;

  return {
    id,
    type,
    created,
    description: description || null,
    status: status || null,
    sizeGb,
  };
}

async function listImagesBoundTo(
  token: string,
  type: "backup" | "snapshot",
  serverId: string,
  limit: number
): Promise<HetznerImageItem[]> {
  const qs = new URLSearchParams();
  qs.set("type", type);
  qs.set("bound_to", serverId);

  const raw = await hzFetchJson(token, "GET", `/images?${qs.toString()}`);
  if (!isRecord(raw)) throw new Error("500:Invalid Hetzner response");

  const images = raw["images"];
  if (!Array.isArray(images)) return [];

  const parsed: HetznerImageItem[] = [];
  for (const img of images) {
    const it = parseImage(img, type);
    if (it) parsed.push(it);
  }

  parsed.sort((a, b) => b.created.localeCompare(a.created));
  return parsed.slice(0, limit);
}

export async function listBackups(token: string, serverId: string): Promise<HetznerImageItem[]> {
  return listImagesBoundTo(token, "backup", serverId, 7);
}

export async function listSnapshots(token: string, serverId: string): Promise<HetznerImageItem[]> {
  return listImagesBoundTo(token, "snapshot", serverId, 5);
}