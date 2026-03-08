// FILE: app/admin/customers/[id]/edit/ui/EditCustomerForm.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type MarketOption = { id: string; name: string; key: string };
type GroupOption  = { id: string; name: string; key: string; isDefault: boolean };
type AccountType  = "BUSINESS" | "PERSONAL";
type TagRow       = { id: string; key: string; name: string };

const SAUDI_PROVINCES = [
  "Riyadh Province",
  "Makkah al-Mukarramah Province",
  "Al-Madinah Al-Munawwarah Province",
  "Eastern Province (Ash Sharqiyah)",
  "Aseer Province", "Tabuk Province", "Hail Province",
  "al-Qassim Province", "Jazan Province", "Najran Province",
  "Al-Bahah Province", "Al-Jawf Province",
] as const;

type Customer = {
  id: string; email: string; marketId: string; customerGroupId: string | null;
  fullName: string | null; mobile: string | null; accountType: AccountType | null;
  country: string | null; province: string | null;
  companyName: string | null; vatTaxId: string | null; commercialRegistrationNumber: string | null;
  addressLine1: string | null; addressLine2: string | null; district: string | null; city: string | null;
};

type ApiOk  = { ok: true;  user: { id: string; email: string } };
type ApiErr = { ok: false; error: string };

// ── CustomerTagSelector ───────────────────────────────────────────────────────

function CustomerTagSelector({
  allTags, selectedKeys, setSelectedKeys, onTagCreated,
}: {
  allTags:       TagRow[];
  selectedKeys:  string[];
  setSelectedKeys: (v: string[]) => void;
  onTagCreated:  (tag: TagRow) => void;
}) {
  const [newName,   setNewName]   = useState("");
  const [creating,  setCreating]  = useState(false);
  const [createErr, setCreateErr] = useState("");

  const selected  = allTags.filter((t) => selectedKeys.includes(t.key));
  const available = allTags.filter((t) => !selectedKeys.includes(t.key));

  const add    = (key: string) => { if (!selectedKeys.includes(key)) setSelectedKeys([...selectedKeys, key]); };
  const remove = (key: string) => setSelectedKeys(selectedKeys.filter((k) => k !== key));

  async function createTag() {
    const name = newName.trim();
    if (!name) return;
    setCreateErr("");
    setCreating(true);
    try {
      const key = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      const res  = await fetch("/api/admin/catalog/tags", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, name }),
      });
      const data = await res.json().catch(() => null) as { ok: boolean; data?: TagRow; error?: string } | null;
      if (!res.ok || !data?.ok) { setCreateErr(data?.error ?? "Failed to create tag"); return; }
      onTagCreated(data.data!);
      add(data.data!.key);
      setNewName("");
    } catch { setCreateErr("Network error"); }
    finally  { setCreating(false); }
  }

  return (
    <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/30 p-4">
      <div className="text-xs font-semibold text-blue-700">Customer Tags</div>
      <p className="text-[11px] text-gray-400">
        Tags let you enforce conditions or filter customers in the dashboard. e.g. <code>beta</code>, <code>vip</code>, <code>restricted</code>.
      </p>

      {/* Selected pills */}
      <div className="flex min-h-[28px] flex-wrap items-center gap-2">
        {selected.length === 0
          ? <span className="text-[11px] text-gray-400">No tags assigned</span>
          : selected.map((t) => (
            <span key={t.key}
              className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 shadow-sm">
              {t.name}
              <button type="button" onClick={() => remove(t.key)} className="ml-0.5 opacity-50 hover:opacity-100">✕</button>
            </span>
          ))
        }
      </div>

      {/* Available tags to add */}
      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.map((t) => (
            <button key={t.key} type="button" onClick={() => add(t.key)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-blue-300 px-2 py-0.5 text-[11px] text-blue-500 transition-colors hover:border-blue-500 hover:text-blue-700">
              + {t.name}
            </button>
          ))}
        </div>
      )}

      {/* Create new tag */}
      <div className="flex items-center gap-2 border-t border-blue-100 pt-3">
        <input
          className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200"
          placeholder="New tag name e.g. VIP"
          value={newName}
          onChange={(e) => { setNewName(e.target.value); setCreateErr(""); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void createTag(); } }}
        />
        <button type="button" onClick={() => void createTag()} disabled={creating || !newName.trim()}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-40">
          {creating ? "…" : "Create & Add"}
        </button>
      </div>
      {createErr && <p className="text-[11px] text-red-500">{createErr}</p>}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

