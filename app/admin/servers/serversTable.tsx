"use client";
// app/admin/servers/serversTable.tsx

import { useEffect, useMemo, useState } from "react";
import {
  PageShell, Card, Table, TR, TD, FiltersBar, Input, Select,
  Btn, Alert, Empty, CLR, Modal, Field, SaveRow,
} from "@/components/ui/admin-ui";
import Icon from "@/components/ui/Icon";

// ─── Types ────────────────────────────────────────────────────────────────────
type Vendor = "HETZNER" | "ORACLE" | "UNKNOWN";

type EnrichedSummary = {
  vendor: Vendor;
  status: "OK" | "NA" | null;
  serverStatus: string | null;
  name: string | null;
  ipv4: string | null;
  location: string | null;
  vcpu: number | null;
  ramGb: number | null;
  diskGb: number | null;
  backupExists: boolean | null;
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
    currentPeriodEnd: string | null;
    productName: string | null;
  } | null;
  hetznerServerId: string | null;
  oracleInstanceId: string | null;
  oracleInstanceRegion: string | null;
  oracleCompartmentOcid: string | null;
  serverId: string | null;
  enriched: EnrichedSummary;
};

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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function yesNo(v: boolean | null | undefined, naLabel = "—"): string {
  if (v === undefined || v === null) return naLabel;
  return v ? "Yes" : "No";
}

function displayServerId(r: Row): string {
  if (r.serverId) return r.serverId;
  if (r.enriched.vendor === "ORACLE") return r.oracleInstanceId ?? "";
  return r.hetznerServerId ?? r.oracleInstanceId ?? "";
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function ServerStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span style={{ color: CLR.faint }}>—</span>;
  const s = status.toLowerCase();
  const map: Record<string, { bg: string; color: string; border: string; dot: string }> = {
    running:      { bg: "#f0fdf4", color: "#15803d", border: "#86efac", dot: "#22c55e" },
    running_with_faults: { bg: "#f0fdf4", color: "#15803d", border: "#86efac", dot: "#22c55e" },
    stopped:      { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5", dot: "#ef4444" },
    stopping:     { bg: "#fff7ed", color: "#c2410c", border: "#fdba74", dot: "#f97316" },
    starting:     { bg: "#eff6ff", color: "#2563eb", border: "#93c5fd", dot: "#3b82f6" },
    provisioning: { bg: "#eff6ff", color: "#2563eb", border: "#93c5fd", dot: "#3b82f6" },
    rebuilding:   { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe", dot: "#8b5cf6" },
    migrating:    { bg: "#f5f3ff", color: "#7c3aed", border: "#ddd6fe", dot: "#8b5cf6" },
    off:          { bg: "#f8fafc", color: "#64748b", border: "#cbd5e1", dot: "#94a3b8" },
    terminated:   { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5", dot: "#ef4444" },
  };
  const c = map[s] ?? { bg: "#f8fafc", color: "#64748b", border: "#cbd5e1", dot: "#94a3b8" };
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, padding: "2px 8px",
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {status}
    </span>
  );
}

// ─── Vendor badge ─────────────────────────────────────────────────────────────
function VendorBadge({ vendor }: { vendor: Vendor }) {
  if (vendor === "UNKNOWN") return <span style={{ color: CLR.faint }}>—</span>;
  const isOracle = vendor === "ORACLE";
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px",
      background: isOracle ? "#eff6ff" : "#f0fdf4",
      color:      isOracle ? "#1d4ed8" : "#15803d",
      border:     `1px solid ${isOracle ? "#bfdbfe" : "#86efac"}`,
    }}>{vendor}</span>
  );
}

