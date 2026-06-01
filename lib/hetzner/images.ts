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

  const rawSize = item["image_size"];
  const sizeGb = isNum(rawSize) ? Math.round(rawSize * 100) / 100 : null;

  return {
    id,
    type,
    created,
    description: description || null,
    status: status || null,
    sizeGb,
  };
}

// Backups: bound_to query param works fine for type=backup
export async function listBackups(token: string, serverId: string): Promise<HetznerImageItem[]> {
  const qs = new URLSearchParams({ type: "backup", bound_to: serverId });
  const raw = await hzFetchJson(token, "GET", `/images?${qs.toString()}`);
  if (!isRecord(raw)) throw new Error("500:Invalid Hetzner response");

  const images = raw["images"];
  if (!Array.isArray(images)) return [];

  const parsed: HetznerImageItem[] = [];
  for (const img of images) {
    const it = parseImage(img, "backup");
    if (it) parsed.push(it);
  }

  parsed.sort((a, b) => b.created.localeCompare(a.created));
  return parsed.slice(0, 7);
}

// Snapshots: bound_to is null for snapshots — match via created_from.id instead
export async function listSnapshots(token: string, serverId: string): Promise<HetznerImageItem[]> {
  const serverIdNum = parseInt(serverId, 10);
  if (isNaN(serverIdNum)) return [];

  const qs = new URLSearchParams({ type: "snapshot" });
  const raw = await hzFetchJson(token, "GET", `/images?${qs.toString()}`);
  if (!isRecord(raw)) throw new Error("500:Invalid Hetzner response");

  const images = raw["images"];
  if (!Array.isArray(images)) return [];

  const parsed: HetznerImageItem[] = [];
  for (const img of images) {
    if (!isRecord(img)) continue;
    // created_from is { id: number, name: string } — the server the snapshot was taken from
    const createdFrom = img["created_from"];
    if (!isRecord(createdFrom)) continue;
    if (createdFrom["id"] !== serverIdNum) continue;
    const it = parseImage(img, "snapshot");
    if (it) parsed.push(it);
  }

  parsed.sort((a, b) => b.created.localeCompare(a.created));
  return parsed.slice(0, 5);
}