const inputCls = "w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300";

// ── EditCustomerForm ──────────────────────────────────────────────────────────

export default function EditCustomerForm({
  customer, markets, groups,
}: {
  customer: Customer; markets: MarketOption[]; groups: GroupOption[];
}) {
  const defaultGroupId = useMemo(() => {
    const g = groups.find((x) => x.key === "standard") ?? groups.find((x) => x.isDefault) ?? groups[0];
    return g?.id ?? "";
  }, [groups]);

  // Core
  const [email,           setEmail]           = useState(customer.email);
  const [marketId,        setMarketId]        = useState(customer.marketId);
  const [customerGroupId, setCustomerGroupId] = useState(customer.customerGroupId ?? defaultGroupId);

  // Personal info
  const [fullName,    setFullName]    = useState(customer.fullName    ?? "");
  const [mobile,      setMobile]      = useState(customer.mobile      ?? "");
  const [accountType, setAccountType] = useState<AccountType>(customer.accountType ?? "BUSINESS");

  // Location
  const [country,           setCountry]           = useState(customer.country  ?? "SA");
  const [province,          setProvince]          = useState(customer.country === "SA" ? (customer.province ?? "") : "");
  const [provinceStateText, setProvinceStateText] = useState(customer.country !== "SA" ? (customer.province ?? "") : "");

  // Business
  const [companyName,                  setCompanyName]                  = useState(customer.companyName                  ?? "");
  const [vatTaxId,                     setVatTaxId]                     = useState(customer.vatTaxId                     ?? "");
  const [commercialRegistrationNumber, setCommercialRegistrationNumber] = useState(customer.commercialRegistrationNumber ?? "");

  // Address
  const [addressLine1, setAddressLine1] = useState(customer.addressLine1 ?? "");
  const [addressLine2, setAddressLine2] = useState(customer.addressLine2 ?? "");
  const [district,     setDistrict]     = useState(customer.district     ?? "");
  const [city,         setCity]         = useState(customer.city         ?? "");

  // Tags
  const [allTags,      setAllTags]      = useState<TagRow[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [tagsLoading,  setTagsLoading]  = useState(true);

  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const isSaudi    = country === "SA";
  const isBusiness = accountType === "BUSINESS";

  // Load all tags + current user tags on mount
  useEffect(() => {
    async function load() {
      const [allRes, userRes] = await Promise.all([
        fetch("/api/admin/catalog/tags",                          { cache: "no-store" }),
        fetch(`/api/admin/users/${customer.id}/tags`,             { cache: "no-store" }),
      ]);
      const allJ  = await allRes.json().catch(() => null)  as { ok: boolean; data?: TagRow[] } | null;
      const userJ = await userRes.json().catch(() => null) as { ok: boolean; data?: TagRow[] } | null;
      if (allJ?.ok)  setAllTags(allJ.data  ?? []);
      if (userJ?.ok) setSelectedKeys((userJ.data ?? []).map((t) => t.key));
      setTagsLoading(false);
    }
    void load();
  }, [customer.id]);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);

    const groupToSend = customerGroupId || defaultGroupId;
    if (!groupToSend) return setMsg({ type: "err", text: "Customer group is required." });

    const provinceToSend = isSaudi ? province : (provinceStateText.trim() || null);

    setLoading(true);
    try {
      // 1. Save user fields
      const res = await fetch(`/api/admin/users/${encodeURIComponent(customer.id)}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(), marketId, customerGroupId: groupToSend,
          fullName: fullName.trim() || null, mobile: mobile.trim() || null, accountType,
          country: country || null, province: provinceToSend,
          companyName:                  isBusiness ? (companyName.trim()                  || null) : null,
          vatTaxId:                     isBusiness ? (vatTaxId.trim()                     || null) : null,
          commercialRegistrationNumber: isBusiness ? (commercialRegistrationNumber.trim() || null) : null,
          addressLine1: addressLine1.trim() || null, addressLine2: addressLine2.trim() || null,
          district: district.trim() || null, city: city.trim() || null,
        }),
      });
      const data = await res.json().catch(() => null) as ApiOk | ApiErr | null;
      if (!data || !res.ok || data.ok === false) {
        return setMsg({ type: "err", text: (data as ApiErr)?.error ?? "Failed to update." });
      }

      // 2. Save tags
      const tagsRes = await fetch(`/api/admin/users/${encodeURIComponent(customer.id)}/tags`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ tagKeys: selectedKeys }),
      });
      const tagsData = await tagsRes.json().catch(() => null) as { ok: boolean; error?: string } | null;
      if (!tagsData?.ok) return setMsg({ type: "err", text: tagsData?.error ?? "Failed to save tags." });

      setMsg({ type: "ok", text: "Saved successfully." });
    } catch { setMsg({ type: "err", text: "Network error." }); }
    finally  { setLoading(false); }
  }

  return (
    <form onSubmit={onSave} className="space-y-6">

      {msg && (
        <div className={`rounded-md border px-4 py-3 text-sm ${msg.type === "ok" ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

      {/* ── Core ── */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700">Account</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Email *">
            <input className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
          </Field>
          <Field label="Full Name">
            <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
          </Field>
          <Field label="Mobile">
            <input className={inputCls} value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+9665XXXXXXXX" inputMode="tel" />
          </Field>
          <Field label="Account Type">
            <div className="flex gap-4 pt-1.5 text-sm">
              {(["BUSINESS", "PERSONAL"] as AccountType[]).map((t) => (
                <label key={t} className="inline-flex cursor-pointer items-center gap-2">
                  <input type="radio" name="accountType" value={t} checked={accountType === t} onChange={() => setAccountType(t)} />
                  {t.charAt(0) + t.slice(1).toLowerCase()}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Market *">
            <select className={inputCls} value={marketId} onChange={(e) => setMarketId(e.target.value)}>
              {markets.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.key})</option>)}
            </select>
          </Field>
          <Field label="Customer Group *">
            <select className={inputCls} value={customerGroupId} onChange={(e) => setCustomerGroupId(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name} ({g.key}){g.key === "standard" ? " — Default" : ""}</option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* ── Tags ── */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Tags</h2>
        {tagsLoading
          ? <p className="text-[11px] text-gray-400">Loading tags…</p>
          : (
            <CustomerTagSelector
              allTags={allTags}
              selectedKeys={selectedKeys}
              setSelectedKeys={setSelectedKeys}
              onTagCreated={(tag) => setAllTags((prev) => [...prev, tag].sort((a, b) => a.name.localeCompare(b.name)))}
            />
          )
        }
      </section>

      {/* ── Business details ── */}
      {isBusiness && (
        <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-700">Business Details</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Company Name">
              <input className={inputCls} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company" />
            </Field>
            <Field label="VAT / Tax ID">
              <input className={inputCls} value={vatTaxId} onChange={(e) => setVatTaxId(e.target.value)} placeholder="Tax ID" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Commercial Registration Number">
                <input className={inputCls} value={commercialRegistrationNumber} onChange={(e) => setCommercialRegistrationNumber(e.target.value)} placeholder="CR number" />
              </Field>
            </div>
          </div>
        </section>
      )}

      {/* ── Location ── */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700">Location</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Country">
            <input className={inputCls} value={country} onChange={(e) => {
              const next = e.target.value.toUpperCase();
              setCountry(next);
              if (next !== "SA") setProvince("");
            }} placeholder="ISO code e.g. SA, US, GB" maxLength={2} />
          </Field>
          {isSaudi ? (
            <Field label="Province (Saudi) *">
              <select className={inputCls} value={province} onChange={(e) => setProvince(e.target.value)}>
                <option value="">— Select province —</option>
                {SAUDI_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Province / State">
              <input className={inputCls} value={provinceStateText} onChange={(e) => setProvinceStateText(e.target.value)} placeholder="Province or state" />
            </Field>
          )}
          <Field label="City">
            <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
          </Field>
          <Field label="District / County">
            <input className={inputCls} value={district} onChange={(e) => setDistrict(e.target.value)} placeholder="District" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Address Line 1">
              <input className={inputCls} value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="Street, building, etc." />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Address Line 2">
              <input className={inputCls} value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} placeholder="Apartment, suite, etc." />
            </Field>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button type="submit" disabled={loading}
          className="rounded-xl bg-gray-900 px-6 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-40">
          {loading ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}