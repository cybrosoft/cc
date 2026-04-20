// app/admin/customers/CustomerForm.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageShell, Card, CardHeader, Field, Input, Select, Textarea,
  Alert, SaveRow, CLR,
} from "@/components/ui/admin-ui";

type AccountType = "BUSINESS" | "PERSONAL";
type MarketOpt   = { id: string; key: string; name: string };
type GroupOpt    = { id: string; key: string; name: string };
type TagRow      = { id: string; key: string; name: string };

const SAUDI_PROVINCES = [
  "Riyadh Province", "Makkah al-Mukarramah Province",
  "Al-Madinah Al-Munawwarah Province", "Eastern Province (Ash Sharqiyah)",
  "Aseer Province", "Tabuk Province", "Hail Province",
  "Al-Qassim Province", "Jazan Province", "Najran Province",
  "Al-Bahah Province", "Al-Jawf Province", "Northern Borders Province",
];

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; border: string }> = {
  PENDING:       { label: "Pending Approval", bg: "#fff8e6", color: "#92400e", border: "#fcd34d" },
  ACTIVE:        { label: "Active",           bg: "#e8f5f0", color: "#166534", border: "#a7d9d1" },
  INFO_REQUIRED: { label: "Info Required",    bg: "#fdf0ef", color: "#991b1b", border: "#fca5a5" },
  SUSPENDED:     { label: "Suspended",        bg: "#f3f4f6", color: "#374151", border: "#d1d5db" },
  REJECTED:      { label: "Rejected",         bg: "#fdf0ef", color: "#7f1d1d", border: "#fca5a5" },
};

const STATUS_ACTIONS: Record<string, Array<{ action: string; label: string; variant: "primary" | "danger" | "warning" | "outline"; needsReason?: boolean; needsMessage?: boolean; reasonLabel?: string }>> = {
  PENDING: [
    { action: "ACTIVE",        label: "Approve",           variant: "primary" },
    { action: "INFO_REQUIRED", label: "Request Info",      variant: "warning", needsMessage: true, reasonLabel: "Information needed" },
    { action: "REJECTED",      label: "Reject",            variant: "danger",  needsReason: true,  reasonLabel: "Reason for rejection" },
  ],
  INFO_REQUIRED: [
    { action: "ACTIVE",        label: "Approve",           variant: "primary" },
    { action: "SUSPENDED",     label: "Suspend",           variant: "danger",  needsReason: true,  reasonLabel: "Reason for suspension" },
    { action: "REJECTED",      label: "Reject",            variant: "danger",  needsReason: true,  reasonLabel: "Reason for rejection" },
  ],
  ACTIVE: [
    { action: "INFO_REQUIRED", label: "Request Info",      variant: "warning", needsMessage: true, reasonLabel: "Information needed" },
    { action: "SUSPENDED",     label: "Suspend",           variant: "danger",  needsReason: true,  reasonLabel: "Reason for suspension" },
  ],
  SUSPENDED: [
    { action: "ACTIVE",        label: "Reactivate",        variant: "primary" },
  ],
  REJECTED: [
    { action: "ACTIVE",        label: "Reactivate",        variant: "primary" },
  ],
};

