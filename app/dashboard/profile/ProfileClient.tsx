"use client";
// app/dashboard/profile/ProfileClient.tsx

import { useEffect, useState } from "react";
import { colors } from "@/lib/ui/tokens";

interface Profile {
  id: string; email: string; customerNumber: number;
  fullName: string | null; mobile: string | null; accountType: string | null;
  companyName: string | null; vatTaxId: string | null; crn: string | null;
  country: string | null; province: string | null;
  addressLine1: string | null; addressLine2: string | null;
  district: string | null; city: string | null;
  notePublic: string | null; timezone: string | null;
  createdAt: string;
  market:  { id: string; key: string; name: string; currency: string };
  customerGroup: { id: string; key: string; name: string } | null;
  tags: { key: string; name: string }[];
}

function Sk({ w = "100%", h = 13 }: { w?: string | number; h?: number }) {
  return <span className="cy-shimmer" style={{ width: w, height: h, display: "inline-block" }} />;
}

function Field({ label, value, editing, name, onChange, placeholder }: {
  label: string; value: string | null; editing: boolean;
  name: string; onChange: (name: string, val: string) => void; placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: editing ? "flex-start" : "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ width: 160, flexShrink: 0, fontSize: 12.5, color: "#6b7280" }}>{label}</span>
      {editing ? (
        <input
          type="text"
          defaultValue={value ?? ""}
          name={name}
          onChange={e => onChange(name, e.target.value)}
          placeholder={placeholder ?? ""}
          style={{ flex: 1, height: 34, padding: "0 10px", border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" }}
        />
      ) : (
        <span style={{ flex: 1, fontSize: 13, color: value ? "#111827" : "#9ca3af" }}>
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}

export function ProfileClient() {
  const [profile,   setProfile]   = useState<Profile | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [changes,   setChanges]   = useState<Record<string, string>>({});
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/customer/profile")
      .then(r => r.json())
      .then(d => setProfile(d.profile ?? null))
      .finally(() => setLoading(false));
  }, []);

  function handleChange(name: string, val: string) {
    setChanges(prev => ({ ...prev, [name]: val }));
  }

  async function handleSave() {
    if (Object.keys(changes).length === 0) { setEditing(false); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(changes),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Update failed."); return; }
      // Merge changes into profile
      setProfile(prev => prev ? { ...prev, ...Object.fromEntries(
        Object.entries(changes).map(([k, v]) => [k, v || null])
      ) } as Profile : prev);
      setEditing(false);
      setChanges({});
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <div className="cy-page-content">
      <div className="cy-dash-wrap" style={{ maxWidth: 720 }}>
        <div style={{ marginBottom: 20 }}><Sk w="180px" h={22} /></div>
        {[1,2,3,4,5,6].map(i => (
          <div key={i} style={{ display: "flex", padding: "12px 0", borderBottom: "1px solid #f3f4f6", gap: 16 }}>
            <Sk w="140px" h={12} /><Sk w="50%" h={12} />
          </div>
        ))}
      </div>
    </div>
  );

  if (!profile) return (
    <div className="cy-page-content">
      <div className="cy-dash-wrap"><p style={{ color: "#9ca3af" }}>Profile not found.</p></div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes cy-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .cy-shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%);background-size:800px 100%;animation:cy-shimmer 1.4s ease-in-out infinite;border-radius:4px;}
      `}</style>

      <div className="cy-page-content">
        <div className="cy-dash-wrap" style={{ maxWidth: 720 }}>

          {/* Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
            <div>
              <h1 className="cy-page-title" style={{ margin: "0 0 3px" }}>My Profile</h1>
              <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>Customer #{profile.customerNumber} · {profile.market.name}</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {editing ? (
                <>
                  <button onClick={() => { setEditing(false); setChanges({}); setError(null); }}
                    style={{ height: 34, padding: "0 14px", background: "#fff", border: "1px solid #e5e7eb", fontSize: 13, color: "#374151", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    style={{ height: 34, padding: "0 14px", background: colors.primary, color: "#fff", border: "none", fontSize: 13, fontWeight: 500, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                    {saving ? "Saving…" : "Save changes"}
                  </button>
                </>
              ) : (
                <button onClick={() => { setEditing(true); setSaved(false); }}
                  style={{ height: 34, padding: "0 14px", background: "#fff", border: "1px solid #e5e7eb", fontSize: 13, color: "#374151", cursor: "pointer" }}>
                  Edit profile
                </button>
              )}
            </div>
          </div>

          {saved && (
            <div style={{ padding: "10px 14px", background: "#e8f5f0", border: "1px solid #a8d5c9", color: "#0F6E56", fontSize: 13, marginBottom: 16 }}>
              Profile updated successfully.
            </div>
          )}
          {error && (
            <div style={{ padding: "10px 14px", background: "#fdf0ef", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Account info (read-only) */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", marginBottom: 16, overflow: "hidden" }}>
            <div style={{ padding: "11px 16px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>Account Information</h2>
            </div>
            <div style={{ padding: "0 16px" }}>
              {[
                { label: "Email",           value: profile.email },
                { label: "Customer no.",    value: `#${profile.customerNumber}` },
                { label: "Market",          value: profile.market.name },
                { label: "Currency",        value: profile.market.currency },
                { label: "Customer group",  value: profile.customerGroup?.name ?? "—" },
                { label: "Member since",    value: new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" }) },
              ].map(r => (
                <div key={r.label} style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ width: 160, flexShrink: 0, fontSize: 12.5, color: "#6b7280" }}>{r.label}</span>
                  <span style={{ fontSize: 13, color: "#111827" }}>{r.value}</span>
                </div>
              ))}
              {profile.tags.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", padding: "10px 0" }}>
                  <span style={{ width: 160, flexShrink: 0, fontSize: 12.5, color: "#6b7280" }}>Tags</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {profile.tags.map(t => (
                      <span key={t.key} style={{ fontSize: 11.5, background: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: 4 }}>{t.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Personal info (editable) */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", marginBottom: 16, overflow: "hidden" }}>
            <div style={{ padding: "11px 16px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>Personal Information</h2>
            </div>
            <div style={{ padding: "0 16px" }}>
              <Field label="Full name"   value={profile.fullName}    editing={editing} name="fullName"   onChange={handleChange} />
              <Field label="Mobile"      value={profile.mobile}      editing={editing} name="mobile"     onChange={handleChange} placeholder="+966 5x xxx xxxx" />
              <Field label="Timezone"    value={profile.timezone}    editing={editing} name="timezone"   onChange={handleChange} placeholder="Asia/Riyadh" />
            </div>
          </div>

          {/* Company info (editable) */}
          {(profile.accountType === "BUSINESS" || profile.companyName) && (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", marginBottom: 16, overflow: "hidden" }}>
              <div style={{ padding: "11px 16px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
                <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>Company Information</h2>
              </div>
              <div style={{ padding: "0 16px" }}>
                <Field label="Company name"   value={profile.companyName} editing={editing} name="companyName" onChange={handleChange} />
                <Field label="VAT / Tax ID"   value={profile.vatTaxId}    editing={editing} name="vatTaxId"    onChange={handleChange} />
                <Field label="CR Number"      value={profile.crn}         editing={editing} name="commercialRegistrationNumber" onChange={handleChange} />
              </div>
            </div>
          )}

          {/* Address (editable) */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>
            <div style={{ padding: "11px 16px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" }}>
              <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" }}>Address</h2>
            </div>
            <div style={{ padding: "0 16px" }}>
              <Field label="Address line 1" value={profile.addressLine1} editing={editing} name="addressLine1" onChange={handleChange} />
              <Field label="Address line 2" value={profile.addressLine2} editing={editing} name="addressLine2" onChange={handleChange} />
              <Field label="District"       value={profile.district}     editing={editing} name="district"     onChange={handleChange} />
              <Field label="City"           value={profile.city}         editing={editing} name="city"         onChange={handleChange} />
              <Field label="Province"       value={profile.province}     editing={editing} name="province"     onChange={handleChange} />
              <Field label="Country"        value={profile.country}      editing={editing} name="country"      onChange={handleChange} />
            </div>
          </div>

          {/* Public note from admin */}
          {profile.notePublic && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 13, color: "#374151" }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>Note from support:</span>{profile.notePublic}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
