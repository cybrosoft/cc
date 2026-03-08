// FILE: app/admin/servers/serversTable.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Vendor = "HETZNER" | "ORACLE" | "UNKNOWN";

type EnrichedSummary = {
  vendor: Vendor;

  // fetch/enrichment status (for NA logic)
  status: "OK" | "NA" | null;

  // provider lifecycle status (running/stopped/PROVISIONING/etc.)
  serverStatus: string | null;

  name: string | null;
  ipv4: string | null;
  location: string | null;

  vcpu: number | null;
  ramGb: number | null;
  diskGb: number | null;

  // Existing (kept for compatibility)
  backupExists: boolean | null;

  // ✅ NEW (Oracle-only) - may be absent until API is updated, so keep optional
  backupBootExists?: boolean | null;
  backupBlockExists?: boolean | null;

  snapshotExists: boolean | null;
  firewallExists: boolean | null;
  privateNetworkExists: boolean | null;
  volumesExists: boolean | null;
};

type Row = {
  id: string;

  createdAt: string;
  user: { id: string; email: string };
  subscription: {
    id: string;
    status: string;
    billingProvider: string;
    currentPeriodEnd: string | null;
    productCategoryKey?: string | null;
    provisionLocation?: string | null;
  } | null;

  hetznerServerId: string | null;

  oracleInstanceId: string | null;
  oracleInstanceRegion: string | null;
  oracleCompartmentOcid: string | null;

  serverId: string | null;

  enriched: EnrichedSummary;
};

type ListResp =
  | { ok: true; page: number; pageSize: number; total: number; data: Row[] }
  | { ok: false; error: string };

type UpdateResp =
  | { ok: true; serverId: string; message?: string }
  | { ok: false; error: string };

type RebootResp =
  | { ok: true; actionId: string | number }
  | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

