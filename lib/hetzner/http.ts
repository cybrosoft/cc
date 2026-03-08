// lib/hetzner/http.ts
import type { HetznerError } from "./types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function requireToken(token: string): string {
  const t = token.trim();
  if (!t) throw new Error("Hetzner token missing");
  return t;
}

export async function hzFetchJson(
  token: string,
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = `https://api.hetzner.cloud/v1${path.startsWith("/") ? path : `/${path}`}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${requireToken(token)}`,
  };

  let payload: string | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: payload,
    cache: "no-store",
  });

  const raw = (await res.json().catch(() => null)) as unknown;

  if (res.ok) return raw;

  let msg = `Hetzner API error (${res.status})`;
  if (raw && isRecord(raw)) {
    const err = raw["error"];
    if (isRecord(err)) {
      const m = s(err["message"]).trim();
      if (m) msg = m;
    }
  }

  const e: HetznerError = { status: res.status, message: msg };
  // throw a normal Error but keep status in message (caller can map)
  throw new Error(`${e.status}:${e.message}`);
}

export function parseHetznerError(e: unknown): HetznerError {
  const fallback: HetznerError = { status: 500, message: "Unknown Hetzner error" };
  if (!(e instanceof Error)) return fallback;

  const m = e.message || "";
  const idx = m.indexOf(":");
  if (idx <= 0) return { status: 500, message: m || fallback.message };

  const statusStr = m.slice(0, idx);
  const status = Number(statusStr);
  if (!Number.isFinite(status)) return { status: 500, message: m || fallback.message };

  const message = m.slice(idx + 1).trim() || fallback.message;
  return { status, message };
}