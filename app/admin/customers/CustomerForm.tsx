// app/admin/customers/CustomerForm.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageShell, Card, CardHeader, Field, Input, Select, Textarea,
  Alert, SaveRow, CLR,
} from "@/components/ui/admin-ui";

// ─── Types ─────────────────────────────────────────────────────────────────────

type AccountType = "BUSINESS" | "PERSONAL";
type MarketOpt   = { id: string; key: string; name: string };
type GroupOpt    = { id: string; key: string; name: string };
type TagRow      = { id: string; key: string; name: string };

const SAUDI_PROVINCES = [
  "Riyadh Province",
  "Makkah al-Mukarramah Province",
  "Al-Madinah Al-Munawwarah Province",
  "Eastern Province (Ash Sharqiyah)",
  "Aseer Province",
  "Tabuk Province",
  "Hail Province",
  "Al-Qassim Province",
  "Jazan Province",
  "Najran Province",
  "Al-Bahah Province",
  "Al-Jawf Province",
  "Northern Borders Province",
];

// ─── CustomerTagSelector ───────────────────────────────────────────────────────

function CustomerTagSelector({ allTags, selectedKeys, setSelectedKeys, onTagCreated }: {
  allTags:         TagRow[];
  selectedKeys:    string[];
  setSelectedKeys: (v: string[]) => void;
  onTagCreated:    (t: TagRow) => void;
}) {
  const [newName,   setNewName]   = useState("");
  const [creating,  setCreating]  = useState(false);
  const [createErr, setCreateErr] = useState("");

  const selected  = allTags.filter(t => selectedKeys.includes(t.key));
  const available = allTags.filter(t => !selectedKeys.includes(t.key));
  const add    = (k: string) => { if (!selectedKeys.includes(k)) setSelectedKeys([...selectedKeys, k]); };
  const remove = (k: string) => setSelectedKeys(selectedKeys.filter(x => x !== k));

  async function createTag() {
    const name = newName.trim();
    if (!name) return;
    setCreateErr(""); setCreating(true);
    try {
      const key = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const res  = await fetch("/api/admin/catalog/tags", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, name }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) { setCreateErr(data?.error ?? "Failed to create tag"); return; }
      onTagCreated(data.data);
      add(data.data.key);
      setNewName("");
    } catch { setCreateErr("Network error"); }
    finally  { setCreating(false); }
  }

  return (
    <div style={{ border: "1px solid #bfdbfe", background: "#eff6ff", padding: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#1e40af", textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 4 }}>
        Customer Tags
      </div>
      <div style={{ fontSize: 11, color: CLR.muted, marginBottom: 10 }}>
        Tags filter customers and control pricing rules. e.g.{" "}
        <span style={{ fontFamily: "monospace", fontSize: 10 }}>vip</span>,{" "}
        <span style={{ fontFamily: "monospace", fontSize: 10 }}>restricted</span>
      </div>

      {/* Selected pills */}
      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 5, minHeight: 28, marginBottom: 8 }}>
        {selected.length === 0
          ? <span style={{ fontSize: 11, color: "#93c5fd" }}>No tags assigned</span>
          : selected.map(t => (
              <span key={t.key} style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 11, fontWeight: 600, padding: "2px 8px",
                background: "#fff", border: "1px solid #93c5fd", color: "#1d4ed8",
              }}>
                {t.name}
                <button type="button" onClick={() => remove(t.key)}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "#3b82f6", fontSize: 13, lineHeight: 1, padding: 0 }}>
                  ×
                </button>
              </span>
            ))
        }
      </div>

      {/* Available to add */}
      {available.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginBottom: 10 }}>
          {available.map(t => (
            <button key={t.key} type="button" onClick={() => add(t.key)} style={{
              fontSize: 11, padding: "2px 8px",
              border: "1px dashed #93c5fd", background: "#fff", color: "#3b82f6",
              cursor: "pointer", fontFamily: "inherit",
            }}>
              + {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Create new tag */}
      <div style={{ display: "flex", gap: 6, borderTop: "1px solid #bfdbfe", paddingTop: 10 }}>
        <input
          className="cy-input"
          placeholder="New tag name e.g. VIP"
          value={newName}
          style={{ flex: 1, fontSize: 12 }}
          onChange={e => { setNewName(e.target.value); setCreateErr(""); }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void createTag(); } }}
        />
        <button type="button" onClick={() => void createTag()} disabled={creating || !newName.trim()} style={{
          padding: "6px 14px", fontSize: 11, fontWeight: 600,
          background: "#1d4ed8", color: "#fff", border: "none",
          cursor: creating || !newName.trim() ? "default" : "pointer",
          fontFamily: "inherit", opacity: creating || !newName.trim() ? 0.45 : 1,
        }}>
          {creating ? "…" : "Create & Add"}
        </button>
      </div>
      {createErr && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>{createErr}</div>}
    </div>
  );
}

