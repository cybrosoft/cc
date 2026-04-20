"use client";
// app/dashboard/profile/ProfileClient.tsx

import { useEffect, useState } from "react";
import { colors } from "@/lib/ui/tokens";

interface Profile {
  id: string; email: string; customerNumber: number;
  fullName: string | null; mobile: string | null; accountType: string | null;
  companyName: string | null; vatTaxId: string | null; crn: string | null;
  shortAddressCode: string | null;
  country: string | null; province: string | null;
  addressLine1: string | null; addressLine2: string | null;
  buildingNumber: string | null; secondaryNumber: string | null;
  district: string | null; city: string | null; postalCode: string | null;
  notePublic: string | null; timezone: string | null;
  tcAccepted: boolean; privacyAccepted: boolean;
  createdAt: string;
  market: { id: string; key: string; name: string; currency: string };
  customerGroup: { id: string; key: string; name: string } | null;
  tags: { key: string; name: string }[];
}

const SAUDI_PROVINCES = [
  "Riyadh Province", "Makkah al-Mukarramah Province",
  "Al-Madinah Al-Munawwarah Province", "Eastern Province (Ash Sharqiyah)",
  "Aseer Province", "Tabuk Province", "Hail Province",
  "Al-Qassim Province", "Jazan Province", "Najran Province",
  "Al-Bahah Province", "Al-Jawf Province", "Northern Borders Province",
];

function Sk({ w = "100%", h = 13 }: { w?: string | number; h?: number }) {
  return <span className="cy-shimmer" style={{ width: w, height: h, display: "inline-block" }} />;
}

function ReadRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ width: 180, flexShrink: 0, fontSize: 12.5, color: "#6b7280" }}>{label}</span>
      <span style={{ flex: 1, fontSize: 13, color: value ? "#111827" : "#9ca3af" }}>{value ?? "—"}</span>
    </div>
  );
}

function EditRow({ label, value, name, onChange, placeholder, optional }: {
  label: string; value: string | null; editing?: boolean;
  name: string; onChange: (name: string, val: string) => void;
  placeholder?: string; optional?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ width: 180, flexShrink: 0, fontSize: 12.5, color: "#6b7280", paddingTop: 8 }}>
        {label}{optional && <span style={{ color: "#9ca3af", fontSize: 11 }}> (optional)</span>}
      </span>
      <input
        type="text"
        defaultValue={value ?? ""}
        name={name}
        onChange={e => onChange(name, e.target.value)}
        placeholder={placeholder ?? ""}
        style={{ flex: 1, height: 34, padding: "0 10px", border: "1px solid #d1d5db", fontSize: 13, boxSizing: "border-box" as const }}
      />
    </div>
  );
}