// ── Status Action Panel ───────────────────────────────────────────────────────
function StatusPanel({ customerId, currentStatus, onStatusChanged }: {
  customerId: string;
  currentStatus: string;
  onStatusChanged: (newStatus: string) => void;
}) {
  const [modal,   setModal]   = useState<typeof STATUS_ACTIONS[string][0] | null>(null);
  const [text,    setText]    = useState("");
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState<string | null>(null);

  const cfg     = STATUS_CONFIG[currentStatus] ?? { label: currentStatus, bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" };
  const actions = STATUS_ACTIONS[currentStatus] ?? [];

  function openModal(a: typeof STATUS_ACTIONS[string][0]) {
    setText(""); setErr(null); setModal(a);
  }

  async function execute() {
    if (!modal) return;
    if ((modal.needsReason || modal.needsMessage) && !text.trim()) {
      setErr(`${modal.reasonLabel ?? "A message"} is required.`); return;
    }
    setSaving(true); setErr(null);
    try {
      const res = await fetch(`/api/admin/users/${customerId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action:  modal.action,
          reason:  modal.needsReason  ? text.trim() : undefined,
          message: modal.needsMessage ? text.trim() : undefined,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok || !d?.ok) { setErr(d?.error ?? "Failed to update status"); return; }
      setModal(null);
      onStatusChanged(modal.action);
    } catch { setErr("Network error"); }
    finally  { setSaving(false); }
  }

  const btnStyle = (variant: string): React.CSSProperties => {
    const base: React.CSSProperties = { padding: "6px 14px", fontSize: 12, fontWeight: 600, border: "1px solid", cursor: "pointer", fontFamily: "inherit" };
    if (variant === "primary") return { ...base, background: CLR.primary, color: "#fff",    borderColor: CLR.primary };
    if (variant === "danger")  return { ...base, background: "#dc2626",   color: "#fff",    borderColor: "#dc2626"   };
    if (variant === "warning") return { ...base, background: "#b45309",   color: "#fff",    borderColor: "#b45309"   };
    return                            { ...base, background: "#fff",      color: CLR.text,  borderColor: "#e5e7eb"   };
  };

  return (
    <>
      <Card>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: CLR.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Account Status</span>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
              padding: "3px 10px", background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
            }}>
              {cfg.label}
            </span>
          </div>
          {actions.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {actions.map(a => (
                <button key={a.action} onClick={() => openModal(a)} style={btnStyle(a.variant)}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", width: "100%", maxWidth: 480, border: "1px solid #e5e7eb", boxShadow: "0 8px 32px rgba(0,0,0,0.15)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: 14, color: CLR.text }}>{modal.label}</span>
              <button onClick={() => setModal(null)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: CLR.muted, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: "20px" }}>
              {(modal.needsReason || modal.needsMessage) && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: CLR.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    {modal.reasonLabel ?? "Message"} <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <textarea
                    value={text} onChange={e => { setText(e.target.value); setErr(null); }}
                    rows={4} placeholder={modal.needsMessage ? "Describe what information is needed…" : "Provide a reason…"}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, border: "1px solid #d1d5db", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                  />
                </div>
              )}
              {!modal.needsReason && !modal.needsMessage && (
                <p style={{ fontSize: 13, color: CLR.text, margin: "0 0 16px" }}>
                  Are you sure you want to <strong>{modal.label.toLowerCase()}</strong> this account?
                  {modal.action === "ACTIVE" && " A notification email will be sent to the customer."}
                </p>
              )}
              {err && <div style={{ fontSize: 12, color: "#dc2626", marginBottom: 12 }}>{err}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setModal(null)} style={{ padding: "7px 16px", fontSize: 13, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontFamily: "inherit", color: CLR.text }}>
                  Cancel
                </button>
                <button onClick={execute} disabled={saving} style={btnStyle(modal.variant)}>
                  {saving ? "Processing…" : modal.label}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Tag selector ──────────────────────────────────────────────────────────────
function CustomerTagSelector({ allTags, selectedKeys, setSelectedKeys, onTagCreated }: {
  allTags: TagRow[]; selectedKeys: string[];
  setSelectedKeys: (v: string[]) => void; onTagCreated: (t: TagRow) => void;
}) {
  const [newName,   setNewName]   = useState("");
  const [creating,  setCreating]  = useState(false);
  const [createErr, setCreateErr] = useState("");

  const selected  = allTags.filter(t => selectedKeys.includes(t.key));
  const available = allTags.filter(t => !selectedKeys.includes(t.key));
  const add    = (k: string) => { if (!selectedKeys.includes(k)) setSelectedKeys([...selectedKeys, k]); };
  const remove = (k: string) => setSelectedKeys(selectedKeys.filter(x => x !== k));

  async function createTag() {
    const name = newName.trim(); if (!name) return;
    setCreateErr(""); setCreating(true);
    try {
      const key = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const res = await fetch("/api/admin/catalog/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, name }) });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) { setCreateErr(data?.error ?? "Failed to create tag"); return; }
      onTagCreated(data.data); add(data.data.key); setNewName("");
    } catch { setCreateErr("Network error"); } finally { setCreating(false); }
  }

  return (
    <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 4 }}>Customer Tags</div>
      <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 10 }}>
        Tags filter customers and control pricing rules. e.g.{" "}
        <span style={{ fontFamily: "monospace", fontSize: 10 }}>vip</span>,{" "}
        <span style={{ fontFamily: "monospace", fontSize: 10 }}>restricted</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, minHeight: 28, marginBottom: 8 }}>
        {selected.length === 0
          ? <span style={{ fontSize: 11, color: "#93c5fd" }}>No tags assigned</span>
          : selected.map(t => (
            <span key={t.key} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, padding: "2px 8px", background: "#fff", border: "1px solid #93c5fd", color: "#1d4ed8" }}>
              {t.name}
              <button type="button" onClick={() => remove(t.key)} style={{ border: "none", background: "none", cursor: "pointer", color: "#3b82f6", fontSize: 13, lineHeight: 1, padding: 0 }}>×</button>
            </span>
          ))
        }
      </div>
      {available.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginBottom: 10 }}>
          {available.map(t => (
            <button key={t.key} type="button" onClick={() => add(t.key)} style={{ fontSize: 11, padding: "2px 8px", border: "1px dashed #93c5fd", background: "#fff", color: "#3b82f6", cursor: "pointer", fontFamily: "inherit" }}>
              + {t.name}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, borderTop: "1px solid #bfdbfe", paddingTop: 10 }}>
        <input className="cy-input" placeholder="New tag name e.g. VIP" value={newName} style={{ flex: 1, fontSize: 12 }}
          onChange={e => { setNewName(e.target.value); setCreateErr(""); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void createTag(); } }} />
        <button type="button" onClick={() => void createTag()} disabled={creating || !newName.trim()} style={{ padding: "6px 14px", fontSize: 11, fontWeight: 600, background: "#1d4ed8", color: "#fff", border: "none", cursor: creating || !newName.trim() ? "default" : "pointer", fontFamily: "inherit", opacity: creating || !newName.trim() ? 0.45 : 1 }}>
          {creating ? "…" : "Create & Add"}
        </button>
      </div>
      {createErr && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{createErr}</div>}
    </div>
  );
}


// ── Status History ────────────────────────────────────────────────────────────
const STATUS_ACTION_LABELS: Record<string, { label: string; bg: string; color: string; border: string }> = {
  ACTIVE:        { label: "Approved",       bg: "#e8f5f0", color: "#166534", border: "#a7d9d1" },
  PENDING:       { label: "Set to Pending", bg: "#fff8e6", color: "#92400e", border: "#fcd34d" },
  INFO_REQUIRED: { label: "Requested Info", bg: "#fdf0ef", color: "#991b1b", border: "#fca5a5" },
  SUSPENDED:     { label: "Suspended",      bg: "#f3f4f6", color: "#374151", border: "#d1d5db" },
  REJECTED:      { label: "Rejected",       bg: "#fdf0ef", color: "#7f1d1d", border: "#fca5a5" },
};

type LogEntry = {
  id: string; action: string; from: string | null; to: string | null;
  reason: string | null; message: string | null; actor: string; createdAt: string;
};

function StatusHistory({ customerId }: { customerId: string }) {
  const [logs,    setLogs]    = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/users/${customerId}/status-log`)
      .then(r => r.json())
      .then(d => { if (d.ok) setLogs(d.data ?? []); })
      .finally(() => setLoading(false));
  }, [customerId]);

  if (loading) return (
    <Card>
      <CardHeader title="Status History" />
      <div style={{ padding: "24px 18px", textAlign: "center", color: CLR.faint, fontSize: 13 }}>Loading…</div>
    </Card>
  );

  if (logs.length === 0) return (
    <Card>
      <CardHeader title="Status History" />
      <div style={{ padding: "24px 18px", textAlign: "center", color: CLR.faint, fontSize: 13 }}>No status changes recorded yet.</div>
    </Card>
  );

  return (
    <Card>
      <CardHeader title="Status History" />
      <div style={{ padding: "0 0 4px" }}>
        {logs.map((log, idx) => {
          const cfg = STATUS_ACTION_LABELS[log.action] ?? { label: log.action, bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" };
          const isLast = idx === logs.length - 1;
          return (
            <div key={log.id} style={{
              display: "flex", gap: 14, padding: "12px 18px",
              borderBottom: isLast ? "none" : "1px solid #f3f4f6",
              alignItems: "flex-start",
            }}>
              <div style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", flexShrink: 0, paddingTop: 3 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: cfg.color }} />
                {!isLast && <div style={{ width: 1, background: "#e5e7eb", marginTop: 4, minHeight: 20, flex: 1 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px",
                    background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                    letterSpacing: "0.04em", textTransform: "uppercase" as const,
                  }}>{cfg.label}</span>
                  {log.from && log.to && (
                    <span style={{ fontSize: 11, color: CLR.faint }}>
                      {log.from.replace("_", " ")} → {log.to.replace("_", " ")}
                    </span>
                  )}
                </div>
                {(log.reason || log.message) && (
                  <div style={{
                    fontSize: 12.5, color: "#374151", padding: "6px 10px",
                    background: "#f9fafb", border: "1px solid #f3f4f6",
                    marginBottom: 4, lineHeight: 1.6,
                  }}>
                    <strong style={{ color: CLR.muted, fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                      {log.message ? "Message: " : "Reason: "}
                    </strong>
                    {log.message ?? log.reason}
                  </div>
                )}
                <div style={{ fontSize: 11.5, color: CLR.faint }}>
                  By <strong style={{ color: CLR.muted }}>{log.actor}</strong>
                  {" · "}
                  {new Date(log.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  {" "}
                  {new Date(log.createdAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function CustomerForm({ mode, customerId }: { mode: "create" | "edit"; customerId?: string }) {
  const router = useRouter();

  const [markets, setMarkets] = useState<MarketOpt[]>([]);
  const [groups,  setGroups]  = useState<GroupOpt[]>([]);
  const [allTags, setAllTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [customerStatus, setCustomerStatus] = useState<string>("PENDING");

  const [email,        setEmail]        = useState("");
  const [fullName,     setFullName]     = useState("");
  const [mobile,       setMobile]       = useState("");
  const [marketId,     setMarketId]     = useState("");
  const [groupId,      setGroupId]      = useState("");
  const [accountType,  setAccountType]  = useState<AccountType>("BUSINESS");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [companyName,      setCompanyName]      = useState("");
  const [vatTaxId,         setVatTaxId]         = useState("");
  const [crNumber,         setCrNumber]         = useState("");
  const [shortAddressCode, setShortAddressCode] = useState("");

  const [country,         setCountry]         = useState("SA");
  const [province,        setProvince]        = useState("");
  const [provinceText,    setProvinceText]    = useState("");
  const [city,            setCity]            = useState("");
  const [district,        setDistrict]        = useState("");
  const [addr1,           setAddr1]           = useState("");
  const [addr2,           setAddr2]           = useState("");
  const [buildingNumber,  setBuildingNumber]  = useState("");
  const [secondaryNumber, setSecondaryNumber] = useState("");
  const [postalCode,      setPostalCode]      = useState("");

  const [publicNote,  setPublicNote]  = useState("");
  const [privateNote, setPrivateNote] = useState("");

  const isSaudi    = markets.find(m => m.id === marketId)?.key?.toLowerCase() === "saudi";
  const isBusiness = accountType === "BUSINESS";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mr, gr, tr] = await Promise.all([
        fetch("/api/admin/markets").then(r => r.json()).catch(() => null),
        fetch("/api/admin/catalog/customer-groups").then(r => r.json()).catch(() => null),
        fetch("/api/admin/catalog/tags").then(r => r.json()).catch(() => null),
      ]);
      const mData: MarketOpt[] = mr?.ok ? mr.data : [];
      const gData: GroupOpt[]  = gr?.ok ? gr.data : [];
      const tData: TagRow[]    = tr?.ok ? tr.data : [];
      setMarkets(mData); setGroups(gData); setAllTags(tData);

      if (mode === "edit" && customerId) {
        const cr = await fetch(`/api/admin/users/${customerId}`).then(r => r.json()).catch(() => null);
        if (cr?.ok && cr.data) {
          const c = cr.data;
          setEmail(c.email ?? "");
          setFullName(c.fullName ?? "");
          setMobile(c.mobile ?? "");
          setMarketId(c.marketId ?? mData[0]?.id ?? "");
          setGroupId(c.customerGroupId ?? gData.find((g: GroupOpt) => g.key === "standard")?.id ?? gData[0]?.id ?? "");
          setAccountType(c.accountType ?? "BUSINESS");
          setSelectedTags((c.tags ?? []).map((t: TagRow) => t.key));
          setCompanyName(c.companyName ?? "");
          setVatTaxId(c.vatTaxId ?? "");
          setCrNumber(c.commercialRegistrationNumber ?? "");
          setShortAddressCode(c.shortAddressCode ?? "");
          setCountry(c.country ?? "SA");
          setCity(c.city ?? "");
          setDistrict(c.district ?? "");
          setAddr1(c.addressLine1 ?? "");
          setAddr2(c.addressLine2 ?? "");
          setBuildingNumber(c.buildingNumber ?? "");
          setSecondaryNumber(c.secondaryNumber ?? "");
          setPostalCode(c.postalCode ?? "");
          setPublicNote(c.notePublic ?? "");
          setPrivateNote(c.notePrivate ?? "");
          setCustomerStatus(c.status ?? "PENDING");
          const mkt = mData.find(m => m.id === c.marketId);
          if (mkt?.key?.toLowerCase() === "saudi") setProvince(c.province ?? "");
          else setProvinceText(c.province ?? "");
        }
      } else {
        setMarketId(mData[0]?.id ?? "");
        setGroupId(gData.find(g => g.key === "standard")?.id ?? gData[0]?.id ?? "");
        setProvince(SAUDI_PROVINCES[0] ?? "");
      }
    } finally { setLoading(false); }
  }, [mode, customerId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!isSaudi) {
      setBuildingNumber(""); setSecondaryNumber("");
      setShortAddressCode(""); setCrNumber(""); setDistrict("");
    }
  }, [isSaudi]);

  async function save() {
    if (!email.trim()) { setError("Email is required"); return; }
    if (!marketId)     { setError("Market is required"); return; }
    setSaving(true); setError(null); setSuccess(null);

    const tagIds = allTags.filter(t => selectedTags.includes(t.key)).map(t => t.id);

    const body = {
      email: email.trim().toLowerCase(),
      fullName:       fullName.trim() || null,
      mobile:         mobile.trim()   || null,
      marketId,
      customerGroupId: groupId || null,
      accountType,
      tagIds,
      companyName:                  isBusiness ? (companyName.trim() || null) : null,
      vatTaxId:                     isBusiness ? (vatTaxId.trim()    || null) : null,
      commercialRegistrationNumber: (isBusiness && isSaudi) ? (crNumber.trim()         || null) : null,
      shortAddressCode:             (isBusiness && isSaudi) ? (shortAddressCode.trim() || null) : null,
      country:  country.trim().toUpperCase() || null,
      province: isSaudi ? (province || null) : (provinceText.trim() || null),
      city:     city.trim()  || null,
      addressLine1:    addr1.trim()           || null,
      addressLine2:    addr2.trim()           || null,
      buildingNumber:  isSaudi ? (buildingNumber.trim()  || null) : null,
      secondaryNumber: isSaudi ? (secondaryNumber.trim() || null) : null,
      district:        isSaudi ? (district.trim()        || null) : null,
      postalCode:      postalCode.trim()      || null,
      notePublic:  publicNote.trim()  || null,
      notePrivate: privateNote.trim() || null,
    };

    try {
      if (mode === "create") {
        const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.ok) { setError(j?.error ?? "Failed to create customer"); return; }
        router.push("/admin/customers");
      } else {
        const res = await fetch(`/api/admin/users/${customerId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.ok) { setError(j?.error ?? "Failed to update customer"); return; }
        setSuccess("Customer updated successfully.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch { setError("Network error"); } finally { setSaving(false); }
  }

  const isCreate   = mode === "create";
  const title      = isCreate ? "Create Customer" : "Edit Customer";
  const breadcrumb = isCreate ? "ADMIN / CUSTOMERS / NEW" : "ADMIN / CUSTOMERS / EDIT";

  if (loading) return (
    <PageShell breadcrumb={breadcrumb} title={title}>
      <div style={{ padding: 48, textAlign: "center", color: CLR.faint, fontSize: 13 }}>Loading…</div>
    </PageShell>
  );

  return (
    <PageShell breadcrumb={breadcrumb} title={title}>
      <div style={{ maxWidth: 780, display: "flex", flexDirection: "column", gap: 16 }}>

        {error   && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {/* ── Status Action Panel — edit mode only ── */}
        {mode === "edit" && customerId && (
          <StatusPanel
            customerId={customerId}
            currentStatus={customerStatus}
            onStatusChanged={newStatus => {
              setCustomerStatus(newStatus);
              setSuccess(`Account status updated to ${newStatus.replace("_", " ")}.`);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        )}

        {/* ── 1. Account ── */}
        <Card>
          <CardHeader title="Account" />
          <div style={{ padding: "18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Email" required>
              <Input value={email} onChange={setEmail} placeholder="customer@company.com" type="email" />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Full Name"><Input value={fullName} onChange={setFullName} placeholder="Full name" /></Field>
              <Field label="Mobile"><Input value={mobile} onChange={setMobile} placeholder="+9665XXXXXXXX" /></Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Account Type">
                <div style={{ display: "flex", gap: 22, paddingTop: 8 }}>
                  {(["BUSINESS", "PERSONAL"] as AccountType[]).map(t => (
                    <label key={t} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer", color: CLR.text }}>
                      <input type="radio" name="accountType" value={t} checked={accountType === t} onChange={() => setAccountType(t)} style={{ accentColor: CLR.primary, width: 14, height: 14 }} />
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </label>
                  ))}
                </div>
              </Field>
              <Field label="Market" required>
                <Select value={marketId} onChange={setMarketId}>
                  {markets.map(m => <option key={m.id} value={m.id}>{m.name} ({m.key})</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Customer Group">
              <Select value={groupId} onChange={setGroupId}>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.key})</option>)}
              </Select>
            </Field>
            <Field label="Country" hint="ISO 2-letter code e.g. SA, US, GB">
              <Input value={country} onChange={v => setCountry(v.toUpperCase().slice(0, 2))} placeholder="SA" />
            </Field>
          </div>
        </Card>

        {/* ── 2. Tags ── */}
        <Card>
          <CardHeader title="Tags" />
          <div style={{ padding: "18px 18px" }}>
            <CustomerTagSelector allTags={allTags} selectedKeys={selectedTags} setSelectedKeys={setSelectedTags}
              onTagCreated={t => setAllTags(prev => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)))} />
          </div>
        </Card>

        {/* ── 3. Business Details ── */}
        {isBusiness && (
          <Card>
            <CardHeader title="Business Details" />
            <div style={{ padding: "18px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Company Name">
                <Input value={companyName} onChange={setCompanyName} placeholder="Company name" />
              </Field>
              <Field label="VAT / Tax ID">
                <Input value={vatTaxId} onChange={setVatTaxId} placeholder="Tax ID" />
              </Field>
              {isSaudi && (
                <Field label="CR / Unified ID / Reg Number">
                  <Input value={crNumber} onChange={setCrNumber} placeholder="CR number" />
                </Field>
              )}
              {isSaudi && (
                <Field label="Short Address Code" hint="Saudi National Address short code e.g. RNAD2323">
                  <Input value={shortAddressCode} onChange={setShortAddressCode} placeholder="e.g. RNAD2323" />
                </Field>
              )}
            </div>
          </Card>
        )}

        {/* ── 4. Location & Address ── */}
        <Card>
          <CardHeader title="Location & Address" />
          <div style={{ padding: "18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
            <Field label="Province / State">
              {isSaudi ? (
                <Select value={province} onChange={setProvince}>
                  {SAUDI_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </Select>
              ) : (
                <Input value={provinceText} onChange={setProvinceText} placeholder="State or province" />
              )}
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="City"><Input value={city} onChange={setCity} placeholder="City" /></Field>
              {isSaudi && (
                <Field label="District">
                  <Input value={district} onChange={setDistrict} placeholder="District / Neighbourhood" />
                </Field>
              )}
            </div>
            <Field label="Address Line 1">
              <Input value={addr1} onChange={setAddr1} placeholder="Street, building, etc." />
            </Field>
            <Field label="Street Name">
              <Input value={addr2} onChange={setAddr2} placeholder="Street name" />
            </Field>
            {isSaudi && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <Field label="Building Number" hint="Saudi National Address — building number">
                  <Input value={buildingNumber} onChange={setBuildingNumber} placeholder="e.g. 1234" />
                </Field>
                <Field label="Secondary Number" hint="Saudi National Address — secondary/unit number">
                  <Input value={secondaryNumber} onChange={setSecondaryNumber} placeholder="e.g. 5678" />
                </Field>
              </div>
            )}
            <Field label="Postal Code / Zip">
              <Input value={postalCode} onChange={setPostalCode} placeholder={isSaudi ? "e.g. 12345" : "e.g. 10001"} />
            </Field>
          </div>
        </Card>

        {/* ── 5. Notes ── */}
        <Card>
          <CardHeader title="Notes" />
          <div style={{ padding: "18px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 4 }}>Public Note</div>
              <div style={{ fontSize: 11, color: CLR.faint, marginBottom: 6 }}>Visible to customer in their portal.</div>
              <Textarea value={publicNote} onChange={setPublicNote} placeholder="Visible to customer…" rows={3} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 4 }}>Private Note</div>
              <div style={{ fontSize: 11, color: CLR.faint, marginBottom: 6 }}>Internal only — not visible to customer.</div>
              <Textarea value={privateNote} onChange={setPrivateNote} placeholder="Internal admin notes…" rows={3} />
            </div>
          </div>
        </Card>

        {mode === "edit" && customerId && (
          <StatusHistory customerId={customerId} />
        )}

        <SaveRow onCancel={() => router.push("/admin/customers")} onSave={save} saving={saving} saveLabel={isCreate ? "Create Customer" : "Save Changes"} />

      </div>
    </PageShell>
  );
}