// ─── Bool cell ────────────────────────────────────────────────────────────────
function BoolCell({ value, naLabel = "—" }: { value: boolean | null | undefined; naLabel?: string }) {
  if (value === null || value === undefined) return <span style={{ color: CLR.faint }}>{naLabel}</span>;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: "2px 7px",
      background: value ? "#f0fdf4" : "#f8fafc",
      color:      value ? "#15803d" : CLR.muted,
      border:     `1px solid ${value ? "#86efac" : CLR.border}`,
    }}>{value ? "Yes" : "No"}</span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ServersTable() {
  const [allRows,  setAllRows]  = useState<Row[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Filters
  const [fEmail,  setFEmail]  = useState("");
  const [fVendor, setFVendor] = useState("");
  const [fStatus, setFStatus] = useState("");

  const [edit,        setEdit]        = useState<EditState>({ open: false });
  const [rebootingId, setRebootingId] = useState<string | null>(null);
  const [rebootMsg,   setRebootMsg]   = useState<string | null>(null);

  async function load(p = page) {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ page: String(p) });
      if (fEmail.trim()) qs.set("email", fEmail.trim());
      const r = await fetch(`/api/admin/servers?${qs}`, { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setError(`Failed to load (${r.status})`); return; }
      setAllRows(j.data ?? []);
      setTotal(j.total ?? 0);
      setPage(j.page ?? 1);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  // Client-side filter by vendor + status
  const rows = useMemo(() => allRows.filter(r => {
    if (fVendor && r.enriched.vendor !== fVendor) return false;
    if (fStatus && (r.enriched.serverStatus ?? "").toLowerCase() !== fStatus.toLowerCase()) return false;
    return true;
  }), [allRows, fVendor, fStatus]);

  async function saveEdit() {
    if (!edit.open) return;
    setEdit({ ...edit, saving: true, error: null });
    try {
      const r = await fetch("/api/admin/servers/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverRecordId:      edit.serverRecordId,
          vendor:              edit.vendor,
          hetznerServerId:     edit.vendor === "HETZNER" ? edit.newServerId  : undefined,
          hetznerApiToken:     edit.vendor === "HETZNER" ? edit.token        : undefined,
          oracleInstanceId:    edit.vendor === "ORACLE"  ? edit.newServerId  : undefined,
          oracleInstanceRegion:edit.vendor === "ORACLE"  ? edit.oracleRegion : undefined,
          oracleCompartmentOcid: edit.vendor === "ORACLE" ? edit.oracleCompartmentOcid : undefined,
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setEdit({ ...edit, saving: false, error: j?.error ?? `Failed (${r.status})` }); return; }
      setEdit({ open: false });
      void load();
    } catch { setEdit({ ...edit, saving: false, error: "Network error" }); }
  }

  async function reboot(serverRecordId: string) {
    if (!confirm("Restart this server now?")) return;
    setRebootingId(serverRecordId); setRebootMsg(null);
    try {
      const r = await fetch("/api/admin/servers/reboot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverRecordId }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setRebootMsg(j?.error ?? "Reboot failed"); return; }
      setRebootMsg("Restart requested successfully.");
      void load();
    } catch { setRebootMsg("Network error"); }
    finally { setRebootingId(null); }
  }

  const hasFilters = !!(fEmail || fVendor || fStatus);

  return (
    <PageShell breadcrumb="ADMIN / SERVERS" title="Servers">

      {rebootMsg && (
        <div style={{ marginBottom: 16 }}>
          <Alert type={rebootMsg.includes("success") ? "success" : "error"}>{rebootMsg}</Alert>
        </div>
      )}
      {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

      {/* Stats */}
      {!loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 12, color: CLR.faint }}>{total} total</span>
          <span style={{ fontSize: 11, padding: "2px 8px", background: "#f0fdf4", color: "#15803d", border: "1px solid #86efac", fontWeight: 600 }}>
            {allRows.filter(r => r.enriched.serverStatus?.toLowerCase() === "running").length} running
          </span>
          <span style={{ fontSize: 11, padding: "2px 8px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5", fontWeight: 600 }}>
            {allRows.filter(r => r.enriched.vendor === "HETZNER").length} Hetzner
          </span>
          <span style={{ fontSize: 11, padding: "2px 8px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", fontWeight: 600 }}>
            {allRows.filter(r => r.enriched.vendor === "ORACLE").length} Oracle
          </span>
        </div>
      )}

      <Card>
        {/* Filter bar */}
        <FiltersBar>
          <Input value={fEmail} onChange={setFEmail} placeholder="Search email…" style={{ width: 220 }} />
          <Select value={fVendor} onChange={setFVendor} style={{ minWidth: 130 }}>
            <option value="">All Vendors</option>
            <option value="HETZNER">Hetzner</option>
            <option value="ORACLE">Oracle</option>
          </Select>
          <Select value={fStatus} onChange={setFStatus} style={{ minWidth: 130 }}>
            <option value="">All Statuses</option>
            <option value="running">Running</option>
            <option value="stopped">Stopped</option>
            <option value="starting">Starting</option>
            <option value="stopping">Stopping</option>
            <option value="provisioning">Provisioning</option>
          </Select>
          <Btn onClick={() => { setPage(1); void load(1); }} disabled={loading}>
            {loading ? "Loading…" : "Apply"}
          </Btn>
          {hasFilters && <Btn variant="ghost" onClick={() => { setFEmail(""); setFVendor(""); setFStatus(""); }}>Clear</Btn>}
          <span style={{ marginLeft: "auto", fontSize: 12, color: CLR.faint }}>
            {rows.length} of {total}
          </span>
        </FiltersBar>

        {/* Table */}
        {loading ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: CLR.faint }}>Loading…</div>
        ) : rows.length === 0 ? (
          <Empty message="No servers found." />
        ) : (
          <Table cols={["Customer", "Vendor", "Name / ID", "Status", "IPv4", "Location", "Specs", "Backup", "Snapshot", "Firewall", "Private Net", "Volumes", "Subscription", "Actions"]}>
            <tbody>
              {rows.map(r => {
                const v = r.enriched.vendor;
                const serverId = displayServerId(r);
                const canReboot = (v === "HETZNER" && !!serverId) ||
                  (v === "ORACLE" && !!r.oracleInstanceId && !!r.oracleInstanceRegion);
                const rebooting = rebootingId === r.id;
                const specs = r.enriched.vcpu && r.enriched.ramGb && r.enriched.diskGb
                  ? `${r.enriched.vcpu}vCPU / ${r.enriched.ramGb}GB / ${r.enriched.diskGb}GB`
                  : "—";

                return (
                  <TR key={r.id}>
                    <TD>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{r.user.email}</div>
                    </TD>
                    <TD><VendorBadge vendor={v} /></TD>
                    <TD>
                      <div style={{ fontWeight: 500 }}>{r.enriched.name ?? "—"}</div>
                      {serverId && (
                        <div style={{ fontFamily: "monospace", fontSize: 10, color: CLR.faint, marginTop: 2 }}>
                          {serverId.length > 32 ? serverId.slice(0, 32) + "…" : serverId}
                        </div>
                      )}
                    </TD>
                    <TD><ServerStatusBadge status={r.enriched.serverStatus} /></TD>
                    <TD mono muted>{r.enriched.ipv4 ?? "—"}</TD>
                    <TD muted>{r.enriched.location ?? "—"}</TD>
                    <TD muted style={{ whiteSpace: "nowrap", fontSize: 12 }}>{specs}</TD>
                    <TD>
                      {v === "ORACLE" ? (
                        <div style={{ fontSize: 12 }}>
                          <div>Boot: <BoolCell value={r.enriched.backupBootExists ?? r.enriched.backupExists} naLabel="NA" /></div>
                          <div style={{ marginTop: 3 }}>Disk: <BoolCell value={r.enriched.backupBlockExists} naLabel="NA" /></div>
                        </div>
                      ) : (
                        <BoolCell value={r.enriched.backupExists} />
                      )}
                    </TD>
                    <TD>
                      {v === "ORACLE"
                        ? <span style={{ color: CLR.faint }}>—</span>
                        : <BoolCell value={r.enriched.snapshotExists} />
                      }
                    </TD>
                    <TD><BoolCell value={r.enriched.firewallExists} /></TD>
                    <TD><BoolCell value={r.enriched.privateNetworkExists} /></TD>
                    <TD><BoolCell value={r.enriched.volumesExists} /></TD>
                    <TD>
                      {r.subscription ? (
                        <div>
                          {r.subscription.productName && (
                            <div style={{ fontSize: 12, fontWeight: 500, color: CLR.text, marginBottom: 3 }}>
                              {r.subscription.productName}
                            </div>
                          )}
                          <span style={{
                            fontSize: 11, fontWeight: 600, padding: "2px 7px",
                            background: r.subscription.status === "ACTIVE" ? "#f0fdf4" : "#fffbeb",
                            color:      r.subscription.status === "ACTIVE" ? "#15803d" : "#92400e",
                            border:     `1px solid ${r.subscription.status === "ACTIVE" ? "#86efac" : "#fde047"}`,
                          }}>{r.subscription.status}</span>
                          {r.subscription.currentPeriodEnd && (
                            <div style={{ fontSize: 10, color: CLR.faint, marginTop: 3 }}>
                              Exp: {new Date(r.subscription.currentPeriodEnd).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: CLR.faint }}>—</span>
                      )}
                    </TD>
                    <TD right>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <Btn variant="outline" onClick={() => setEdit({
                          open: true, serverRecordId: r.id, vendor: v,
                          currentServerId: serverId || null,
                          newServerId: serverId ?? "",
                          token: "",
                          oracleRegion: r.oracleInstanceRegion ?? "",
                          oracleCompartmentOcid: r.oracleCompartmentOcid ?? "",
                          saving: false, error: null,
                        })}>Edit</Btn>
                        <Btn
                          variant="outline"
                          disabled={!canReboot || rebooting}
                          onClick={() => void reboot(r.id)}
                        >
                          {rebooting ? "…" : "Restart"}
                        </Btn>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </tbody>
          </Table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: `1px solid ${CLR.border}` }}>
            <Btn disabled={loading || page <= 1} onClick={() => { setPage(p => p - 1); void load(page - 1); }}>← Prev</Btn>
            <span style={{ fontSize: 12, color: CLR.muted }}>Page {page} of {totalPages}</span>
            <Btn disabled={loading || page >= totalPages} onClick={() => { setPage(p => p + 1); void load(page + 1); }}>Next →</Btn>
          </div>
        )}
      </Card>

      {/* Edit Modal */}
      <Modal open={edit.open} onClose={() => setEdit({ open: false })} title="Modify Server" width={480}>
        {edit.open && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Info */}
            <div style={{ padding: "10px 14px", background: "#f8fafc", border: `1px solid ${CLR.border}` }}>
              <div style={{ display: "flex", gap: 12 }}>
                <VendorBadge vendor={edit.vendor} />
                <span style={{ fontSize: 12, color: CLR.muted }}>
                  Current ID: <span style={{ fontFamily: "monospace", color: CLR.text }}>{edit.currentServerId ?? "Not assigned"}</span>
                </span>
              </div>
            </div>

            {/* Hetzner fields */}
            {edit.vendor === "HETZNER" && (
              <>
                <Field label="Server ID" required>
                  <input className="cy-input" value={edit.newServerId}
                    onChange={e => setEdit({ ...edit, newServerId: e.target.value })}
                    placeholder="Numeric Hetzner server ID" disabled={edit.saving} />
                </Field>
                <Field label="Project Key (API Token)">
                  <input className="cy-input" type="password" value={edit.token}
                    onChange={e => setEdit({ ...edit, token: e.target.value })}
                    placeholder="Leave blank to keep existing" disabled={edit.saving} />
                  <span style={{ fontSize: 11, color: CLR.faint }}>Always blank for security. Leave empty = no change.</span>
                </Field>
              </>
            )}

            {/* Oracle fields */}
            {edit.vendor === "ORACLE" && (
              <>
                <Field label="Instance OCID" required>
                  <input className="cy-input" value={edit.newServerId}
                    onChange={e => setEdit({ ...edit, newServerId: e.target.value })}
                    placeholder="ocid1.instance.oc1.xxx…" disabled={edit.saving} />
                </Field>
                <Field label="Instance Region" required>
                  <input className="cy-input" value={edit.oracleRegion}
                    onChange={e => setEdit({ ...edit, oracleRegion: e.target.value })}
                    placeholder="e.g. me-jeddah-1" disabled={edit.saving} />
                </Field>
                <Field label="Compartment OCID" required>
                  <input className="cy-input" value={edit.oracleCompartmentOcid}
                    onChange={e => setEdit({ ...edit, oracleCompartmentOcid: e.target.value })}
                    placeholder="ocid1.compartment.oc1.xxx…" disabled={edit.saving} />
                </Field>
              </>
            )}

            {edit.vendor === "UNKNOWN" && (
              <div style={{ padding: "12px 14px", background: "#fef9c3", border: "1px solid #fde047", fontSize: 12, color: "#92400e" }}>
                Unknown vendor. Update the subscription's product category to detect Hetzner or Oracle.
              </div>
            )}

            {edit.error && <Alert type="error">{edit.error}</Alert>}

            <SaveRow
              onCancel={() => setEdit({ open: false })}
              onSave={() => void saveEdit()}
              saving={edit.saving}
              saveLabel="Update Server"
            />
          </div>
        )}
      </Modal>

    </PageShell>
  );
}