// app/admin/catalog/templates/TemplatesAdmin.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

type TemplateStatus   = "active" | "inactive" | "coming_soon";
type TemplateIconType = "devicon" | "upload";
type TemplateCategory = "OS" | "App";

type TemplateRow = {
  id:          string;
  slug:        string;
  name:        string;
  family:      string | null;
  description: string | null;
  category:    TemplateCategory;
  iconType:    TemplateIconType;
  iconValue:   string | null;
  status:      TemplateStatus;
  sortOrder:   number;
  isDefault:   boolean;
  tagKeys:     string[];
};

type TagRow     = { id: string; key: string; name: string };
type ProductRow = { id: string; key: string; tags: { key: string }[] };

// ── Devicon suggestions ───────────────────────────────────────────────────────

const DEVICON_CDN = "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons";

const DEVICON_SUGGESTIONS = [
  { label: "Ubuntu",      class: "devicon-ubuntu-plain colored",       preview: `${DEVICON_CDN}/ubuntu/ubuntu-original.svg`        },
  { label: "Debian",      class: "devicon-debian-plain colored",       preview: `${DEVICON_CDN}/debian/debian-original.svg`        },
  { label: "CentOS",      class: "devicon-centos-plain colored",       preview: `${DEVICON_CDN}/centos/centos-original.svg`        },
  { label: "Linux",       class: "devicon-linux-plain colored",        preview: `${DEVICON_CDN}/linux/linux-original.svg`          },
  { label: "Windows",     class: "devicon-windows8-original colored",  preview: `${DEVICON_CDN}/windows8/windows8-original.svg`    },
  { label: "Docker",      class: "devicon-docker-plain colored",       preview: `${DEVICON_CDN}/docker/docker-original.svg`        },
  { label: "Nginx",       class: "devicon-nginx-original colored",     preview: `${DEVICON_CDN}/nginx/nginx-original.svg`          },
  { label: "Apache",      class: "devicon-apache-plain colored",       preview: `${DEVICON_CDN}/apache/apache-original.svg`        },
  { label: "NodeJS",      class: "devicon-nodejs-plain colored",       preview: `${DEVICON_CDN}/nodejs/nodejs-original.svg`        },
  { label: "Python",      class: "devicon-python-plain colored",       preview: `${DEVICON_CDN}/python/python-original.svg`        },
  { label: "MySQL",       class: "devicon-mysql-plain colored",        preview: `${DEVICON_CDN}/mysql/mysql-original.svg`          },
  { label: "PostgreSQL",  class: "devicon-postgresql-plain colored",   preview: `${DEVICON_CDN}/postgresql/postgresql-original.svg`},
  { label: "Redis",       class: "devicon-redis-plain colored",        preview: `${DEVICON_CDN}/redis/redis-original.svg`          },
  { label: "WordPress",   class: "devicon-wordpress-plain colored",    preview: `${DEVICON_CDN}/wordpress/wordpress-plain.svg`     },
];

const STATUS_CONFIG: Record<TemplateStatus, { label: string; color: string; border: string; dot: string }> = {
  active:      { label: "Active",      color: "bg-green-50 text-green-700",  border: "border-green-200",  dot: "bg-green-500"  },
  inactive:    { label: "Inactive",    color: "bg-gray-100 text-gray-400",   border: "border-gray-200",   dot: "bg-gray-300"   },
  coming_soon: { label: "Coming Soon", color: "bg-amber-50 text-amber-700",  border: "border-amber-200",  dot: "bg-amber-400"  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TemplateStatus }) {
  const c = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ${c.color} ${c.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

function TemplateIcon({ iconType, iconValue, size = 28 }: { iconType: TemplateIconType; iconValue: string | null; size?: number }) {
  if (!iconValue) return <span className="text-gray-300 text-xl">💿</span>;
  if (iconType === "upload") {
    return <img src={iconValue} alt="icon" style={{ width: size, height: size, objectFit: "contain" }} />;
  }
  const match = DEVICON_SUGGESTIONS.find(d => d.class === iconValue);
  if (match) return <img src={match.preview} alt={match.label} style={{ width: size, height: size, objectFit: "contain" }} />;
  return <span className="text-gray-300 text-xl">💿</span>;
}

function TagPill({ tag, onRemove }: { tag: TagRow; onRemove?: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
      {tag.name}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 opacity-60 hover:opacity-100">✕</button>
      )}
    </span>
  );
}