// ─── Main Form ─────────────────────────────────────────────────────────────────

export default function CustomerForm({ mode, customerId }: {
  mode: "create" | "edit";
  customerId?: string;
}) {
  const router = useRouter();

  const [markets, setMarkets] = useState<MarketOpt[]>([]);
  const [groups,  setGroups]  = useState<GroupOpt[]>([]);
  const [allTags, setAllTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Core
  const [email,        setEmail]        = useState("");
  const [fullName,     setFullName]     = useState("");
  const [mobile,       setMobile]       = useState("");
  const [marketId,     setMarketId]     = useState("");
  const [groupId,      setGroupId]      = useState("");
  const [accountType,  setAccountType]  = useState<AccountType>("BUSINESS");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Business
  const [companyName,  setCompanyName]  = useState("");
  const [vatTaxId,     setVatTaxId]     = useState("");
  const [crNumber,     setCrNumber]     = useState("");

  // Location
  const [country,      setCountry]      = useState("SA");
  const [province,     setProvince]     = useState("");
  const [provinceText, setProvinceText] = useState("");
  const [city,         setCity]         = useState("");
  const [district,     setDistrict]     = useState("");
  const [addr1,        setAddr1]        = useState("");
  const [addr2,        setAddr2]        = useState("");

  // Notes
  const [publicNote,  setPublicNote]  = useState("");
  const [privateNote, setPrivateNote] = useState("");

  const isSaudi    = country.toUpperCase() === "SA";
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

      setMarkets(mData);
      setGroups(gData);
      setAllTags(tData);

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
          setCountry(c.country ?? "SA");
          setCity(c.city ?? "");
          setDistrict(c.district ?? "");
          setAddr1(c.addressLine1 ?? "");
          setAddr2(c.addressLine2 ?? "");
          setPublicNote(c.notePublic ?? "");
          setPrivateNote(c.notePrivate ?? "");
          if (c.country === "SA") setProvince(c.province ?? "");
          else setProvinceText(c.province ?? "");
        }
      } else {
        setMarketId(mData[0]?.id ?? "");
        const defGroup = gData.find(g => g.key === "standard") ?? gData[0];
        setGroupId(defGroup?.id ?? "");
        setProvince(SAUDI_PROVINCES[0] ?? "");
      }
    } finally { setLoading(false); }
  }, [mode, customerId]);

  useEffect(() => { void load(); }, [load]);

  async function save() {
    if (!email.trim()) { setError("Email is required"); return; }
    if (!marketId)     { setError("Market is required"); return; }
    setSaving(true); setError(null); setSuccess(null);

    const tagIds = allTags.filter(t => selectedTags.includes(t.key)).map(t => t.id);

    const body = {
      email:          email.trim().toLowerCase(),
      fullName:       fullName.trim()  || null,
      mobile:         mobile.trim()    || null,
      marketId,
      customerGroupId: groupId || null,
      accountType,
      tagIds,
      companyName:                  isBusiness ? (companyName.trim() || null) : null,
      vatTaxId:                     isBusiness ? (vatTaxId.trim()    || null) : null,
      commercialRegistrationNumber: isBusiness ? (crNumber.trim()    || null) : null,
      country:      country.trim().toUpperCase() || null,
      province:     isSaudi ? (province || null) : (provinceText.trim() || null),
      city:         city.trim()     || null,
      district:     district.trim() || null,
      addressLine1: addr1.trim()    || null,
      addressLine2: addr2.trim()    || null,
      notePublic:   publicNote.trim()  || null,
      notePrivate:  privateNote.trim() || null,
    };

    try {
      if (mode === "create") {
        const res = await fetch("/api/admin/users", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.ok) { setError(j?.error ?? "Failed to create customer"); return; }
        router.push("/admin/customers");
      } else {
        const res = await fetch(`/api/admin/users/${customerId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.ok) { setError(j?.error ?? "Failed to update customer"); return; }
        setSuccess("Customer updated successfully.");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch { setError("Network error"); }
    finally  { setSaving(false); }
  }

  const isCreate   = mode === "create";
  const title      = isCreate ? "Create Customer" : "Edit Customer";
  const breadcrumb = isCreate ? "ADMIN / CUSTOMERS / NEW" : "ADMIN / CUSTOMERS / EDIT";

  if (loading) {
    return (
      <PageShell breadcrumb={breadcrumb} title={title}>
        <div style={{ padding: 48, textAlign: "center", color: CLR.faint, fontSize: 13 }}>Loading…</div>
      </PageShell>
    );
  }

  return (
    <PageShell breadcrumb={breadcrumb} title={title}>
      <div style={{ maxWidth: 780, display: "flex", flexDirection: "column", gap: 16 }}>

        {error   && <Alert type="error">{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        {/* ── Account ─────────────────────────────────────────── */}
        <Card>
          <CardHeader title="Account" />
          <div style={{ padding: "18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

            <Field label="Email" required>
              <Input value={email} onChange={setEmail} placeholder="customer@company.com" type="email" />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Full Name">
                <Input value={fullName} onChange={setFullName} placeholder="Full name" />
              </Field>
              <Field label="Mobile">
                <Input value={mobile} onChange={setMobile} placeholder="+9665XXXXXXXX" />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="Account Type">
                <div style={{ display: "flex", gap: 22, paddingTop: 8 }}>
                  {(["BUSINESS", "PERSONAL"] as AccountType[]).map(t => (
                    <label key={t} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, cursor: "pointer", color: CLR.text }}>
                      <input type="radio" name="accountType" value={t} checked={accountType === t}
                        onChange={() => setAccountType(t)}
                        style={{ accentColor: CLR.primary, width: 14, height: 14 }} />
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

          </div>
        </Card>

        {/* ── Tags ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader title="Tags" />
          <div style={{ padding: "18px 18px" }}>
            <CustomerTagSelector
              allTags={allTags}
              selectedKeys={selectedTags}
              setSelectedKeys={setSelectedTags}
              onTagCreated={t => setAllTags(prev => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)))}
            />
          </div>
        </Card>

        {/* ── Business Details ──────────────────────────────────── */}
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
              <div style={{ gridColumn: "1 / -1" }}>
                <Field label="Commercial Registration Number">
                  <Input value={crNumber} onChange={setCrNumber} placeholder="CR number" />
                </Field>
              </div>
            </div>
          </Card>
        )}

        {/* ── Location & Address ────────────────────────────────── */}
        <Card>
          <CardHeader title="Location & Address" />
          <div style={{ padding: "18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

            <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 14 }}>
              <Field label="Country" hint="ISO 2-letter">
                <Input value={country} onChange={v => {
                  const next = v.toUpperCase().slice(0, 2);
                  setCountry(next);
                  if (next === "SA") { setProvince(SAUDI_PROVINCES[0] ?? ""); setProvinceText(""); }
                  else setProvince("");
                }} placeholder="SA" />
              </Field>
              {isSaudi ? (
                <Field label="Province" required>
                  <Select value={province} onChange={setProvince}>
                    {SAUDI_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </Select>
                </Field>
              ) : (
                <Field label="State / Province">
                  <Input value={provinceText} onChange={setProvinceText} placeholder="State or province" />
                </Field>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <Field label="City">
                <Input value={city} onChange={setCity} placeholder="City" />
              </Field>
              <Field label="District / County">
                <Input value={district} onChange={setDistrict} placeholder="District" />
              </Field>
            </div>

            <Field label="Address Line 1">
              <Input value={addr1} onChange={setAddr1} placeholder="Street, building, etc." />
            </Field>
            <Field label="Address Line 2">
              <Input value={addr2} onChange={setAddr2} placeholder="Apartment, suite, etc." />
            </Field>

          </div>
        </Card>

        {/* ── Notes ─────────────────────────────────────────────── */}
        <Card>
          <CardHeader title="Notes" />
          <div style={{ padding: "18px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 4 }}>
                Public Note
              </div>
              <div style={{ fontSize: 11, color: CLR.faint, marginBottom: 6 }}>Visible to customer in their portal.</div>
              <Textarea value={publicNote} onChange={setPublicNote} placeholder="Visible to customer…" rows={3} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: CLR.muted, textTransform: "uppercase" as const, letterSpacing: "0.06em", marginBottom: 4 }}>
                Private Note
              </div>
              <div style={{ fontSize: 11, color: CLR.faint, marginBottom: 6 }}>Internal only — not visible to customer.</div>
              <Textarea value={privateNote} onChange={setPrivateNote} placeholder="Internal admin notes…" rows={3} />
            </div>
          </div>
        </Card>

        {/* ── Save ──────────────────────────────────────────────── */}
        <SaveRow
          onCancel={() => router.push("/admin/customers")}
          onSave={save}
          saving={saving}
          saveLabel={isCreate ? "Create Customer" : "Save Changes"}
        />

      </div>
    </PageShell>
  );
}