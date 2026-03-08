"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ServerDetails = {
  id: string;
  subscriptionId: string | null;
  hetznerServerId: string;
  name: string | null;
  status: string | null;
  ipv4: string | null;
  ipv6: string | null;
  createdAt: string;
  updatedAt: string;
};

type DetailsResp =
  | { ok: true; server: ServerDetails }
  | { ok: false; error: string };

type RestartResp =
  | { ok: true; action: string; providerStatus: string | null }
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

function parseDetails(raw: unknown): DetailsResp | null {
  if (!raw || !isRecord(raw)) return null;
  const ok = readBoolean(raw, "ok");
  if (ok === true) {
    const server = raw["server"];
    if (!server || !isRecord(server)) return null;
    return { ok: true, server: server as ServerDetails };
  }
  if (ok === false) {
    return { ok: false, error: readString(raw, "error") ?? "UNKNOWN_ERROR" };
  }
  return null;
}

function parseRestart(raw: unknown): RestartResp | null {
  if (!raw || !isRecord(raw)) return null;
  const ok = readBoolean(raw, "ok");
  if (ok === true) {
    return {
      ok: true,
      action: readString(raw, "action") ?? "reboot",
      providerStatus: readString(raw, "providerStatus"),
    };
  }
  if (ok === false) {
    return { ok: false, error: readString(raw, "error") ?? "RESTART_FAILED" };
  }
  return null;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

export default function ServerDetailsClient() {
  const params = useParams();
  const router = useRouter();

  const id = useMemo(() => String(params?.id ?? ""), [params]);

  const [tab, setTab] = useState<"overview" | "backups" | "network" | "volumes">("overview");
  const [loading, setLoading] = useState(false);
  const [server, setServer] = useState<ServerDetails | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [restartBusy, setRestartBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErr(null);

    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(id)}`, { cache: "no-store" });
      const raw = (await res.json().catch(() => null)) as unknown;
      const parsed = parseDetails(raw);

      if (!res.ok || !parsed) {
        setErr(`Failed to load (${res.status})`);
        setServer(null);
        return;
      }
      if (!parsed.ok) {
        setErr(parsed.error);
        setServer(null);
        return;
      }

      setServer(parsed.server);
    } catch {
      setErr("Network error while loading server");
      setServer(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function restart(): Promise<void> {
    if (!server) return;
    if (!confirm("Restart this VPS?")) return;

    setRestartBusy(true);
    try {
      const res = await fetch(`/api/servers/${encodeURIComponent(server.id)}/restart`, {
        method: "POST",
        cache: "no-store",
      });

      const raw = (await res.json().catch(() => null)) as unknown;
      const parsed = parseRestart(raw);

      if (!res.ok || !parsed) {
        alert(`Restart failed (${res.status})`);
        return;
      }
      if (!parsed.ok) {
        alert(parsed.error);
        return;
      }

      alert(`Restart requested. Provider status: ${parsed.providerStatus ?? "unknown"}`);
      await load();
      router.refresh();
    } catch {
      alert("Network error while restarting");
    } finally {
      setRestartBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Server Details</h1>
          <p className="text-sm text-gray-600">Hetzner VPS (more sections coming).</p>
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

      <div className="flex flex-wrap gap-2">
        <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>Overview</TabButton>
        <TabButton active={tab === "backups"} onClick={() => setTab("backups")}>Backups</TabButton>
        <TabButton active={tab === "network"} onClick={() => setTab("network")}>Network & Firewall</TabButton>
        <TabButton active={tab === "volumes"} onClick={() => setTab("volumes")}>Additional Volumes</TabButton>
      </div>

      <div className="rounded-lg border bg-white p-4">
        {tab === "overview" ? (
          server ? (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Info label="Name" value={server.name ?? "—"} />
                <Info label="Status" value={server.status ?? "unknown"} />
                <Info label="Hetzner ID" value={server.hetznerServerId} />
                <Info label="IPv4" value={server.ipv4 ?? "—"} />
                <Info label="IPv6" value={server.ipv6 ?? "—"} />
                <Info label="Created" value={fmt(server.createdAt)} />
              </div>

              <div className="pt-2">
                <button
                  className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
                  onClick={() => void restart()}
                  disabled={restartBusy}
                >
                  {restartBusy ? "Restarting..." : "Restart VPS"}
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-600">Loading…</div>
          )
        ) : tab === "backups" ? (
          <div className="text-sm text-gray-600">
            Backups view coming next (snapshots/backups list).
          </div>
        ) : tab === "network" ? (
          <div className="text-sm text-gray-600">
            Network & Firewall coming next (private networks + firewall rules).
          </div>
        ) : (
          <div className="text-sm text-gray-600">
            Volumes view coming next (attached volumes list).
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100 ${active ? "bg-gray-50" : ""}`}
    >
      {children}
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}