// ── IconPicker ────────────────────────────────────────────────────────────────

function IconPicker({
  iconType, iconValue, onChange,
}: {
  iconType: TemplateIconType;
  iconValue: string | null;
  onChange: (type: TemplateIconType, val: string) => void;
}) {
  const [tab,    setTab]    = useState<"devicon" | "upload">(iconType === "upload" ? "upload" : "devicon");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<string | null>(iconType === "upload" ? iconValue : null);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = DEVICON_SUGGESTIONS.filter(d =>
    d.label.toLowerCase().includes(search.toLowerCase())
  );

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = ev.target?.result as string;
      setPreview(result);
      onChange("upload", result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex border-b border-gray-100">
        {(["devicon", "upload"] as const).map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${tab === t ? "border-b-2 border-gray-900 text-gray-900" : "text-gray-400 hover:text-gray-600"}`}>
            {t === "devicon" ? "🎨 Devicon Library" : "📁 Upload Custom"}
          </button>
        ))}
      </div>

      {tab === "devicon" && (
        <div className="space-y-3 p-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search icons… (ubuntu, docker, windows…)"
            className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300" />
          <div className="grid max-h-48 grid-cols-5 gap-2 overflow-y-auto pr-1">
            {filtered.map(d => (
              <button key={d.class} type="button" onClick={() => onChange("devicon", d.class)} title={d.label}
                className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition-all hover:shadow-sm ${
                  iconValue === d.class && iconType === "devicon"
                    ? "border-gray-800 bg-gray-900 shadow"
                    : "border-gray-100 hover:border-gray-300"
                }`}>
                <img src={d.preview} alt={d.label} className="h-7 w-7 object-contain" />
                <span className={`w-full truncate text-center text-[9px] ${iconValue === d.class && iconType === "devicon" ? "text-gray-300" : "text-gray-400"}`}>
                  {d.label}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-5 py-4 text-center text-xs text-gray-400">No icons — try Upload tab.</p>
            )}
          </div>
          <p className="text-[11px] text-gray-400">
            More icons at <span className="font-medium text-blue-500">devicon.dev</span>
          </p>
        </div>
      )}

      {tab === "upload" && (
        <div className="space-y-3 p-4">
          <p className="text-[11px] text-gray-500">Upload PNG or SVG (64×64px recommended, transparent background).</p>
          <div onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 py-6 transition-colors hover:border-gray-400">
            {preview
              ? <img src={preview} alt="preview" className="h-12 w-12 object-contain" />
              : <span className="text-3xl text-gray-300">📁</span>
            }
            <span className="text-xs text-gray-400">{preview ? "Click to replace" : "Click to upload PNG / SVG"}</span>
            <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg" className="hidden" onChange={handleFile} />
          </div>
          {preview && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-green-600">✓ Custom icon ready</span>
              <button type="button" onClick={() => { setPreview(null); onChange("devicon", ""); }}
                className="text-[11px] text-red-400 underline hover:text-red-600">Remove</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── TagSelector ───────────────────────────────────────────────────────────────

function TagSelector({
  tagKeys, setTagKeys, allTags, allProducts,
}: {
  tagKeys: string[];
  setTagKeys: (v: string[]) => void;
  allTags: TagRow[];
  allProducts: ProductRow[];
}) {
  const selected   = allTags.filter(t => tagKeys.includes(t.key));
  const available  = allTags.filter(t => !tagKeys.includes(t.key));
  const addTag     = (key: string) => { if (!tagKeys.includes(key)) setTagKeys([...tagKeys, key]); };
  const removeTag  = (key: string) => setTagKeys(tagKeys.filter(k => k !== key));

  const resolved = tagKeys.length > 0
    ? allProducts.filter(p => tagKeys.some(tk => p.tags.some(t => t.key === tk)))
    : [];

  return (
    <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
      <div>
        <label className="text-xs font-medium text-gray-700">Tags <span className="text-red-400">*</span></label>
        <p className="mt-0.5 text-[11px] text-gray-400">Appears on any product with at least one of these tags (OR logic).</p>
      </div>
      <div className="flex min-h-[28px] flex-wrap items-center gap-2">
        {selected.length === 0
          ? <span className="text-xs text-gray-400">No tags — pick below</span>
          : selected.map(t => <TagPill key={t.key} tag={t} onRemove={() => removeTag(t.key)} />)
        }
      </div>
      {available.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {available.map(t => (
            <button key={t.key} type="button" onClick={() => addTag(t.key)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] text-gray-400 transition-colors hover:border-gray-500 hover:text-gray-600">
              + {t.name}
            </button>
          ))}
        </div>
      )}
      {/* Resolved products */}
      {tagKeys.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
          <p className="mb-1.5 text-[11px] font-semibold text-gray-500">
            {resolved.length === 0
              ? "⚠️ No matching products — check your tags"
              : `✅ Matches ${resolved.length} product${resolved.length !== 1 ? "s" : ""}:`
            }
          </p>
          {resolved.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {resolved.map(p => (
                <span key={p.id} className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-gray-600">
                  {p.key}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── TemplateFields (shared between Create and Edit) ───────────────────────────

type FieldProps = {
  name: string; setName: (v: string) => void;
  slug: string; setSlug: (v: string) => void;
  family: string; setFamily: (v: string) => void;
  category: TemplateCategory; setCategory: (v: TemplateCategory) => void;
  description: string; setDescription: (v: string) => void;
  iconType: TemplateIconType; iconValue: string;
  setIcon: (type: TemplateIconType, val: string) => void;
  tagKeys: string[]; setTagKeys: (v: string[]) => void;
  status: TemplateStatus; setStatus: (v: TemplateStatus) => void;
  sortOrder: number; setSortOrder: (v: number) => void;
  isDefault: boolean; setIsDefault: (v: boolean) => void;
  slugManual: boolean; setSlugManual: (v: boolean) => void;
  existingFamilies: string[];
  allTags: TagRow[];
  allProducts: ProductRow[];
};

function TemplateFields(p: FieldProps) {
  function handleName(v: string) {
    p.setName(v);
    if (!p.slugManual) p.setSlug(slugify((p.family ? p.family + "-" : "") + v));
  }
  function handleFamily(v: string) {
    p.setFamily(v);
    if (!p.slugManual) p.setSlug(slugify((v ? v + "-" : "") + p.name));
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">

        {/* Family */}
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-medium text-gray-500">
            Family <span className="text-gray-400 font-normal">(leave blank for standalone)</span>
          </label>
          <div className="flex gap-2">
            <input value={p.family} onChange={e => handleFamily(e.target.value)}
              placeholder="e.g. Ubuntu, Windows Server"
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
            {p.existingFamilies.length > 0 && (
              <select onChange={e => e.target.value && handleFamily(e.target.value)} defaultValue=""
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-500 focus:outline-none">
                <option value="">Existing…</option>
                {p.existingFamilies.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            )}
          </div>
          <p className="text-[11px] text-gray-400">
            {p.family ? <>Versions grouped under <strong>{p.family}</strong> family card.</> : "No family — shows as standalone card."}
          </p>
        </div>

        {/* Name */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">{p.family ? "Version Name" : "Template Name"}</label>
          <input value={p.name} onChange={e => handleName(e.target.value)}
            placeholder={p.family ? "e.g. 22.04 LTS" : "e.g. Docker + Portainer"}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
          {p.family && p.name && (
            <p className="text-[11px] text-blue-500">Customer sees: <strong>{p.family} {p.name}</strong></p>
          )}
        </div>

        {/* Slug */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Slug <span className="text-gray-400 font-normal">(unique key)</span></label>
          <input value={p.slug} onChange={e => { p.setSlug(e.target.value); p.setSlugManual(true); }}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
        </div>

        {/* Category */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Category</label>
          <div className="flex gap-2">
            {(["OS", "App"] as TemplateCategory[]).map(c => (
              <button key={c} type="button" onClick={() => p.setCategory(c)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-medium transition-colors ${
                  p.category === c ? "border-gray-800 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                }`}>
                {c === "OS" ? "💿 OS" : "⚙️ App"}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Status</label>
          <div className="flex gap-2">
            {(Object.entries(STATUS_CONFIG) as [TemplateStatus, typeof STATUS_CONFIG[TemplateStatus]][]).map(([key, cfg]) => (
              <button key={key} type="button" onClick={() => p.setStatus(key)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-[11px] font-medium transition-colors ${
                  p.status === key ? `${cfg.color} ${cfg.border}` : "border-gray-200 bg-white text-gray-400 hover:bg-gray-50"
                }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </button>
            ))}
          </div>
          {p.status === "coming_soon" && <p className="text-[11px] text-amber-600">Shown grayed-out to customers. Not selectable.</p>}
          {p.status === "inactive"    && <p className="text-[11px] text-gray-400">Hidden from customers entirely.</p>}
        </div>

        {/* Sort Order */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Sort Order <span className="text-gray-400 font-normal">(lower = first)</span></label>
          <input type="number" min={0} value={p.sortOrder} onChange={e => p.setSortOrder(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
        </div>

        {/* Description */}
        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-medium text-gray-500">Description <span className="text-gray-400 font-normal">(shown to customer)</span></label>
          <input value={p.description} onChange={e => p.setDescription(e.target.value)}
            placeholder="Short description…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300" />
        </div>

        {/* Default version toggle — only when family is set */}
        {p.family && (
          <div className="md:col-span-2">
            <label
              onClick={() => p.setIsDefault(!p.isDefault)}
              className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:bg-gray-50">
              <div className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${p.isDefault ? "bg-gray-900" : "bg-gray-200"}`}>
                <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${p.isDefault ? "translate-x-4" : "translate-x-0.5"}`} />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-700">Set as default version</div>
                <div className="text-[11px] text-gray-400">Pre-selected when customer opens the {p.family} family card.</div>
              </div>
              {p.isDefault && <span className="ml-auto text-[11px] font-semibold text-green-600">✓ Default</span>}
            </label>
          </div>
        )}
      </div>

      {/* Icon picker */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-gray-500">Icon</label>
          {p.iconValue && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400">Current:</span>
              <TemplateIcon iconType={p.iconType} iconValue={p.iconValue} size={22} />
            </div>
          )}
        </div>
        <IconPicker iconType={p.iconType} iconValue={p.iconValue} onChange={p.setIcon} />
      </div>

      <TagSelector tagKeys={p.tagKeys} setTagKeys={p.setTagKeys} allTags={p.allTags} allProducts={p.allProducts} />
    </div>
  );
}

// ── EditPanel ─────────────────────────────────────────────────────────────────

function EditPanel({
  template, existingFamilies, allTags, allProducts, onSave, onDelete,
}: {
  template: TemplateRow;
  existingFamilies: string[];
  allTags: TagRow[];
  allProducts: ProductRow[];
  onSave: (data: Partial<TemplateRow>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [name,        setName]        = useState(template.name);
  const [slug,        setSlug]        = useState(template.slug);
  const [family,      setFamily]      = useState(template.family ?? "");
  const [category,    setCategory]    = useState<TemplateCategory>(template.category);
  const [description, setDescription] = useState(template.description ?? "");
  const [iconType,    setIconType]    = useState<TemplateIconType>(template.iconType);
  const [iconValue,   setIconValue]   = useState(template.iconValue ?? "");
  const [tagKeys,     setTagKeys]     = useState<string[]>(template.tagKeys);
  const [status,      setStatus]      = useState<TemplateStatus>(template.status);
  const [sortOrder,   setSortOrder]   = useState(template.sortOrder);
  const [isDefault,   setIsDefault]   = useState(template.isDefault);
  const [slugManual,  setSlugManual]  = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [confirmDel,  setConfirmDel]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState("");

  function setIcon(type: TemplateIconType, val: string) { setIconType(type); setIconValue(val); }

  const isValid = name.trim() && slug.trim() && tagKeys.length > 0;

  async function handleSave() {
    if (!isValid || saving) return;
    setSaving(true); setError("");
    try {
      await onSave({ name, slug, family: family || null, category, description: description || null, iconType, iconValue: iconValue || null, tagKeys, status, sortOrder, isDefault });
    } catch (e: any) {
      setError(e.message ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try { await onDelete(); } catch (e: any) { setError(e.message ?? "Delete failed"); setDeleting(false); }
  }

  return (
    <div className="border-t border-blue-100 bg-blue-50/20 px-6 py-5 space-y-5">
      <TemplateFields
        name={name} setName={setName} slug={slug} setSlug={setSlug}
        family={family} setFamily={setFamily} category={category} setCategory={setCategory}
        description={description} setDescription={setDescription}
        iconType={iconType} iconValue={iconValue} setIcon={setIcon}
        tagKeys={tagKeys} setTagKeys={setTagKeys}
        status={status} setStatus={setStatus}
        sortOrder={sortOrder} setSortOrder={setSortOrder}
        isDefault={isDefault} setIsDefault={setIsDefault}
        slugManual={slugManual} setSlugManual={setSlugManual}
        existingFamilies={existingFamilies} allTags={allTags} allProducts={allProducts}
      />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2">
          {!confirmDel ? (
            <button onClick={() => setConfirmDel(true)}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50">
              🗑️ Delete
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
              <span className="text-xs text-red-600">Sure?</span>
              <button onClick={handleDelete} disabled={deleting}
                className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-50">
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
  existingFamilies, allTags, allProducts, onSave, onCancel,
}: {
  existingFamilies: string[];
  allTags: TagRow[];
  allProducts: ProductRow[];
  onSave: (data: Omit<TemplateRow, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onCancel: () => void;
}) {
  const [name,        setName]        = useState("");
  const [slug,        setSlug]        = useState("");
  const [family,      setFamily]      = useState("");
  const [category,    setCategory]    = useState<TemplateCategory>("OS");
  const [description, setDescription] = useState("");
  const [iconType,    setIconType]    = useState<TemplateIconType>("devicon");
  const [iconValue,   setIconValue]   = useState("");
  const [tagKeys,     setTagKeys]     = useState<string[]>([]);
  const [status,      setStatus]      = useState<TemplateStatus>("active");
  const [sortOrder,   setSortOrder]   = useState(1);
  const [isDefault,   setIsDefault]   = useState(false);
  const [slugManual,  setSlugManual]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  function setIcon(type: TemplateIconType, val: string) { setIconType(type); setIconValue(val); }
  const isValid = name.trim() && slug.trim() && tagKeys.length > 0;

  async function handleSave() {
    if (!isValid || saving) return;
    setSaving(true); setError("");
    try {
      await onSave({ name, slug, family: family || null, category, description: description || null, iconType, iconValue: iconValue || null, tagKeys, status, sortOrder, isDefault });
    } catch (e: any) {
      setError(e.message ?? "Save failed");
      setSaving(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-5 py-3">
        <h2 className="text-sm font-semibold text-gray-700">New Template</h2>
      </div>
      <div className="space-y-5 p-5">
        <TemplateFields
          name={name} setName={setName} slug={slug} setSlug={setSlug}
          family={family} setFamily={setFamily} category={category} setCategory={setCategory}
          description={description} setDescription={setDescription}
          iconType={iconType} iconValue={iconValue} setIcon={setIcon}
          tagKeys={tagKeys} setTagKeys={setTagKeys}
          status={status} setStatus={setStatus}
          sortOrder={sortOrder} setSortOrder={setSortOrder}
          isDefault={isDefault} setIsDefault={setIsDefault}
          slugManual={slugManual} setSlugManual={setSlugManual}
          existingFamilies={existingFamilies} allTags={allTags} allProducts={allProducts}
        />
        {/* Preview card */}
        {name && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Customer Card Preview</p>
            <div className="inline-flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <TemplateIcon iconType={iconType} iconValue={iconValue} size={36} />
              <div>
                <div className="text-sm font-semibold text-gray-900">{family || name}</div>
                {family && <div className="text-xs text-gray-500">Version: {name}</div>}
                {description && <div className="mt-0.5 text-xs text-gray-400">{description}</div>}
              </div>
            </div>
          </div>
        )}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onCancel}
            className="rounded-lg border border-gray-200 px-4 py-2 text-xs text-gray-500 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!isValid || saving}
            className="rounded-lg bg-gray-900 px-5 py-2 text-xs font-semibold text-white hover:bg-gray-700 disabled:opacity-40">
            {saving ? "Creating…" : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function TemplatesAdmin() {
  const [templates,   setTemplates]  = useState<TemplateRow[]>([]);
  const [allTags,     setAllTags]    = useState<TagRow[]>([]);
  const [allProducts, setAllProducts]= useState<ProductRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [creating,   setCreating]   = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterName, setFilterName] = useState("");
  const [filterTag,  setFilterTag]  = useState("");
  const [filterCat,  setFilterCat]  = useState("");
  const [error,      setError]      = useState("");

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const [tRes, tagRes, prodRes] = await Promise.all([
      fetch("/api/admin/catalog/templates", { cache: "no-store" }),
      fetch("/api/admin/catalog/tags",      { cache: "no-store" }),
      fetch("/api/admin/catalog/products",  { cache: "no-store" }),
    ]);
    const [tJson, tagJson, prodJson] = await Promise.all([tRes.json(), tagRes.json(), prodRes.json()]);
    if (tJson?.ok)    setTemplates(tJson.data);
    if (tagJson?.ok)  setAllTags(tagJson.data);
    if (prodJson?.ok) setAllProducts(prodJson.data.map((p: any) => ({ id: p.id, key: p.key, tags: p.tags ?? [] })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const existingFamilies = [...new Set(templates.map(t => t.family).filter(Boolean))] as string[];

  // ── Create ──────────────────────────────────────────────────────────────────
  async function handleCreate(data: Omit<TemplateRow, "id">) {
    const res  = await fetch("/api/admin/catalog/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const json = await res.json();
    if (!json?.ok) throw new Error(json?.error ?? "Create failed");
    setCreating(false);
    await load();
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  async function handleSave(id: string, data: Partial<TemplateRow>) {
    const res  = await fetch("/api/admin/catalog/templates/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...data }) });
    const json = await res.json();
    if (!json?.ok) throw new Error(json?.error ?? "Update failed");
    setExpandedId(null);
    await load();
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    const res  = await fetch("/api/admin/catalog/templates/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const json = await res.json();
    if (!json?.ok) throw new Error(json?.error ?? "Delete failed");
    setExpandedId(null);
    await load();
  }

  // ── Filter ──────────────────────────────────────────────────────────────────
  const filtered = templates.filter(t => {
    const full = t.family ? `${t.family} ${t.name}` : t.name;
    if (filterName && !full.toLowerCase().includes(filterName.toLowerCase())) return false;
    if (filterTag  && !t.tagKeys.includes(filterTag)) return false;
    if (filterCat  && t.category !== filterCat) return false;
    return true;
  });

  const hasFilter = filterName || filterTag || filterCat;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-5xl space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">OS & App Templates</h1>
            <p className="mt-0.5 text-sm text-gray-400">
              Shown to customers during subscription creation. Matched to products via tags (OR logic).
            </p>
            {!loading && (
              <div className="mt-2 flex flex-wrap gap-2">
                {allTags.map(tag => {
                  const count = templates.filter(t => t.tagKeys.includes(tag.key)).length;
                  return (
                    <span key={tag.key} className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                      {tag.name} · {count}
                    </span>
                  );
                })}
                <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-500">
                  {existingFamilies.length} families
                </span>
                {templates.filter(t => t.status === "coming_soon").length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                    {templates.filter(t => t.status === "coming_soon").length} coming soon
                  </span>
                )}
              </div>
            )}
          </div>
          {!creating && (
            <button onClick={() => { setCreating(true); setExpandedId(null); }}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700">
              + Add Template
            </button>
          )}
        </div>

        {/* Create panel */}
        {creating && (
          <CreatePanel
            existingFamilies={existingFamilies}
            allTags={allTags}
            allProducts={allProducts}
            onSave={handleCreate}
            onCancel={() => setCreating(false)}
          />
        )}

        {/* Filter bar */}
        {!creating && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white px-4 py-3 shadow-sm">
            <input value={filterName} onChange={e => setFilterName(e.target.value)} placeholder="Search name…"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300"
              style={{ width: 160 }} />
            <select value={filterTag} onChange={e => setFilterTag(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300">
              <option value="">All Tags</option>
              {allTags.map(t => <option key={t.key} value={t.key}>{t.name}</option>)}
            </select>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300">
              <option value="">All Categories</option>
              <option value="OS">💿 OS</option>
              <option value="App">⚙️ App</option>
            </select>
            {hasFilter && (
              <button onClick={() => { setFilterName(""); setFilterTag(""); setFilterCat(""); }}
                className="text-xs text-gray-400 underline hover:text-gray-600">Clear</button>
            )}
            <span className="ml-auto text-xs text-gray-400">{filtered.length} of {templates.length}</span>
          </div>
        )}

        {/* Table */}
        {!creating && (
          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            {/* Header */}
            <div className="grid border-b bg-gray-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400"
              style={{ gridTemplateColumns: "44px 1fr 130px 180px 80px 120px 36px 24px" }}>
              <div>Icon</div>
              <div>Template</div>
              <div>Family</div>
              <div>Tags</div>
              <div>Category</div>
              <div>Status</div>
              <div title="Sort Order">⇅</div>
              <div />
            </div>

            {loading && (
              <div className="px-5 py-10 text-center text-sm text-gray-400">Loading…</div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="px-5 py-10 text-center text-sm text-gray-400">No templates match filters.</div>
            )}

            {!loading && filtered.map(t => {
              const isOpen      = expandedId === t.id;
              const displayName = t.family ? `${t.family} ${t.name}` : t.name;

              return (
                <div key={t.id} className="border-b last:border-b-0">
                  {/* Row */}
                  <div
                    className={`grid cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-gray-50/80 ${isOpen ? "bg-blue-50/30" : ""} ${t.status === "inactive" ? "opacity-50" : ""}`}
                    style={{ gridTemplateColumns: "44px 1fr 130px 180px 80px 120px 36px 24px" }}
                    onClick={() => setExpandedId(isOpen ? null : t.id)}
                  >
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-100 bg-gray-50">
                      <TemplateIcon iconType={t.iconType} iconValue={t.iconValue} size={24} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-gray-900">{displayName}</span>
                        {t.isDefault && t.family && (
                          <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-600">Default</span>
                        )}
                      </div>
                      <div className="font-mono text-[11px] text-gray-400">{t.slug}</div>
                    </div>
                    <div>
                      {t.family
                        ? <span className="rounded-full border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-600">{t.family}</span>
                        : <span className="text-[11px] text-gray-300">standalone</span>
                      }
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {allTags.filter(tg => t.tagKeys.includes(tg.key)).map(tg => (
                        <TagPill key={tg.key} tag={tg} />
                      ))}
                    </div>
                    <div>
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                        t.category === "OS" ? "border-gray-200 bg-gray-100 text-gray-600" : "border-purple-200 bg-purple-50 text-purple-700"
                      }`}>
                        {t.category === "OS" ? "💿 OS" : "⚙️ App"}
                      </span>
                    </div>
                    <div><StatusBadge status={t.status} /></div>
                    <div className="text-center font-mono text-xs text-gray-400">{t.sortOrder}</div>
                    <div className={`text-center text-[10px] text-gray-300 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>▲</div>
                  </div>

                  {/* Edit panel */}
                  {isOpen && (
                    <EditPanel
                      template={t}
                      existingFamilies={existingFamilies}
                      allTags={allTags}
                      allProducts={allProducts}
                      onSave={data => handleSave(t.id, data)}
                      onDelete={() => handleDelete(t.id)}
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