function SelectRow({ label, value, name, onChange, options, optional }: {
  label: string; value: string | null; name: string;
  onChange: (name: string, val: string) => void;
  options: { value: string; label: string }[];
  optional?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
      <span style={{ width: 180, flexShrink: 0, fontSize: 12.5, color: "#6b7280", paddingTop: 8 }}>
        {label}{optional && <span style={{ color: "#9ca3af", fontSize: 11 }}> (optional)</span>}
      </span>
      <select
        defaultValue={value ?? ""}
        name={name}
        onChange={e => onChange(name, e.target.value)}
        style={{ flex: 1, height: 34, padding: "0 10px", border: "1px solid #d1d5db", fontSize: 13, background: "#fff", boxSizing: "border-box" as const }}
      >
        <option value="">— Select —</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── TOTP Section ──────────────────────────────────────────────────────────────
type TotpStep = "idle" | "setup" | "confirm" | "disable";

function TotpSection({ totpEnabled: initialEnabled }: { totpEnabled: boolean }) {
  const [enabled,  setEnabled]  = useState(initialEnabled);
  const [step,     setStep]     = useState<TotpStep>("idle");
  const [qrUrl,    setQrUrl]    = useState<string | null>(null);
  const [secret,   setSecret]   = useState<string | null>(null);
  const [code,     setCode]     = useState("");
  const [loading,  setLoading]  = useState(false);
  const [msg,      setMsg]      = useState<{ text: string; ok: boolean } | null>(null);

  const P = "#318774";

  async function startSetup() {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/auth/totp/setup", { method: "POST" });
      const d   = await res.json();
      if (!res.ok || !d.ok) { setMsg({ text: d.error ?? "Failed to start setup.", ok: false }); return; }
      setQrUrl(d.qrDataUrl);
      setSecret(d.secret);
      setStep("setup");
    } catch { setMsg({ text: "Network error.", ok: false }); }
    finally  { setLoading(false); }
  }

  async function confirmSetup() {
    if (code.length !== 6) { setMsg({ text: "Enter the 6-digit code from your authenticator app.", ok: false }); return; }
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/auth/totp/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) { setMsg({ text: d.error ?? "Invalid code.", ok: false }); return; }
      setEnabled(true); setStep("idle"); setCode(""); setQrUrl(null); setSecret(null);
      setMsg({ text: "Two-factor authentication enabled successfully.", ok: true });
    } catch { setMsg({ text: "Network error.", ok: false }); }
    finally  { setLoading(false); }
  }

  async function confirmDisable() {
    if (code.length !== 6) { setMsg({ text: "Enter the 6-digit code from your authenticator app.", ok: false }); return; }
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/auth/totp/disable", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const d = await res.json();
      if (!res.ok || !d.ok) { setMsg({ text: d.error ?? "Invalid code.", ok: false }); return; }
      setEnabled(false); setStep("idle"); setCode("");
      setMsg({ text: "Two-factor authentication disabled.", ok: true });
    } catch { setMsg({ text: "Network error.", ok: false }); }
    finally  { setLoading(false); }
  }

  function cancel() {
    setStep("idle"); setCode(""); setQrUrl(null); setSecret(null); setMsg(null);
  }

  const inputStyle: React.CSSProperties = {
    width: 140, padding: "8px 12px", fontSize: 20, letterSpacing: "0.25em",
    textAlign: "center", border: "1px solid #d1d5db", fontFamily: "monospace",
    outline: "none", boxSizing: "border-box",
  };

  const sectionStyle = { background: "#fff", border: "1px solid #e5e7eb", marginBottom: 16, overflow: "hidden" as const };
  const sectionHead  = { padding: "11px 16px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" };
  const h2Style      = { margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" };

  return (
    <div style={sectionStyle}>
      <div style={sectionHead}>
        <h2 style={h2Style}>Security · Two-Factor Authentication</h2>
      </div>
      <div style={{ padding: "16px 16px" }}>

        {/* Status row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: step !== "idle" ? 20 : 0 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{
                display: "inline-block", width: 8, height: 8, borderRadius: "50%",
                background: enabled ? "#22c55e" : "#d1d5db",
              }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>
                {enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280" }}>
              {enabled
                ? "Your account is protected with an authenticator app."
                : "Add an extra layer of security using Google Authenticator, Microsoft Authenticator, or any TOTP app."
              }
            </p>
          </div>
          {step === "idle" && (
            <button
              onClick={enabled ? () => { setStep("disable"); setMsg(null); } : startSetup}
              disabled={loading}
              style={{
                flexShrink: 0, height: 34, padding: "0 16px", fontSize: 13, fontWeight: 500,
                background: enabled ? "#fff" : P,
                color: enabled ? "#dc2626" : "#fff",
                border: enabled ? "1px solid #fca5a5" : "none",
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? "Loading…" : enabled ? "Disable 2FA" : "Enable 2FA"}
            </button>
          )}
        </div>

        {/* Message */}
        {msg && (
          <div style={{
            padding: "9px 12px", fontSize: 12, marginBottom: 16,
            background: msg.ok ? "#eaf4f2" : "#fee2e2",
            border: `1px solid ${msg.ok ? "#86efac" : "#fca5a5"}`,
            color: msg.ok ? "#15803d" : "#991b1b",
          }}>{msg.text}</div>
        )}

        {/* Setup step 1 — show QR */}
        {step === "setup" && qrUrl && (
          <div>
            <p style={{ fontSize: 13, color: "#374151", margin: "0 0 12px" }}>
              Scan this QR code with your authenticator app, then enter the 6-digit code to confirm.
            </p>
            <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" as const }}>
              <div>
                <img src={qrUrl} alt="TOTP QR code" width={160} height={160} style={{ display: "block", border: "1px solid #e5e7eb" }} />
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px" }}>
                  Can't scan? Enter this key manually in your app:
                </p>
                <code style={{
                  display: "block", padding: "8px 10px", background: "#f3f4f6",
                  fontSize: 12, letterSpacing: "0.1em", wordBreak: "break-all" as const,
                  color: "#374151", marginBottom: 16,
                }}>{secret}</code>
                <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 8px" }}>Works with:</p>
                <p style={{ fontSize: 12, color: "#374151", margin: 0, lineHeight: 1.6 }}>
                  Google Authenticator · Microsoft Authenticator · Authy · Apple Passwords · 1Password · Bitwarden · Dashlane · LastPass Authenticator · Duo Mobile · Aegis · andOTP · Raivo OTP · any TOTP app
                </p>
              </div>
            </div>
            <div style={{ marginTop: 20, display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text" inputMode="numeric" maxLength={6} autoFocus
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = P)}
                onBlur={e  => (e.target.style.borderColor = "#d1d5db")}
              />
              <button onClick={confirmSetup} disabled={loading || code.length !== 6} style={{
                height: 38, padding: "0 20px", background: code.length === 6 ? P : "#e5e7eb",
                color: code.length === 6 ? "#fff" : "#9ca3af", border: "none",
                fontSize: 13, fontWeight: 500, cursor: code.length === 6 ? "pointer" : "default",
              }}>
                {loading ? "Verifying…" : "Confirm & Enable"}
              </button>
              <button onClick={cancel} style={{
                height: 38, padding: "0 14px", background: "#fff",
                border: "1px solid #e5e7eb", fontSize: 13, color: "#6b7280", cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        )}

        {/* Disable step — verify before disabling */}
        {step === "disable" && (
          <div>
            <p style={{ fontSize: 13, color: "#374151", margin: "0 0 12px" }}>
              Enter the current 6-digit code from your authenticator app to disable 2FA.
            </p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="text" inputMode="numeric" maxLength={6} autoFocus
                value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = "#dc2626")}
                onBlur={e  => (e.target.style.borderColor = "#d1d5db")}
              />
              <button onClick={confirmDisable} disabled={loading || code.length !== 6} style={{
                height: 38, padding: "0 20px",
                background: code.length === 6 ? "#dc2626" : "#e5e7eb",
                color: code.length === 6 ? "#fff" : "#9ca3af",
                border: "none", fontSize: 13, fontWeight: 500,
                cursor: code.length === 6 ? "pointer" : "default",
              }}>
                {loading ? "Verifying…" : "Confirm & Disable"}
              </button>
              <button onClick={cancel} style={{
                height: 38, padding: "0 14px", background: "#fff",
                border: "1px solid #e5e7eb", fontSize: 13, color: "#6b7280", cursor: "pointer",
              }}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ProfileClient ─────────────────────────────────────────────────────────
export function ProfileClient() {
  const [profile,  setProfile]  = useState<Profile | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [editing,  setEditing]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [changes,  setChanges]  = useState<Record<string, string>>({});
  const [saved,    setSaved]    = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/customer/profile")
      .then(r => r.json())
      .then(d => {
        setProfile(d.profile ?? null);
      })
      .finally(() => setLoading(false));

    // Fetch TOTP status separately from session
    fetch("/api/auth/totp/status")
      .then(r => r.json())
      .then(d => { if (d.totpEnabled !== undefined) setTotpEnabled(d.totpEnabled); })
      .catch(() => {});
  }, []);

  function handleChange(name: string, val: string) {
    setChanges(prev => ({ ...prev, [name]: val }));
  }

  async function handleSave() {
    if (Object.keys(changes).length === 0) { setEditing(false); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Update failed."); return; }
      setProfile(prev => prev
        ? { ...prev, ...Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v || null])) } as Profile
        : prev
      );
      setEditing(false); setChanges({}); setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { setError("Network error — please try again."); }
    finally  { setSaving(false); }
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

  const isSaudi    = profile.market.key?.toLowerCase() === "saudi";
  const isBusiness = profile.accountType === "BUSINESS" || !!profile.companyName;
  const isAlreadyBusiness = profile.accountType === "BUSINESS";

  const sectionStyle = { background: "#fff", border: "1px solid #e5e7eb", marginBottom: 16, overflow: "hidden" as const };
  const sectionHead  = { padding: "11px 16px", background: "#f9fafb", borderBottom: "1px solid #f3f4f6" };
  const h2Style      = { margin: 0, fontSize: 13, fontWeight: 600, color: "#111827" };

  return (
    <>
      <style>{`
        @keyframes cy-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .cy-shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%);background-size:800px 100%;animation:cy-shimmer 1.4s ease-in-out infinite;border-radius:4px;}
      `}</style>

      <div className="cy-page-content">
        <div className="cy-dash-wrap" style={{ maxWidth: 720 }}>

          {/* ── Header ── */}
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

          {saved && <div style={{ padding: "10px 14px", background: "#e8f5f0", border: "1px solid #a8d5c9", color: "#0F6E56", fontSize: 13, marginBottom: 16 }}>Profile updated successfully.</div>}
          {error && <div style={{ padding: "10px 14px", background: "#fdf0ef", border: "1px solid #fca5a5", color: "#991b1b", fontSize: 13, marginBottom: 16 }}>{error}</div>}

          {/* ── 1. Account Information ── */}
          <div style={sectionStyle}>
            <div style={sectionHead}><h2 style={h2Style}>Account Information</h2></div>
            <div style={{ padding: "0 16px" }}>
              <ReadRow label="Email"          value={profile.email} />
              <ReadRow label="Customer No."   value={`#${profile.customerNumber}`} />
              <ReadRow label="Market"         value={profile.market.name} />
              <ReadRow label="Currency"       value={profile.market.currency} />
              <ReadRow label="Customer Group" value={profile.customerGroup?.name ?? "—"} />
              <ReadRow label="Country"        value={profile.country} />
              <ReadRow label="Member Since"   value={new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })} />
              {profile.tags.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", padding: "10px 0" }}>
                  <span style={{ width: 180, flexShrink: 0, fontSize: 12.5, color: "#6b7280" }}>Tags</span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                    {profile.tags.map(t => (
                      <span key={t.key} style={{ fontSize: 11.5, background: "#f3f4f6", color: "#374151", padding: "2px 8px", borderRadius: 4 }}>{t.name}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── 2. Personal Information ── */}
          <div style={sectionStyle}>
            <div style={sectionHead}><h2 style={h2Style}>Personal Information</h2></div>
            <div style={{ padding: "0 16px" }}>
              {editing ? (
                <>
                  <EditRow label="Full Name" value={profile.fullName} name="fullName" onChange={handleChange} />
                  <EditRow label="Mobile"    value={profile.mobile}   name="mobile"   onChange={handleChange} placeholder="+966 5x xxx xxxx" />
                  <EditRow label="Timezone"  value={profile.timezone} name="timezone" onChange={handleChange} placeholder="Asia/Riyadh" optional />
                  {!isAlreadyBusiness && (
                    <div style={{ display: "flex", alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid #f3f4f6" }}>
                      <span style={{ width: 180, flexShrink: 0, fontSize: 12.5, color: "#6b7280", paddingTop: 8 }}>Account Type</span>
                      <div style={{ flex: 1 }}>
                        <select defaultValue={profile.accountType ?? "PERSONAL"} onChange={e => handleChange("accountType", e.target.value)}
                          style={{ height: 34, padding: "0 10px", border: "1px solid #d1d5db", fontSize: 13, background: "#fff", width: "100%", boxSizing: "border-box" as const }}>
                          <option value="PERSONAL">Personal</option>
                          <option value="BUSINESS">Business</option>
                        </select>
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>You can upgrade to Business, but cannot revert to Personal.</p>
                      </div>
                    </div>
                  )}
                  {isAlreadyBusiness && <ReadRow label="Account Type" value="Business" />}
                </>
              ) : (
                <>
                  <ReadRow label="Full Name"    value={profile.fullName} />
                  <ReadRow label="Mobile"       value={profile.mobile} />
                  <ReadRow label="Timezone"     value={profile.timezone} />
                  <ReadRow label="Account Type" value={profile.accountType ? (profile.accountType.charAt(0) + profile.accountType.slice(1).toLowerCase()) : null} />
                </>
              )}
            </div>
          </div>

          {/* ── 3. Company Information ── */}
          {isBusiness && (
            <div style={sectionStyle}>
              <div style={sectionHead}><h2 style={h2Style}>Company Information</h2></div>
              <div style={{ padding: "0 16px" }}>
                <ReadRow label="Company Name" value={profile.companyName} />
                <ReadRow label="VAT / Tax ID" value={profile.vatTaxId} />
                {isSaudi && <ReadRow label="CR / Unified ID / Reg Number" value={profile.crn} />}
                {isSaudi && (
                  editing
                    ? <EditRow label="Short Address Code" value={profile.shortAddressCode} name="shortAddressCode" onChange={handleChange} placeholder="e.g. RNAD2323" optional />
                    : <ReadRow label="Short Address Code" value={profile.shortAddressCode} />
                )}
              </div>
            </div>
          )}

          {/* ── 4. Address ── */}
          <div style={sectionStyle}>
            <div style={sectionHead}><h2 style={h2Style}>Address</h2></div>
            <div style={{ padding: "0 16px" }}>
              {editing ? (
                <>
                  {isSaudi ? (
                    <SelectRow label="Province / State" value={profile.province} name="province" onChange={handleChange} optional
                      options={SAUDI_PROVINCES.map(p => ({ value: p, label: p }))} />
                  ) : (
                    <EditRow label="Province / State" value={profile.province} name="province" onChange={handleChange} optional />
                  )}
                  <EditRow label="Address Line 1" value={profile.addressLine1} name="addressLine1" onChange={handleChange} />
                  <EditRow label="Street Name"    value={profile.addressLine2} name="addressLine2" onChange={handleChange} optional />
                  {isSaudi && <EditRow label="Building Number"  value={profile.buildingNumber}  name="buildingNumber"  onChange={handleChange} placeholder="e.g. 1234" optional />}
                  {isSaudi && <EditRow label="Secondary Number" value={profile.secondaryNumber} name="secondaryNumber" onChange={handleChange} placeholder="e.g. 5678" optional />}
                  {isSaudi && <EditRow label="District"         value={profile.district}        name="district"        onChange={handleChange} optional />}
                  <EditRow label="City"              value={profile.city}       name="city"       onChange={handleChange} />
                  <EditRow label="Postal Code / Zip" value={profile.postalCode} name="postalCode" onChange={handleChange} placeholder={isSaudi ? "e.g. 12345" : "e.g. 10001"} />
                </>
              ) : (
                <>
                  <ReadRow label="Province / State" value={profile.province} />
                  <ReadRow label="Address Line 1"   value={profile.addressLine1} />
                  <ReadRow label="Street Name"      value={profile.addressLine2} />
                  {isSaudi && <ReadRow label="Building Number"  value={profile.buildingNumber} />}
                  {isSaudi && <ReadRow label="Secondary Number" value={profile.secondaryNumber} />}
                  {isSaudi && <ReadRow label="District"         value={profile.district} />}
                  <ReadRow label="City"              value={profile.city} />
                  <ReadRow label="Postal Code / Zip" value={profile.postalCode} />
                </>
              )}
            </div>
          </div>

          {/* Public note from admin */}
          {profile.notePublic && (
            <div style={{ marginTop: 16, padding: "12px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 13, color: "#374151" }}>
              <span style={{ fontWeight: 500, marginRight: 8 }}>Note from support:</span>{profile.notePublic}
            </div>
          )}

          {/* ── 5. Security — TOTP ── */}
          <TotpSection totpEnabled={totpEnabled} />

          {/* ── Support Ticket notice ── */}
          <div style={{ marginTop: 8, padding: "16px 20px", background: "#f9fafb", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" as const }}>
            <div>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: "#374151" }}>Need to update locked information?</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, color: "#6b7280" }}>
                Some fields such as your email, company name, and country can only be changed by our support team. Submit a ticket and we'll assist you.
              </p>
            </div>
            <a href="#" style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", height: 34, padding: "0 16px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, fontWeight: 500, color: "#374151", textDecoration: "none", whiteSpace: "nowrap" as const }}>
              Create a Support Ticket
            </a>
          </div>

        </div>
      </div>
    </>
  );
}
