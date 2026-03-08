"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SessionUser } from "@/lib/auth/get-session-user";

type SubscriptionRow = {
  id: string;
  status: string;
  phase: string;
  paymentStatus: string;
  billingProvider: string;
  currency: string;
  yearlyPriceCents: number;
  introMonthCents: number | null;
  activatedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  createdAt: string;
  product: { id: string; name: string; key: string; type: string };
  market: { id: string; name: string; key: string };
};

type ServerMe = {
  id: string;
  hetznerServerId: string | null;
  createdAt: string;
  updatedAt: string;
  status: string | null;
};

type SubsResp =
  | { ok: true; data: SubscriptionRow[] }
  | { ok: false; error: string };

type ServerMeResp =
  | { ok: true; server: ServerMe | null }
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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}

function fmtMoney(cents: number, currency: string): string {
  return `${(cents / 100).toFixed(2)} ${currency}`;
}

function isSubsResp(v: unknown): v is SubsResp {
  if (!isRecord(v)) return false;
  const ok = readBoolean(v, "ok");
  if (ok === true) return Array.isArray(v["data"]);
  if (ok === false) return typeof readString(v, "error") === "string";
  return false;
}

function isServerMeResp(v: unknown): v is ServerMeResp {
  if (!isRecord(v)) return false;
  const ok = readBoolean(v, "ok");
  if (ok === true) return v["server"] === null || isRecord(v["server"]);
  if (ok === false) return typeof readString(v, "error") === "string";
  return false;
}

function isRestartResp(v: unknown): v is RestartResp {
  if (!isRecord(v)) return false;
  const ok = readBoolean(v, "ok");
  if (ok === true) return typeof readString(v, "action") === "string";
  if (ok === false) return typeof readString(v, "error") === "string";
  return false;
}

export default function DashboardClient({ user }: { user: SessionUser }) {
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [server, setServer] = useState<ServerMe | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const [subsRes, serverRes] = await Promise.all([
        fetch("/api/customer/subscriptions", { cache: "no-store" }),
        fetch("/api/servers/me", { cache: "no-store" }),
      ]);

      const subsRaw = (await subsRes.json().catch(() => null)) as unknown;
      const serverRaw = (await serverRes.json().catch(() => null)) as unknown;

      if (!subsRes.ok || subsRaw === null || !isSubsResp(subsRaw)) {
        alert("Failed to load subscriptions");
        return;
      }
      if (!subsRaw.ok) {
        alert(subsRaw.error || "Failed to load subscriptions");
        return;
      }

      if (!serverRes.ok || serverRaw === null || !isServerMeResp(serverRaw)) {
        alert("Failed to load server");
        return;
      }
      if (!serverRaw.ok) {
        alert(serverRaw.error || "Failed to load server");
        return;
      }

      setSubs(subsRaw.data);
      setServer(serverRaw.server);
    } catch {
      alert("Network error while loading dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canRestart = useMemo(() => !!server?.id, [server]);

  async function restart(): Promise<void> {
    if (!server?.id) return;

    try {
      const res = await fetch(`/api/servers/${server.id}/restart`, {
        method: "POST",
        cache: "no-store",
      });

      const raw = (await res.json().catch(() => null)) as unknown;

      if (!res.ok || raw === null || !isRestartResp(raw) || !raw.ok) {
        const msg =
          raw && isRestartResp(raw) && !raw.ok ? raw.error : "Restart failed";
        alert(msg);
        return;
      }

      alert(
        `Restart requested. Provider status: ${
          raw.providerStatus ?? "unknown"
        }`
      );
      await load();
    } catch {
      alert("Network error while restarting server");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-gray-600">
            Your subscriptions and server.
          </p>
        </div>

        <button
          className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100 disabled:opacity-50"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* ✅ Customer Identity Card */}
      <div className="rounded-lg border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs text-gray-500">Customer #</div>
            <div className="text-lg font-semibold">
              {user.customerNumber}
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {user.email}
            </div>
          </div>

          <div className="text-sm text-gray-600">
            <div>
              <span className="text-xs text-gray-500">Market:</span>{" "}
              {user.market.name} ({user.market.key})
            </div>
            <div>
              <span className="text-xs text-gray-500">Group:</span>{" "}
              {user.customerGroup
                ? `${user.customerGroup.name} (${user.customerGroup.key})`
                : "—"}
            </div>
          </div>
        </div>
      </div>

      {/* Subscriptions */}
      <div className="rounded-lg border bg-white p-4">
        <div className="font-medium">Subscriptions</div>

        <div className="mt-3 overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Payment</th>
                <th className="px-4 py-2">Price</th>
                <th className="px-4 py-2">Period</th>
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="font-medium">{s.product.name}</div>
                    <div className="text-xs text-gray-500">
                      {s.market.name}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{s.status}</div>
                    <div className="text-xs text-gray-500">
                      {s.billingProvider}
                    </div>
                  </td>
                  <td className="px-4 py-2">{s.paymentStatus}</td>
                  <td className="px-4 py-2">
                    {fmtMoney(s.yearlyPriceCents, s.currency)}
                    {s.introMonthCents != null ? (
                      <div className="text-xs text-gray-500">
                        Intro:{" "}
                        {fmtMoney(s.introMonthCents, s.currency)}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <div className="text-xs">
                      {fmtDate(s.currentPeriodStart)} →{" "}
                      {fmtDate(s.currentPeriodEnd)}
                    </div>
                  </td>
                </tr>
              ))}

              {subs.length === 0 ? (
                <tr>
                  <td
                    className="px-4 py-6 text-gray-500"
                    colSpan={5}
                  >
                    No subscriptions yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Server */}
      <div className="rounded-lg border bg-white p-4">
        <div className="font-medium">Server</div>

        {server ? (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-xs text-gray-500">
                  Hetzner ID
                </div>
                <div className="font-medium">
                  {server.hetznerServerId ?? "Not assigned"}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500">Status</div>
                <div className="font-medium">
                  {server.status ?? "unknown"}
                </div>
              </div>

              <div>
                <div className="text-xs text-gray-500">
                  Created
                </div>
                <div className="font-medium">
                  {fmtDate(server.createdAt)}
                </div>
              </div>
            </div>

            <button
              className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
              disabled={!canRestart}
              onClick={() => void restart()}
            >
              Restart server
            </button>
          </div>
        ) : (
          <div className="mt-3 text-sm text-gray-600">
            No server found yet. It will appear after admin
            assigns a server.
          </div>
        )}
      </div>
    </div>
  );
}