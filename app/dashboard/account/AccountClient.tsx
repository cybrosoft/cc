"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type UserProfile = {
  id: string;
  customerNumber: number;
  email: string;
  fullName: string | null;
  mobile: string | null;
  accountType: "BUSINESS" | "PERSONAL" | null;
  market: { id: string; key: string; name: string; defaultCurrency: string };
  customerGroup: { id: string; key: string; name: string } | null;
  companyName: string | null;
  vatTaxId: string | null;
  commercialRegistrationNumber: string | null;
  shortAddressCode: string | null;
  country: string | null;
  province: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  buildingNumber: string | null;
  secondaryNumber: string | null;
  district: string | null;
  city: string | null;
  postalCode: string | null;
  notePublic: string | null;
};

type FormState = {
  fullName: string;
  mobile: string;
  accountType: string;
  companyName: string;
  vatTaxId: string;
  commercialRegistrationNumber: string;
  shortAddressCode: string;
  country: string;
  province: string;
  addressLine1: string;
  addressLine2: string;
  buildingNumber: string;
  secondaryNumber: string;
  district: string;
  city: string;
  postalCode: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AccountClient() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSaudi = profile?.market?.key?.toLowerCase() === "saudi";

  // ── Fetch profile ──────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me");
      if (!res.ok) throw new Error("Failed to load profile");
      const data: UserProfile = await res.json();
      setProfile(data);
      setForm({
        fullName: data.fullName ?? "",
        mobile: data.mobile ?? "",
        accountType: data.accountType ?? "",
        companyName: data.companyName ?? "",
        vatTaxId: data.vatTaxId ?? "",
        commercialRegistrationNumber: data.commercialRegistrationNumber ?? "",
        shortAddressCode: data.shortAddressCode ?? "",
        country: data.country ?? "",
        province: data.province ?? "",
        addressLine1: data.addressLine1 ?? "",
        addressLine2: data.addressLine2 ?? "",
        buildingNumber: data.buildingNumber ?? "",
        secondaryNumber: data.secondaryNumber ?? "",
        district: data.district ?? "",
        city: data.city ?? "",
        postalCode: data.postalCode ?? "",
      });
    } catch {
      setError("Could not load your profile. Please refresh.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName || null,
          mobile: form.mobile || null,
          accountType: form.accountType || null,
          companyName: form.companyName || null,
          vatTaxId: form.vatTaxId || null,
          commercialRegistrationNumber:
            form.commercialRegistrationNumber || null,
          shortAddressCode: form.shortAddressCode || null,
          country: form.country || null,
          province: form.province || null,
          addressLine1: form.addressLine1 || null,
          addressLine2: form.addressLine2 || null,
          buildingNumber: isSaudi ? form.buildingNumber || null : null,
          secondaryNumber: isSaudi ? form.secondaryNumber || null : null,
          district: form.district || null,
          city: form.city || null,
          postalCode: form.postalCode || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await fetchProfile();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const inputCls =
    "border border-gray-200 px-3 py-2 text-sm w-full focus:outline-none focus:border-[#318774] bg-white";
  const selectCls = inputCls + " appearance-none";

  function Field({
    label,
    hint,
    children,
  }: {
    label: string;
    hint?: string;
    children: React.ReactNode;
  }) {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-600">{label}</label>
        {children}
        {hint && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    );
  }

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

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!profile || !form) {
    return (
      <p className="text-sm text-red-600">
        {error ?? "Failed to load profile."}
      </p>
    );
  }

  return (
    <div className="max-w-3xl flex flex-col gap-1">
      {/* ── Account identity (read-only) ─────────────────────────────────── */}
      <div className="border border-gray-200 bg-white mb-4">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Account</h3>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Customer #</p>
            <p className="font-mono font-medium">{profile.customerNumber}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Email</p>
            <p>{profile.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Market</p>
            <p>{profile.market.name}</p>
          </div>
        </div>
        {profile.notePublic && (
          <div className="px-4 pb-4">
            <p className="text-xs text-gray-500 mb-1">Note from support</p>
            <p className="text-sm text-gray-700 bg-amber-50 border border-amber-200 px-3 py-2">
              {profile.notePublic}
            </p>
          </div>
        )}
      </div>

      {/* ── Editable form ──────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Personal */}
        <Section title="Personal Information">
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
              onChange={(e) => set("accountType", e.target.value)}
            >
              <option value="">— Select —</option>
              <option value="BUSINESS">Business</option>
              <option value="PERSONAL">Personal</option>
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

        {/* Business Info */}
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

        {/* Address */}
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

          {/* Saudi-only */}
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

        {/* Error / success */}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 px-3 py-2">
            {error}
          </p>
        )}
        {saved && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2">
            Profile saved successfully.
          </p>
        )}

        <div>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 bg-[#318774] text-white text-sm font-medium hover:bg-[#276e5e] disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
