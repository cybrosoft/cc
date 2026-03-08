// app/admin/catalog/locations/LocationsAdmin.tsx
"use client";

import { useCallback, useEffect, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type LocationStatus = "active" | "inactive" | "coming_soon";

type LocationRow = {
  id:          string;
  code:        string;
  name:        string;
  family:      string | null;
  description: string | null;
  countryCode: string | null;
  flag:        string | null;
  status:      LocationStatus;
  sortOrder:   number;
  isDefault:   boolean;
  includeTags: string[];
  excludeTags: string[];
};

type TagRow = { id: string; key: string; name: string };

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<LocationStatus, { label: string; color: string; border: string; dot: string }> = {
  active:      { label: "Active",      color: "bg-green-50 text-green-700",  border: "border-green-200",  dot: "bg-green-500"  },
  inactive:    { label: "Inactive",    color: "bg-gray-100 text-gray-400",   border: "border-gray-200",   dot: "bg-gray-300"   },
  coming_soon: { label: "Coming Soon", color: "bg-amber-50 text-amber-700",  border: "border-amber-200",  dot: "bg-amber-400"  },
};

// ── StatusBadge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: LocationStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${c.color} ${c.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ── TagSelector ───────────────────────────────────────────────────────────────

function TagSelector({
  mode, tagKeys, setTagKeys, allTags, otherTagKeys,
}: {
  mode:         "include" | "exclude";
  tagKeys:      string[];
  setTagKeys:   (v: string[]) => void;
  allTags:      TagRow[];
  otherTagKeys: string[];
}) {
  const isInclude = mode === "include";
  const selected  = allTags.filter(t => tagKeys.includes(t.key));
  const available = allTags.filter(t => !tagKeys.includes(t.key) && !otherTagKeys.includes(t.key));
  const add       = (key: string) => { if (!tagKeys.includes(key)) setTagKeys([...tagKeys, key]); };
  const remove    = (key: string) => setTagKeys(tagKeys.filter(k => k !== key));

  const pillCls = isInclude
    ? "border-green-200 bg-green-50 text-green-700"
    : "border-red-200 bg-red-50 text-red-600";
  const addCls = isInclude
    ? "border-green-200 text-green-600 hover:border-green-400"
    : "border-red-200 text-red-500 hover:border-red-400";
  const wrapCls = isInclude
    ? "border-green-100 bg-green-50/30"
    : "border-red-100 bg-red-50/20";

  return (
    <div className={`space-y-3 rounded-xl border p-4 ${wrapCls}`}>
      <div>
        <div className={`flex items-center gap-1.5 text-xs font-semibold ${isInclude ? "text-green-700" : "text-red-600"}`}>
          <span>{isInclude ? "✚" : "✕"}</span>
          {isInclude ? "Include Tags" : "Exclude Tags"}
        </div>
        <p className="mt-0.5 text-[11px] text-gray-400">
          {isInclude
            ? "Products matching ANY of these tags appear at this location."
            : "Products matching ANY of these tags are hidden, even if they match an include tag."}
        </p>
      </div>

      <div className="flex min-h-[28px] flex-wrap items-center gap-2">
        {selected.length === 0
          ? <span className="text-xs text-gray-400">None selected</span>
          : selected.map(t => (
            <span key={t.key} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${pillCls}`}>
              {t.name}
              <button type="button" onClick={() => remove(t.key)} className="ml-0.5 opacity-60 hover:opacity-100">✕</button>
            </span>
          ))
        }
      </div>

      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {available.map(t => (
            <button key={t.key} type="button" onClick={() => add(t.key)}
              className={`inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] transition-colors ${addCls}`}>
              + {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── TagsPanel ─────────────────────────────────────────────────────────────────

function TagsPanel({
  includeTags, setIncludeTags, excludeTags, setExcludeTags, allTags,
}: {
  includeTags:    string[];
  setIncludeTags: (v: string[]) => void;
  excludeTags:    string[];
  setExcludeTags: (v: string[]) => void;
  allTags:        TagRow[];
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <TagSelector mode="include" tagKeys={includeTags} setTagKeys={setIncludeTags} allTags={allTags} otherTagKeys={excludeTags} />
        <TagSelector mode="exclude" tagKeys={excludeTags} setTagKeys={setExcludeTags} allTags={allTags} otherTagKeys={includeTags} />
      </div>

      {includeTags.length > 0 ? (
        <div className="rounded-lg border border-gray-100 bg-white px-3 py-2.5 text-[11px] text-gray-500">
          <span className="font-semibold text-gray-700">Logic: </span>
          Products tagged <span className="font-semibold text-green-700">{includeTags.join(" or ")}</span>
          {excludeTags.length > 0 && (
            <> — excluding those tagged <span className="font-semibold text-red-600">{excludeTags.join(" or ")}</span></>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          ⚠️ No include tags — this location will show no products to customers.
        </div>
      )}
    </div>
  );
}

// ── LocationFields ────────────────────────────────────────────────────────────

type FieldProps = {
  name: string;         setName: (v: string) => void;
  code: string;         setCode: (v: string) => void;
  family: string;       setFamily: (v: string) => void;
  description: string;  setDescription: (v: string) => void;
  countryCode: string;  setCountryCode: (v: string) => void;
  flag: string;         setFlag: (v: string) => void;
  status: LocationStatus; setStatus: (v: LocationStatus) => void;
  sortOrder: number;    setSortOrder: (v: number) => void;
  isDefault: boolean;   setIsDefault: (v: boolean) => void;
  includeTags: string[]; setIncludeTags: (v: string[]) => void;
  excludeTags: string[]; setExcludeTags: (v: string[]) => void;
  existingFamilies: string[];
  allTags: TagRow[];
};

function LocationFields(p: FieldProps) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">

        {/* Country / Region */}
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-medium text-gray-500">
            Country / Region <span className="font-normal text-gray-400">(leave blank for standalone)</span>
          </label>
          <div className="flex gap-2">
            <input value={p.family} onChange={e => p.setFamily(e.target.value)}
              placeholder="e.g. Saudi Arabia, Germany"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            {p.existingFamilies.length > 0 && (
              <select onChange={e => e.target.value && p.setFamily(e.target.value)} defaultValue=""
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 focus:outline-none">
                <option value="">Existing…</option>
                {p.existingFamilies.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            )}
          </div>
          {p.family && p.name && (
            <p className="text-[11px] text-blue-500">Displays as: <strong>{p.family} — {p.name}</strong></p>
          )}
        </div>

        {/* City name */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">City Name <span className="text-red-400">*</span></label>
          <input value={p.name} onChange={e => p.setName(e.target.value)}
            placeholder="e.g. Jeddah, Frankfurt"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
        </div>

        {/* Location code */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Location Code <span className="text-red-400">*</span></label>
          <input value={p.code} onChange={e => p.setCode(e.target.value.toUpperCase())}
            placeholder="e.g. JED, FRA"
            maxLength={6}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-gray-300" />
          <p className="text-[11px] text-gray-400">Unique short identifier (3–6 chars).</p>
        </div>

        {/* Flag + country code */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Flag & Country Code</label>
          <div className="flex gap-2">
            <input value={p.flag} onChange={e => p.setFlag(e.target.value)} placeholder="🇸🇦"
              className="w-16 rounded-lg border border-gray-200 px-3 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-gray-300" />
            <input value={p.countryCode} onChange={e => p.setCountryCode(e.target.value.toUpperCase())}
              placeholder="SA" maxLength={2}
              className="w-20 rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-gray-300" />
          </div>
          <p className="text-[11px] text-gray-400">Flag emoji + ISO 2-letter country code.</p>
        </div>

        {/* Status */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Status</label>
          <div className="flex gap-2">
            {(Object.entries(STATUS_CONFIG) as [LocationStatus, typeof STATUS_CONFIG[LocationStatus]][]).map(([key, cfg]) => (
              <button key={key} type="button" onClick={() => p.setStatus(key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-[11px] font-medium transition-colors ${
                  p.status === key ? `${cfg.color} ${cfg.border}` : "border-gray-200 bg-white text-gray-400 hover:bg-gray-50"
                }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </button>
            ))}
          </div>
        </div>

        {/* Sort order */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Sort Order <span className="font-normal text-gray-400">(lower = first)</span></label>
          <input type="number" min={0} value={p.sortOrder} onChange={e => p.setSortOrder(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
        </div>

        {/* Description */}
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-medium text-gray-500">Description <span className="font-normal text-gray-400">(optional)</span></label>
          <input value={p.description} onChange={e => p.setDescription(e.target.value)}
            placeholder="e.g. Hetzner DC, Frankfurt"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
        </div>

        {/* Default toggle */}
        {p.family && (
          <div className="md:col-span-2">
            <label onClick={() => p.setIsDefault(!p.isDefault)}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50">
              <div className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${p.isDefault ? "bg-gray-900" : "bg-gray-200"}`}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${p.isDefault ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-700">Set as default location</div>
                <div className="text-[11px] text-gray-400">Pre-selected when customer picks {p.family}.</div>
              </div>
              {p.isDefault && <span className="ml-auto text-[11px] font-semibold text-green-600">✓ Default</span>}
            </label>
          </div>
        )}
      </div>

      {/* Tags panel */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-500">Product Visibility via Tags</label>
        <TagsPanel
          includeTags={p.includeTags}   setIncludeTags={p.setIncludeTags}
          excludeTags={p.excludeTags}   setExcludeTags={p.setExcludeTags}
          allTags={p.allTags}
        />
      </div>
    </div>
  );
}

// ── EditPanel ─────────────────────────────────────────────────────────────────

function EditPanel({
  location, existingFamilies, allTags, onSave, onDelete,
}: {
  location: LocationRow; existingFamilies: string[]; allTags: TagRow[];
  onSave: (data: Partial<LocationRow>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name,        setName]        = useState(location.name);
  const [code,        setCode]        = useState(location.code);
  const [family,      setFamily]      = useState(location.family ?? "");
  const [description, setDescription] = useState(location.description ?? "");
  const [countryCode, setCountryCode] = useState(location.countryCode ?? "");
  const [flag,        setFlag]        = useState(location.flag ?? "");
  const [status,      setStatus]      = useState<LocationStatus>(location.status);
  const [sortOrder,   setSortOrder]   = useState(location.sortOrder);
  const [isDefault,   setIsDefault]   = useState(location.isDefault);
  const [includeTags, setIncludeTags] = useState<string[]>([...location.includeTags]);
  const [excludeTags, setExcludeTags] = useState<string[]>([...location.excludeTags]);
  const [saving,      setSaving]      = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState("");

  const isValid = name.trim() && code.trim();

  async function handleSave() {
    if (!isValid || saving) return;
    setSaving(true); setError("");
    try {
      await onSave({ name, code, family: family || null, description: description || null, countryCode: countryCode || null, flag: flag || null, status, sortOrder, isDefault, includeTags, excludeTags });
    } catch (e: any) { setError(e.message ?? "Save failed"); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try { await onDelete(); } catch (e: any) { setError(e.message ?? "Delete failed"); setDeleting(false); }
  }

  return (
    <div className="border-t border-blue-100 bg-blue-50/20 px-6 py-5 space-y-5">
      <LocationFields
        name={name} setName={setName} code={code} setCode={setCode}
        family={family} setFamily={setFamily} description={description} setDescription={setDescription}
        countryCode={countryCode} setCountryCode={setCountryCode} flag={flag} setFlag={setFlag}
        status={status} setStatus={setStatus} sortOrder={sortOrder} setSortOrder={setSortOrder}
        isDefault={isDefault} setIsDefault={setIsDefault}
        includeTags={includeTags} setIncludeTags={setIncludeTags}
        excludeTags={excludeTags} setExcludeTags={setExcludeTags}
        existingFamilies={existingFamilies} allTags={allTags}
      />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div>
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50">
              🗑️ Delete
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
              <span className="text-xs text-red-600">Sure?</span>
              <button onClick={handleDelete} disabled={deleting} className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
                {deleting ? "Deleting…" : "Yes"}
              </button>
              <button onClick={() => setConfirmDel(false)} className="text-xs text-gray-400 hover:underline">Cancel</button>
            </div>
          )}
        </div>
        <button onClick={handleSave} disabled={!isValid || saving}
          className="rounded-lg bg-gray-900 px-5 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-40">
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

// ── CreatePanel ───────────────────────────────────────────────────────────────

function CreatePanel({
  existingFamilies, allTags, onSave, onCancel,
}: {
  existingFamilies: string[]; allTags: TagRow[];
  onSave: (data: Omit<LocationRow, "id">) => Promise<void>;
  onCancel: () => void;
}) {
  const [name,        setName]        = useState("");
  const [code,        setCode]        = useState("");
  const [family,      setFamily]      = useState("");
  const [description, setDescription] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [flag,        setFlag]        = useState("");
  const [status,      setStatus]      = useState<LocationStatus>("active");
  const [sortOrder,   setSortOrder]   = useState(1);
  const [isDefault,   setIsDefault]   = useState(false);
  const [includeTags, setIncludeTags] = useState<string[]>([]);
  const [excludeTags, setExcludeTags] = useState<string[]>([]);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const isValid = name.trim() && code.trim();

  async function handleSave() {
    if (!isValid || saving) return;
    setSaving(true); setError("");
    try {
      await onSave({ name, code, family: family || null, description: description || null, countryCode: countryCode || null, flag: flag || null, status, sortOrder, isDefault, includeTags, excludeTags });
    } catch (e: any) { setError(e.message ?? "Create failed"); setSaving(false); }
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-700">New Location</h2>
      </div>
      <div className="space-y-5 p-5">
        <LocationFields
          name={name} setName={setName} code={code} setCode={setCode}
          family={family} setFamily={setFamily} description={description} setDescription={setDescription}
          countryCode={countryCode} setCountryCode={setCountryCode} flag={flag} setFlag={setFlag}
          status={status} setStatus={setStatus} sortOrder={sortOrder} setSortOrder={setSortOrder}
          isDefault={isDefault} setIsDefault={setIsDefault}
          includeTags={includeTags} setIncludeTags={setIncludeTags}
          excludeTags={excludeTags} setExcludeTags={setExcludeTags}
          existingFamilies={existingFamilies} allTags={allTags}
        />
        {name && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Customer View Preview</p>
            <div className="inline-flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <span className="text-2xl">{flag || "🌐"}</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">{name}</div>
                {family      && <div className="text-xs text-gray-400">{family}</div>}
                {description && <div className="text-xs text-gray-400">{description}</div>}
              </div>
              {code && <span className="ml-2 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-bold text-gray-500">{code}</span>}
            </div>
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="rounded-lg border border-gray-200 px-4 py-2 text-xs text-gray-500 hover:bg-gray-50">Cancel</button>
          <button onClick={handleSave} disabled={!isValid || saving}
            className="rounded-lg bg-gray-900 px-5 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-40">
            {saving ? "Creating…" : "Create Location"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function LocationsAdmin() {
  const [locations,    setLocations]    = useState<LocationRow[]>([]);
  const [allTags,      setAllTags]      = useState<TagRow[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [creating,     setCreating]     = useState(false);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [filterName,   setFilterName]   = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [locRes, tagRes] = await Promise.all([
      fetch("/api/admin/catalog/locations", { cache: "no-store" }),
      fetch("/api/admin/catalog/tags",      { cache: "no-store" }),
    ]);
    const [locJson, tagJson] = await Promise.all([locRes.json(), tagRes.json()]);
    if (locJson?.ok) setLocations(locJson.data);
    if (tagJson?.ok) setAllTags(tagJson.data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const existingFamilies = [...new Set(locations.map(l => l.family).filter(Boolean))] as string[];

  async function handleCreate(data: Omit<LocationRow, "id">) {
    const res  = await fetch("/api/admin/catalog/locations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!json?.ok) throw new Error(json?.error ?? "Create failed");
    setCreating(false); await load();
  }

  async function handleSave(id: string, data: Partial<LocationRow>) {
    const res  = await fetch("/api/admin/catalog/locations/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...data }) });
    const json = await res.json();
    if (!json?.ok) throw new Error(json?.error ?? "Update failed");
    setExpandedId(null); await load();
  }

  async function handleDelete(id: string) {
    const res  = await fetch("/api/admin/catalog/locations/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const json = await res.json();
    if (!json?.ok) throw new Error(json?.error ?? "Delete failed");
    setExpandedId(null); await load();
  }

  const filtered = locations.filter(l => {
    const full = l.family ? `${l.family} ${l.name}` : l.name;
    if (filterName   && !full.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterStatus && l.status !== filterStatus) return false;
    return true;
  });

  const familyGroups = existingFamilies.map(f => ({
    name: f, flag: locations.find(l => l.family === f)?.flag ?? "🌐",
    count: locations.filter(l => l.family === f).length,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-5">

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Datacenter Locations</h1>
            <p className="mt-0.5 text-sm text-gray-400">Products matched dynamically via include / exclude tags — no manual product lists.</p>
            {!loading && (
              <div className="mt-2 flex flex-wrap gap-2">
                {familyGroups.map(fg => (
                  <span key={fg.name} className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                    {fg.flag} {fg.name} · {fg.count}
                  </span>
                ))}
                {locations.filter(l => l.status === "coming_soon").length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                    {locations.filter(l => l.status === "coming_soon").length} coming soon
                  </span>
                )}
                {locations.filter(l => l.includeTags.length === 0 && l.status === "active").length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-500">
                    ⚠️ {locations.filter(l => l.includeTags.length === 0 && l.status === "active").length} with no tags
                  </span>
                )}
              </div>
            )}
          </div>
          {!creating && (
            <button onClick={() => { setCreating(true); setExpandedId(null); }}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
              + Add Location
            </button>
          )}
        </div>

        {creating && (
          <CreatePanel existingFamilies={existingFamilies} allTags={allTags} onSave={handleCreate} onCancel={() => setCreating(false)} />
        )}

        {!creating && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white px-4 py-3 shadow-sm">
            <input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="Search location…"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" style={{ width: 180 }} />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:outline-none">
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="coming_soon">Coming Soon</option>
            </select>
            {(filterName || filterStatus) && (
              <button onClick={() => { setFilterName(""); setFilterStatus(""); }} className="text-xs text-gray-400 underline hover:text-gray-600">Clear</button>
            )}
            <span className="ml-auto text-xs text-gray-400">{filtered.length} of {locations.length}</span>
          </div>
        )}

        {!creating && (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <div className="grid border-b bg-gray-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400"
              style={{ gridTemplateColumns: "40px 1fr 70px 150px 1fr 120px 36px 24px" }}>
              <div /><div>Location</div><div>Code</div><div>Country</div><div>Tags</div><div>Status</div><div title="Sort">⇅</div><div />
            </div>

            {loading  && <div className="px-5 py-10 text-center text-sm text-gray-400">Loading…</div>}
            {!loading && filtered.length === 0 && <div className="px-5 py-10 text-center text-sm text-gray-400">No locations found.</div>}

            {!loading && filtered.map(loc => {
              const isOpen = expandedId === loc.id;
              return (
                <div key={loc.id} className="border-b last:border-b-0">
                  <div
                    className={`grid cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50/80 ${isOpen ? "bg-blue-50/30" : ""} ${loc.status === "inactive" ? "opacity-50" : ""}`}
                    style={{ gridTemplateColumns: "40px 1fr 70px 150px 1fr 120px 36px 24px" }}
                    onClick={() => setExpandedId(isOpen ? null : loc.id)}
                  >
                    <div className="flex items-center justify-center text-2xl">{loc.flag || "🌐"}</div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900">{loc.name}</span>
                        {loc.isDefault && loc.family && <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-600">Default</span>}
                      </div>
                      {loc.description && <div className="text-[11px] text-gray-400">{loc.description}</div>}
                    </div>
                    <div>
                      <span className="rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-bold text-gray-600">{loc.code}</span>
                    </div>
                    <div>
                      {loc.family
                        ? <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">{loc.family}</span>
                        : <span className="text-[11px] text-gray-300">standalone</span>
                      }
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      {loc.includeTags.length === 0
                        ? <span className="text-[11px] text-red-400">⚠️ No tags</span>
                        : <>
                            {loc.includeTags.map(tk => <span key={tk} className="rounded-full border border-green-200 bg-green-50 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">+{tk}</span>)}
                            {loc.excludeTags.map(tk => <span key={tk} className="rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">−{tk}</span>)}
                          </>
                      }
                    </div>
                    <div><StatusBadge status={loc.status} /></div>
                    <div className="text-center font-mono text-xs text-gray-400">{loc.sortOrder}</div>
                    <div className={`text-center text-[10px] text-gray-300 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>▲</div>
                  </div>

                  {isOpen && (
                    <EditPanel
                      location={loc} existingFamilies={existingFamilies} allTags={allTags}
                      onSave={data => handleSave(loc.id, data)}
                      onDelete={() => handleDelete(loc.id)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
