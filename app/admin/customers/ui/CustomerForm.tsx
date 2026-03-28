"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Market = {
  id: string;
  key: string;
  name: string;
};

type CustomerGroup = {
  id: string;
  key: string;
  name: string;
};

type Tag = {
  id: string;
  key: string;
  name: string;
};

type CustomerFormData = {
  // identity
  email: string;
  fullName: string;
  mobile: string;
  accountType: "BUSINESS" | "PERSONAL" | "";
  marketId: string;
  customerGroupId: string;
  country: string;
  province: string;
  // business info
  companyName: string;
  vatTaxId: string;
  commercialRegistrationNumber: string;
  shortAddressCode: string;
  // address
  addressLine1: string;
  addressLine2: string;
  buildingNumber: string;
  secondaryNumber: string;
  district: string;
  city: string;
  postalCode: string;
  // notes
  notePublic: string;
  notePrivate: string;
  // tags
  tagIds: string[];
};

type Props = {
  /** Pass existing user data to switch to edit mode */
  initialData?: Partial<CustomerFormData> & { id?: string };
  markets: Market[];
  groups: CustomerGroup[];
  tags: Tag[];
  mode: "create" | "edit";
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSaudiMarket(markets: Market[], marketId: string): boolean {
  const m = markets.find((x) => x.id === marketId);
  return !!m && m.key.toLowerCase() === "saudi";
}

const EMPTY: CustomerFormData = {
  email: "",
  fullName: "",
  mobile: "",
  accountType: "",
  marketId: "",
  customerGroupId: "",
  country: "",
  province: "",
  companyName: "",
  vatTaxId: "",
  commercialRegistrationNumber: "",
  shortAddressCode: "",
  addressLine1: "",
  addressLine2: "",
  buildingNumber: "",
  secondaryNumber: "",
  district: "",
  city: "",
  postalCode: "",
  notePublic: "",
  notePrivate: "",
  tagIds: [],
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerForm({
  initialData,
  markets,
  groups,
  tags,
  mode,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<CustomerFormData>({
    ...EMPTY,
    ...initialData,
    tagIds: initialData?.tagIds ?? [],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSaudi = isSaudiMarket(markets, form.marketId);
  const isEdit = mode === "edit";
  const userId = initialData?.id;

  // When market changes, clear Saudi-only fields if no longer Saudi
  useEffect(() => {
    if (!isSaudi) {
      setForm((prev) => ({
        ...prev,
        buildingNumber: "",
        secondaryNumber: "",
      }));
    }
  }, [isSaudi]);

  function set(field: keyof CustomerFormData, value: string | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleTag(id: string) {
    setForm((prev) => ({
      ...prev,
      tagIds: prev.tagIds.includes(id)
        ? prev.tagIds.filter((t) => t !== id)
        : [...prev.tagIds, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      email: form.email.trim(),
      fullName: form.fullName.trim() || null,
      mobile: form.mobile.trim() || null,
      accountType: form.accountType || null,
      marketId: form.marketId || null,
      customerGroupId: form.customerGroupId || null,
      country: form.country.trim() || null,
      province: form.province.trim() || null,
      // business
      companyName: form.companyName.trim() || null,
      vatTaxId: form.vatTaxId.trim() || null,
      commercialRegistrationNumber:
        form.commercialRegistrationNumber.trim() || null,
      shortAddressCode: form.shortAddressCode.trim() || null,
      // address
      addressLine1: form.addressLine1.trim() || null,
      addressLine2: form.addressLine2.trim() || null,
      buildingNumber: isSaudi ? form.buildingNumber.trim() || null : null,
      secondaryNumber: isSaudi ? form.secondaryNumber.trim() || null : null,
      district: form.district.trim() || null,
      city: form.city.trim() || null,
      postalCode: form.postalCode.trim() || null,
      // notes
      notePublic: form.notePublic.trim() || null,
      notePrivate: form.notePrivate.trim() || null,
      // tags
      tagIds: form.tagIds,
    };

    try {
      const url = isEdit
        ? `/api/admin/users/${userId}`
        : `/api/admin/users`;
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed (${res.status})`);
      }

      router.push("/admin/customers");
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  // ─── Render helpers ─────────────────────────────────────────────────────────

  function Field({
    label,
    required,
    hint,
    children,
  }: {
    label: string;
    required?: boolean;
    hint?: string;
    children: React.ReactNode;
  }) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        {children}
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    );
  }

  const inputCls =
    "border border-gray-200 rounded-none px-3 py-2 text-sm w-full focus:outline-none focus:border-[#318774] bg-white";
  const selectCls = inputCls + " appearance-none";

  function Section({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) {
    return (
      <div className="border border-gray-200 bg-white">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {children}
        </div>
      </div>
    );
  }

  // ─── JSX ────────────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {/* ── Identity ────────────────────────────────────────────────────── */}
      <Section title="Identity">
        <Field label="Email" required>
          <input
            type="email"
            className={inputCls}
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            required
            readOnly={isEdit}
            disabled={isEdit}
          />
        </Field>

        <Field label="Full Name">
          <input
            type="text"
            className={inputCls}
            value={form.fullName}
            onChange={(e) => set("fullName", e.target.value)}
          />
        </Field>

        <Field label="Mobile">
          <input
            type="text"
            className={inputCls}
            value={form.mobile}
            onChange={(e) => set("mobile", e.target.value)}
          />
        </Field>

        <Field label="Account Type">
          <select
            className={selectCls}
            value={form.accountType}
            onChange={(e) =>
              set("accountType", e.target.value as CustomerFormData["accountType"])
            }
          >
            <option value="">— Select —</option>
            <option value="BUSINESS">Business</option>
            <option value="PERSONAL">Personal</option>
          </select>
        </Field>

        <Field label="Market" required>
          <select
            className={selectCls}
            value={form.marketId}
            onChange={(e) => set("marketId", e.target.value)}
            required
          >
            <option value="">— Select Market —</option>
            {markets.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Customer Group">
          <select
            className={selectCls}
            value={form.customerGroupId}
            onChange={(e) => set("customerGroupId", e.target.value)}
          >
            <option value="">— None —</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Country">
          <input
            type="text"
            className={inputCls}
            value={form.country}
            onChange={(e) => set("country", e.target.value)}
          />
        </Field>

        <Field label="Province / State">
          <input
            type="text"
            className={inputCls}
            value={form.province}
            onChange={(e) => set("province", e.target.value)}
          />
        </Field>
      </Section>

      {/* ── Business Info ────────────────────────────────────────────────── */}
      <Section title="Business Information">
        <Field label="Company Name">
          <input
            type="text"
            className={inputCls}
            value={form.companyName}
            onChange={(e) => set("companyName", e.target.value)}
          />
        </Field>

        <Field label="VAT / Tax ID">
          <input
            type="text"
            className={inputCls}
            value={form.vatTaxId}
            onChange={(e) => set("vatTaxId", e.target.value)}
          />
        </Field>

        <Field label="Commercial Registration No.">
          <input
            type="text"
            className={inputCls}
            value={form.commercialRegistrationNumber}
            onChange={(e) =>
              set("commercialRegistrationNumber", e.target.value)
            }
          />
        </Field>

        <Field
          label="Short Address Code"
          hint="Saudi National Address short code, e.g. RNAD2323"
        >
          <input
            type="text"
            className={inputCls}
            value={form.shortAddressCode}
            onChange={(e) => set("shortAddressCode", e.target.value)}
            placeholder="e.g. RNAD2323"
            maxLength={8}
          />
        </Field>
      </Section>

      {/* ── Address ──────────────────────────────────────────────────────── */}
      <Section title="Address">
        <Field label="Address Line 1">
          <input
            type="text"
            className={inputCls}
            value={form.addressLine1}
            onChange={(e) => set("addressLine1", e.target.value)}
          />
        </Field>

        <Field label="Address Line 2">
          <input
            type="text"
            className={inputCls}
            value={form.addressLine2}
            onChange={(e) => set("addressLine2", e.target.value)}
          />
        </Field>

        {/* Saudi-only fields */}
        {isSaudi && (
          <>
            <Field
              label="Building Number"
              hint="Saudi National Address — building number"
            >
              <input
                type="text"
                className={inputCls}
                value={form.buildingNumber}
                onChange={(e) => set("buildingNumber", e.target.value)}
                placeholder="e.g. 1234"
              />
            </Field>

            <Field
              label="Secondary Number"
              hint="Saudi National Address — secondary/unit number"
            >
              <input
                type="text"
                className={inputCls}
                value={form.secondaryNumber}
                onChange={(e) => set("secondaryNumber", e.target.value)}
                placeholder="e.g. 5678"
              />
            </Field>
          </>
        )}

        <Field label="District / Neighborhood">
          <input
            type="text"
            className={inputCls}
            value={form.district}
            onChange={(e) => set("district", e.target.value)}
          />
        </Field>

        <Field label="City">
          <input
            type="text"
            className={inputCls}
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </Field>

        <Field label="Postal Code / Zip">
          <input
            type="text"
            className={inputCls}
            value={form.postalCode}
            onChange={(e) => set("postalCode", e.target.value)}
            placeholder={isSaudi ? "e.g. 12345" : "e.g. 10001"}
          />
        </Field>
      </Section>

      {/* ── Tags ─────────────────────────────────────────────────────────── */}
      {tags.length > 0 && (
        <div className="border border-gray-200 bg-white">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Tags</h3>
          </div>
          <div className="p-4 flex flex-wrap gap-2">
            {tags.map((tag) => {
              const active = form.tagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1.5 text-xs border transition-colors ${
                    active
                      ? "bg-[#318774] border-[#318774] text-white"
                      : "bg-white border-gray-200 text-gray-600 hover:border-[#318774]"
                  }`}
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Notes ────────────────────────────────────────────────────────── */}
      <Section title="Notes">
        <Field
          label="Public Note"
          hint="Visible to the customer in their portal"
        >
          <textarea
            className={inputCls + " resize-none h-24"}
            value={form.notePublic}
            onChange={(e) => set("notePublic", e.target.value)}
          />
        </Field>

        <Field label="Private Note" hint="Admin-only, never shown to customer">
          <textarea
            className={inputCls + " resize-none h-24"}
            value={form.notePrivate}
            onChange={(e) => set("notePrivate", e.target.value)}
          />
        </Field>
      </Section>

      {/* ── Error + Submit ───────────────────────────────────────────────── */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2 bg-[#318774] text-white text-sm font-medium hover:bg-[#276e5e] disabled:opacity-50 transition-colors"
        >
          {saving
            ? isEdit
              ? "Saving…"
              : "Creating…"
            : isEdit
            ? "Save Changes"
            : "Create Customer"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2 border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
