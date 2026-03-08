"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type ServerRow = {
  id: string;
  subscriptionId: string | null;
  hetznerServerId: string | null;
  provider: "HETZNER" | "ORACLE" | "UNKNOWN";
  name: string | null;
  status: string | null;
  ipv4: string | null;
  ipv6: string | null;
  createdAt: string;
  updatedAt: string;
};

type ServersMeResp =
  | { ok: true; servers: ServerRow[]; server: ServerRow | null }
  | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
function readBoolean(obj: Record<string, unknown>, key: string): boolean | null {
  const v = obj[key];
  return typeof v === "boolean" ? v : null;
}
function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

function parseServersMe(raw: unknown): ServersMeResp | null {
  if (!raw || !isRecord(raw)) return null;
  const ok = readBoolean(raw, "ok");
  if (ok === true) {
    const servers = raw["servers"];
    const server = raw["server"];
    if (!Array.isArray(servers)) return null;
    // server can be null or object
    if (!(server === null || isRecord(server))) return null;
    return { ok: true, servers: servers as ServerRow[], server: server as ServerRow | null };
  }
  if (ok === false) {
    const error = readString(raw, "error") ?? "UNKNOWN_ERROR";
    return { ok: false, error };
  }
  return null;
}

function badgeCls(status: string | null): string {
  if (!status) return "border-gray-200 bg-gray-50 text-gray-700";
  if (status === "running") return "border-green-200 bg-green-50 text-green-700";
  if (status === "off") return "border-red-200 bg-red-50 text-red-700";
  return "border-yellow-200 bg-yellow-50 text-yellow-800";
}

export default function ServersClient() {
  const [loading, setLoading] = useState(false);
  const [servers, setServers] = useState<ServerRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/servers/me", { cache: "no-store" });
      const raw = (await res.json().catch(() => null)) as unknown;
      const parsed = parseServersMe(raw);

      if (!res.ok || !parsed) {
        setErr(`Failed to load servers (${res.status})`);
        setServers([]);
        return;
      }
      if (!parsed.ok) {
        setErr(parsed.error);
        setServers([]);
        return;
      }

      setServers(parsed.servers);
    } catch {
      setErr("Network error while loading servers");
      setServers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hetznerServers = useMemo(
    () => servers.filter((s) => s.provider === "HETZNER" && !!s.hetznerServerId),
    [servers]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Servers</h1>
          <p className="text-sm text-gray-600">
            Your VPS list (Hetzner only for now).
          </p>
        </div>

        <button
          className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100 disabled:opacity-50"
          disabled={loading}
          onClick={() => void load()}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {err ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {err}
        </div>
      ) : null}

      <div className="overflow-auto rounded-lg border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">IPv4</th>
              <th className="px-4 py-2">IPv6</th>
              <th className="px-4 py-2">Firewall</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 text-right">Actions</th>
            </tr>
          </thead>

          <tbody>
            {hetznerServers.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2">
                  <div className="font-medium">{s.name ?? "—"}</div>
                  <div className="text-xs text-gray-500">#{s.hetznerServerId ?? "—"}</div>
                </td>

                <td className="px-4 py-2">{s.ipv4 ?? "—"}</td>
                <td className="px-4 py-2">{s.ipv6 ?? "—"}</td>

                {/* Firewall status will be implemented later from Hetzner firewall API */}
                <td className="px-4 py-2 text-gray-500">—</td>

                <td className="px-4 py-2">
                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${badgeCls(s.status)}`}>
                    {s.status ?? "unknown"}
                  </span>
                </td>

                <td className="px-4 py-2 text-right">
                  <Link
                    className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100"
                    href={`/dashboard/servers/${encodeURIComponent(s.id)}`}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}

            {hetznerServers.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={6}>
                  No Hetzner servers assigned yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}