function readNumber(obj: Record<string, unknown>, key: string): number | null {
  const v = obj[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function readBoolean(obj: Record<string, unknown>, key: string): boolean | null {
  const v = obj[key];
  return typeof v === "boolean" ? v : null;
}

function isVendor(v: unknown): v is Vendor {
  return v === "HETZNER" || v === "ORACLE" || v === "UNKNOWN";
}

function isEnrichedSummary(v: unknown): v is EnrichedSummary {
  if (!isRecord(v)) return false;

  const vendor = v["vendor"];
  const status = v["status"];

  const okStr = (x: unknown) => x === null || typeof x === "string";
  const okNum = (x: unknown) => x === null || (typeof x === "number" && Number.isFinite(x));
  const okBool = (x: unknown) => x === null || typeof x === "boolean";
  const okBoolOpt = (x: unknown) => x === undefined || x === null || typeof x === "boolean";
  const okStatus = (x: unknown) => x === null || x === "OK" || x === "NA";

  return (
    isVendor(vendor) &&
    okStatus(status) &&
    okStr(v["serverStatus"]) &&
    okStr(v["name"]) &&
    okStr(v["ipv4"]) &&
    okStr(v["location"]) &&
    okNum(v["vcpu"]) &&
    okNum(v["ramGb"]) &&
    okNum(v["diskGb"]) &&
    okBool(v["backupExists"]) &&
    okBoolOpt(v["backupBootExists"]) &&
    okBoolOpt(v["backupBlockExists"]) &&
    okBool(v["snapshotExists"]) &&
    okBool(v["firewallExists"]) &&
    okBool(v["privateNetworkExists"]) &&
    okBool(v["volumesExists"])
  );
}

function isRow(v: unknown): v is Row {
  if (!isRecord(v)) return false;

  const id = readString(v, "id");
  const createdAt = readString(v, "createdAt");
  if (!id || !createdAt) return false;

  const hetznerServerId = v["hetznerServerId"];
  const oracleInstanceId = v["oracleInstanceId"];
  const oracleInstanceRegion = v["oracleInstanceRegion"];
  const oracleCompartmentOcid = v["oracleCompartmentOcid"];
  const serverId = v["serverId"];

  if (!(hetznerServerId === null || typeof hetznerServerId === "string")) return false;
  if (!(oracleInstanceId === null || typeof oracleInstanceId === "string")) return false;
  if (!(oracleInstanceRegion === null || typeof oracleInstanceRegion === "string")) return false;
  if (!(oracleCompartmentOcid === null || typeof oracleCompartmentOcid === "string")) return false;
  if (!(serverId === null || typeof serverId === "string")) return false;

  const user = v["user"];
  if (!isRecord(user)) return false;
  if (!readString(user, "id") || !readString(user, "email")) return false;

  const subscription = v["subscription"];
  if (subscription !== null) {
    if (!isRecord(subscription)) return false;
    if (!readString(subscription, "id")) return false;
    if (!readString(subscription, "status")) return false;
    if (!readString(subscription, "billingProvider")) return false;

    const cpe = subscription["currentPeriodEnd"];
    if (!(cpe === null || typeof cpe === "string")) return false;

    const pck = subscription["productCategoryKey"];
    if (!(pck === undefined || pck === null || typeof pck === "string")) return false;

    const pl = subscription["provisionLocation"];
    if (!(pl === undefined || pl === null || typeof pl === "string")) return false;
  }

  const enriched = v["enriched"];
  if (!isEnrichedSummary(enriched)) return false;

  return true;
}

function isListResp(v: unknown): v is ListResp {
  if (!isRecord(v)) return false;

  const ok = readBoolean(v, "ok");
  if (ok === true) {
    const page = readNumber(v, "page");
    const pageSize = readNumber(v, "pageSize");
    const total = readNumber(v, "total");
    const data = v["data"];

    if (page == null || pageSize == null || total == null) return false;
    if (!Array.isArray(data)) return false;
    return data.every(isRow);
  }

  if (ok === false) {
    const error = readString(v, "error");
    return typeof error === "string";
  }

  return false;
}

function isUpdateResp(v: unknown): v is UpdateResp {
  if (!isRecord(v)) return false;

  const ok = readBoolean(v, "ok");
  if (ok === true) {
    const serverId = readString(v, "serverId");
    const message = v["message"];
    return typeof serverId === "string" && (message === undefined || typeof message === "string");
  }

  if (ok === false) {
    const error = readString(v, "error");
    return typeof error === "string";
  }

  return false;
}

function isRebootResp(v: unknown): v is RebootResp {
  if (!isRecord(v)) return false;

  const ok = readBoolean(v, "ok");
  if (ok === true) {
    const actionId = v["actionId"];
    return typeof actionId === "number" || typeof actionId === "string";
  }

  if (ok === false) {
    const error = readString(v, "error");
    return typeof error === "string";
  }

  return false;
}

function yesNoBlank(v: boolean | null): string {
  if (v === null) return "";
  return v ? "Yes" : "No";
}

function yesNoNA(v: boolean | null | undefined): string {
  if (v === undefined || v === null) return "NA";
  return v ? "Yes" : "No";
}

function capBlank(vcpu: number | null, ramGb: number | null, diskGb: number | null): string {
  if (vcpu === null || ramGb === null || diskGb === null) return "";
  return `${vcpu}/${ramGb}GB/${diskGb}GB`;
}

function displayServerId(r: Row): string {
  if (r.serverId) return r.serverId;
  if (r.enriched.vendor === "ORACLE") return r.oracleInstanceId ?? "";
  if (r.enriched.vendor === "HETZNER") return r.hetznerServerId ?? "";
  return r.hetznerServerId ?? r.oracleInstanceId ?? "";
}

function renderBackupCell(r: Row): JSX.Element {
  const vendor = r.enriched.vendor;

  // Hetzner (keep same as before)
  if (vendor !== "ORACLE") {
    return <span>{yesNoBlank(r.enriched.backupExists)}</span>;
  }

  // Oracle: Boot + Disk (Block) backups
  // Backward compatible: if boot flag not returned yet, fallback to backupExists for Boot
  const boot = r.enriched.backupBootExists ?? r.enriched.backupExists ?? null;
  const block = r.enriched.backupBlockExists ?? null;

  return (
    <div className="leading-5">
      <div>Boot: {yesNoNA(boot)}</div>
      <div>Disk: {yesNoNA(block)}</div>
    </div>
  );
}

function renderSnapshotCell(r: Row): JSX.Element {
  if (r.enriched.vendor === "ORACLE") {
    return <span>-</span>;
  }
  return <span>{yesNoBlank(r.enriched.snapshotExists)}</span>;
}

type EditState =
  | { open: false }
  | {
      open: true;
      serverRecordId: string;

      vendor: Vendor;

      currentServerId: string | null;
      newServerId: string;

      token: string;

      oracleRegion: string;
      oracleCompartmentOcid: string;

      saving: boolean;
      error: string | null;
    };

export default function ServersTable() {
  const [email, setEmail] = useState("");
  const [marketId, setMarketId] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<ListResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [edit, setEdit] = useState<EditState>({ open: false });
  const [rebootingId, setRebootingId] = useState<string | null>(null);

  const totalPages = useMemo(() => {
    if (!resp || !resp.ok) return 1;
    return Math.max(1, Math.ceil(resp.total / resp.pageSize));
  }, [resp]);

  async function load(nextPage?: number): Promise<void> {
    const targetPage = nextPage ?? page;

    setLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams();
      qs.set("page", String(targetPage));
      if (email.trim()) qs.set("email", email.trim());
      if (marketId.trim()) qs.set("marketId", marketId.trim());

      const res = await fetch(`/api/admin/servers?${qs.toString()}`, { cache: "no-store" });
      const raw = (await res.json().catch(() => null)) as unknown;

      if (!res.ok || raw === null || !isListResp(raw)) {
        setError(`Failed to load (${res.status})`);
        setResp(null);
        return;
      }

      if (!raw.ok) {
        setError(raw.error || `Failed to load (${res.status})`);
        setResp(null);
        return;
      }

      setResp(raw);
    } catch {
      setError("Network error while loading servers");
      setResp(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    const qEmail = url.searchParams.get("email");
    if (qEmail && !email) setEmail(qEmail);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function saveEdit(): Promise<void> {
    if (!edit.open) return;

    setEdit({ ...edit, saving: true, error: null });

    try {
      const res = await fetch("/api/admin/servers/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverRecordId: edit.serverRecordId,
          vendor: edit.vendor,

          // Hetzner (keep same as before)
          hetznerServerId: edit.vendor === "HETZNER" ? edit.newServerId : undefined,
          hetznerApiToken: edit.vendor === "HETZNER" ? edit.token : undefined,

          // Oracle
          oracleInstanceId: edit.vendor === "ORACLE" ? edit.newServerId : undefined,
          oracleInstanceRegion: edit.vendor === "ORACLE" ? edit.oracleRegion : undefined,
          oracleCompartmentOcid: edit.vendor === "ORACLE" ? edit.oracleCompartmentOcid : undefined,
        }),
      });

      const raw = (await res.json().catch(() => null)) as unknown;

      if (!res.ok || raw === null || !isUpdateResp(raw) || !raw.ok) {
        const msg = raw && isUpdateResp(raw) && !raw.ok ? raw.error : `Failed (${res.status})`;
        setEdit({ ...edit, saving: false, error: msg });
        return;
      }

      setEdit({ open: false });
      await load();
    } catch {
      setEdit({ ...edit, saving: false, error: "Network error while saving" });
    }
  }

  async function reboot(serverRecordId: string): Promise<void> {
    const ok = confirm("Restart this server now?");
    if (!ok) return;

    setRebootingId(serverRecordId);
    try {
      const res = await fetch("/api/admin/servers/reboot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverRecordId }),
      });

      const raw = (await res.json().catch(() => null)) as unknown;

      if (!res.ok || raw === null || !isRebootResp(raw) || !raw.ok) {
        const msg = raw && isRebootResp(raw) && !raw.ok ? raw.error : `Failed (${res.status})`;
        alert(msg);
        return;
      }

      alert("Restart requested.");
      await load();
    } catch {
      alert("Network error while restarting server");
    } finally {
      setRebootingId(null);
    }
  }

  const rows = resp && resp.ok ? resp.data : [];

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-white p-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="Search email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="w-full rounded-md border px-3 py-2 text-sm"
            placeholder="MarketId (optional)"
            value={marketId}
            onChange={(e) => setMarketId(e.target.value)}
          />

          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
            onClick={() => {
              setPage(1);
              void load(1);
            }}
            disabled={loading}
          >
            {loading ? "Loading..." : "Apply"}
          </button>

          <div className="flex items-center justify-end text-sm text-gray-600">
            {resp && resp.ok ? (
              <span>
                {resp.total} total • page {resp.page}/{totalPages}
              </span>
            ) : (
              <span />
            )}
          </div>
        </div>

        {error ? <div className="mt-2 text-sm text-red-600">{error}</div> : null}
      </div>

      <div className="rounded-lg border bg-white">
        <div className="overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-2">User</th>
                <th className="px-4 py-2">Subscription</th>

                <th className="px-4 py-2">Vendor</th>
                {/* ✅ removed "Server ID" column */}

                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">IPv4</th>
                <th className="px-4 py-2">Location</th>
                <th className="px-4 py-2">vCPU/RAM/Disk</th>

                <th className="px-4 py-2">Backup</th>
                <th className="px-4 py-2">Snapshot</th>
                <th className="px-4 py-2">Firewall</th>
                <th className="px-4 py-2">Private</th>
                <th className="px-4 py-2">Volumes</th>

                <th className="px-4 py-2">Created</th>
                <th className="px-4 py-2">Actions</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((r) => {
                const vendor = r.enriched.vendor;
                const serverIdText = displayServerId(r);

                const canRebootHetzner = vendor === "HETZNER" && !!serverIdText && r.enriched.status !== "NA";

                const canRebootOracle =
                  vendor === "ORACLE" &&
                  !!r.oracleInstanceId &&
                  !!r.oracleInstanceRegion &&
                  r.enriched.status !== "NA";

                const canReboot = canRebootHetzner || canRebootOracle;

                const rebooting = rebootingId === r.id;

                return (
                  <tr key={r.id} className="border-t align-top">
                    <td className="px-4 py-2">
                      <div className="font-medium">{r.user.email}</div>
                      <div className="text-xs text-gray-500">{r.user.id}</div>
                    </td>

                    <td className="px-4 py-2">
                      {r.subscription?.id ? (
                        <>
                          <div className="font-medium">{r.subscription.status}</div>
                          <div className="text-xs text-gray-500">{r.subscription.id}</div>
                        </>
                      ) : (
                        <span className="text-gray-500">No subscription</span>
                      )}
                    </td>

                    <td className="px-4 py-2">{vendor === "UNKNOWN" ? "" : vendor}</td>

                    <td className="px-4 py-2">{r.enriched.name ?? ""}</td>

                    <td className="px-4 py-2">{r.enriched.serverStatus ?? r.enriched.status ?? ""}</td>

                    <td className="px-4 py-2">{r.enriched.ipv4 ?? ""}</td>
                    <td className="px-4 py-2">{r.enriched.location ?? ""}</td>
                    <td className="px-4 py-2">{capBlank(r.enriched.vcpu, r.enriched.ramGb, r.enriched.diskGb)}</td>

                    <td className="px-4 py-2">{renderBackupCell(r)}</td>
                    <td className="px-4 py-2">{renderSnapshotCell(r)}</td>
                    <td className="px-4 py-2">{yesNoBlank(r.enriched.firewallExists)}</td>
                    <td className="px-4 py-2">{yesNoBlank(r.enriched.privateNetworkExists)}</td>
                    <td className="px-4 py-2">{yesNoBlank(r.enriched.volumesExists)}</td>

                    <td className="px-4 py-2">{new Date(r.createdAt).toLocaleString()}</td>

                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100"
                          onClick={() => {
                            const currentServerId = serverIdText || null;

                            setEdit({
                              open: true,
                              serverRecordId: r.id,
                              vendor,
                              currentServerId,
                              newServerId: currentServerId ?? "",
                              token: "",
                              oracleRegion: r.oracleInstanceRegion ?? "",
                              oracleCompartmentOcid: r.oracleCompartmentOcid ?? "",
                              saving: false,
                              error: null,
                            });
                          }}
                        >
                          Modify Server
                        </button>

                        <button
                          className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100 disabled:opacity-50"
                          disabled={!canReboot || rebooting}
                          onClick={() => void reboot(r.id)}
                        >
                          {rebooting ? "Restarting..." : "Restart"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={15}>
                    No servers found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
          <button
            className="rounded-md border px-3 py-1.5 hover:bg-gray-100 disabled:opacity-50"
            disabled={loading || page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>

          <div className="text-gray-600">
            Page {page} / {totalPages}
          </div>

          <button
            className="rounded-md border px-3 py-1.5 hover:bg-gray-100 disabled:opacity-50"
            disabled={loading || page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>

      {edit.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-lg border bg-white p-4 shadow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-base font-semibold">Modify Server</div>
                <div className="mt-1 text-sm text-gray-600">
                  Vendor:{" "}
                  <span className="font-medium text-gray-900">{edit.vendor === "UNKNOWN" ? "—" : edit.vendor}</span>
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  Current Server ID:{" "}
                  <span className="font-medium text-gray-900">{edit.currentServerId ?? "Not assigned"}</span>
                </div>
              </div>

              <button
                className="rounded-md border px-2 py-1 text-sm hover:bg-gray-100"
                onClick={() => setEdit({ open: false })}
                disabled={edit.saving}
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium">Server ID</label>
                <input
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  value={edit.newServerId}
                  onChange={(e) => setEdit({ ...edit, newServerId: e.target.value })}
                  placeholder={edit.vendor === "ORACLE" ? "Oracle Instance OCID" : "Hetzner Server ID"}
                  disabled={edit.saving}
                />
              </div>

              {edit.vendor === "HETZNER" ? (
                <div>
                  <label className="block text-sm font-medium">API Token (Hetzner)</label>
                  <input
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                    value={edit.token}
                    onChange={(e) => setEdit({ ...edit, token: e.target.value })}
                    placeholder="Paste token (optional)"
                    disabled={edit.saving}
                  />
                  <div className="mt-1 text-xs text-gray-500">
                    Always empty when opened. If you leave it empty and save, the existing stored token is NOT cleared.
                  </div>
                </div>
              ) : edit.vendor === "ORACLE" ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium">Instance Region Code</label>
                    <input
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      value={edit.oracleRegion}
                      onChange={(e) => setEdit({ ...edit, oracleRegion: e.target.value })}
                      placeholder='e.g. "me-jeddah-1"'
                      disabled={edit.saving}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium">Instance Compartment OCID</label>
                    <input
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      value={edit.oracleCompartmentOcid}
                      onChange={(e) => setEdit({ ...edit, oracleCompartmentOcid: e.target.value })}
                      placeholder="ocid1.compartment..."
                      disabled={edit.saving}
                    />
                    <div className="mt-1 text-xs text-gray-500">
                      Stored for future Oracle enrichment (network/volumes/firewall/backups). Not shown to customers.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500">Unknown vendor. Assign Hetzner or Oracle fields.</div>
              )}

              {edit.error ? <div className="text-sm text-red-600">{edit.error}</div> : null}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
                  onClick={() => setEdit({ open: false })}
                  disabled={edit.saving}
                >
                  Cancel
                </button>

                <button
                  className="rounded-md border px-3 py-2 text-sm hover:bg-gray-100 disabled:opacity-50"
                  onClick={() => void saveEdit()}
                  disabled={edit.saving}
                >
                  {edit.saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}