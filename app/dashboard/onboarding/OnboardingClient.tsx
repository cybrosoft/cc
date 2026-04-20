"use client";
// app/dashboard/onboarding/page.tsx
// Full-screen onboarding wizard — shown to new customers before they can use the dashboard.
// No dashboard layout wrapper — this is a standalone page.

import { useState } from "react";
import { useRouter } from "next/navigation";

const P = "#318774";

const SAUDI_PROVINCES = [
  "Riyadh Province", "Makkah al-Mukarramah Province",
  "Al-Madinah Al-Munawwarah Province", "Eastern Province (Ash Sharqiyah)",
  "Aseer Province", "Tabuk Province", "Hail Province",
  "Al-Qassim Province", "Jazan Province", "Najran Province",
  "Al-Bahah Province", "Al-Jawf Province", "Northern Borders Province",
];

type Step = 1 | 2 | 3 | 4;

interface WizardData {
  // Step 1
  fullName: string; mobile: string; accountType: "PERSONAL" | "BUSINESS";
  // Step 2 (business only)
  companyName: string; vatTaxId: string; crn: string; shortAddressCode: string;
  // Step 3
  province: string; addressLine1: string; addressLine2: string;
  buildingNumber: string; secondaryNumber: string; district: string;
  city: string; postalCode: string;
  // Step 4
  tcAccepted: boolean; privacyAccepted: boolean;
}

const EMPTY: WizardData = {
  fullName: "", mobile: "", accountType: "PERSONAL",
  companyName: "", vatTaxId: "", crn: "", shortAddressCode: "",
  province: "", addressLine1: "", addressLine2: "",
  buildingNumber: "", secondaryNumber: "", district: "", city: "", postalCode: "",
  tcAccepted: false, privacyAccepted: false,
};

// ── Style helpers ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", fontSize: 13.5, color: "#111827",
  border: "1px solid #d1d5db", outline: "none", fontFamily: "inherit",
  boxSizing: "border-box",
};
const selectStyle: React.CSSProperties = {
  ...inputStyle, background: "#fff", appearance: "none" as const,
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12.5, fontWeight: 500, color: "#374151", marginBottom: 5,
};
const optStyle: React.CSSProperties = {
  fontSize: 11.5, color: "#6b7280", marginTop: 3,
};

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={labelStyle}>
        {label}
        {optional && <span style={{ color: "#9ca3af", fontWeight: 400, marginLeft: 4 }}>(optional)</span>}
      </label>
      {children}
    </div>
  );
}

function StepIndicator({ current, total, isBusiness }: { current: Step; total: number; isBusiness: boolean }) {
  const steps = [
    { n: 1, label: "Personal" },
    ...(isBusiness ? [{ n: 2, label: "Company" }] : []),
    { n: isBusiness ? 3 : 2, label: "Address" },
    { n: isBusiness ? 4 : 3, label: "Terms" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
      {steps.map((s, i) => {
        const done    = s.n < current;
        const active  = s.n === current;
        const last    = i === steps.length - 1;
        return (
          <div key={s.n} style={{ display: "flex", alignItems: "center", flex: last ? "none" : 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                background: done ? P : active ? P : "#e5e7eb",
                color: done || active ? "#fff" : "#9ca3af",
                flexShrink: 0,
              }}>
                {done ? "✓" : s.n}
              </div>
              <span style={{ fontSize: 11, color: active ? P : done ? "#6b7280" : "#9ca3af", whiteSpace: "nowrap", fontWeight: active ? 600 : 400 }}>
                {s.label}
              </span>
            </div>
            {!last && (
              <div style={{ flex: 1, height: 2, background: done ? P : "#e5e7eb", margin: "0 6px", marginBottom: 18 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OnboardingPage({
  isSaudi = false,
}: {
  isSaudi?: boolean;
}) {
  const router   = useRouter();
  const [step,   setStep]   = useState<Step>(1);
  const [data,   setData]   = useState<WizardData>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState<string | null>(null);

  const isBusiness  = data.accountType === "BUSINESS";
  const totalSteps  = isBusiness ? 4 : 3;

  // Map logical step to actual step number accounting for business step
  function getActualStep(logical: Step): Step {
    if (!isBusiness && logical >= 3) return (logical - 1) as Step;
    return logical;
  }

  function set(field: keyof WizardData, value: string | boolean) {
    setData(prev => ({ ...prev, [field]: value }));
    setError(null);
  }

  function validateStep(): string | null {
    if (step === 1) {
      if (!data.fullName.trim())  return "Full name is required.";
      if (!data.mobile.trim())    return "Mobile number is required.";
    }
    if (step === 2 && isBusiness) {
      if (!data.companyName.trim()) return "Company name is required.";
    }
    if ((step === 3 && isBusiness) || (step === 2 && !isBusiness)) {
      if (!data.addressLine1.trim()) return "Address line 1 is required.";
      if (!data.city.trim())         return "City is required.";
    }
    if ((step === 4 && isBusiness) || (step === 3 && !isBusiness)) {
      if (!data.tcAccepted)      return "Please accept the Terms of Service.";
      if (!data.privacyAccepted) return "Please accept the Privacy Policy.";
    }
    return null;
  }

  function next() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setError(null);
    // Skip step 2 if personal
    if (step === 1 && !isBusiness) { setStep(3); return; }
    setStep(prev => Math.min(prev + 1, 4) as Step);
  }

  function back() {
    setError(null);
    if (step === 3 && !isBusiness) { setStep(1); return; }
    setStep(prev => Math.max(prev - 1, 1) as Step);
  }

  async function submit() {
    const err = validateStep();
    if (err) { setError(err); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/customer/onboarding", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await res.json();
      if (!res.ok) { setError(d.error ?? "Failed to save. Please try again."); return; }
      router.push("/dashboard");
    } catch { setError("Network error. Please try again."); }
    finally   { setSaving(false); }
  }

  const isLastStep = (isBusiness && step === 4) || (!isBusiness && step === 3);

  // ── Render steps ────────────────────────────────────────────────────────────
  function renderStep() {
    // Step 1 — Personal
    if (step === 1) return (
      <>
        <Field label="Full Name">
          <input style={inputStyle} value={data.fullName} onChange={e => set("fullName", e.target.value)}
            placeholder="Your full name" autoFocus
            onFocus={e => (e.target.style.borderColor = P)} onBlur={e => (e.target.style.borderColor = "#d1d5db")} />
        </Field>
        <Field label="Mobile Number">
          <input style={inputStyle} value={data.mobile} onChange={e => set("mobile", e.target.value)}
            placeholder="+966 5x xxx xxxx"
            onFocus={e => (e.target.style.borderColor = P)} onBlur={e => (e.target.style.borderColor = "#d1d5db")} />
        </Field>
        <Field label="Account Type">
          <div style={{ display: "flex", gap: 10 }}>
            {(["PERSONAL", "BUSINESS"] as const).map(t => (
              <button key={t} type="button" onClick={() => set("accountType", t)} style={{
                flex: 1, padding: "10px 12px", fontSize: 13, fontWeight: 500, cursor: "pointer",
                border: `2px solid ${data.accountType === t ? P : "#d1d5db"}`,
                background: data.accountType === t ? "#eaf4f2" : "#fff",
                color: data.accountType === t ? P : "#374151",
                fontFamily: "inherit",
              }}>
                {t === "PERSONAL" ? "👤 Personal" : "🏢 Business"}
              </button>
            ))}
          </div>
          <p style={optStyle}>
            {data.accountType === "BUSINESS"
              ? "You'll be asked for company details in the next step."
              : "Select Business if signing up on behalf of a company."}
          </p>
        </Field>
      </>
    );

    // Step 2 — Company (business only)
    if (step === 2 && isBusiness) return (
      <>
        <Field label="Company Name">
          <input style={inputStyle} value={data.companyName} onChange={e => set("companyName", e.target.value)}
            placeholder="Your company name" autoFocus
            onFocus={e => (e.target.style.borderColor = P)} onBlur={e => (e.target.style.borderColor = "#d1d5db")} />
        </Field>
        <Field label="VAT / Tax ID" optional>
          <input style={inputStyle} value={data.vatTaxId} onChange={e => set("vatTaxId", e.target.value)}
            placeholder={isSaudi ? "e.g. 300000000000003" : "e.g. VAT-123456"}
            onFocus={e => (e.target.style.borderColor = P)} onBlur={e => (e.target.style.borderColor = "#d1d5db")} />
        </Field>
        {isSaudi && (
          <Field label="CR / Unified National ID / Register Number" optional>
            <input style={inputStyle} value={data.crn} onChange={e => set("crn", e.target.value)}
              placeholder="e.g. 1010000000"
              onFocus={e => (e.target.style.borderColor = P)} onBlur={e => (e.target.style.borderColor = "#d1d5db")} />
          </Field>
        )}
        {isSaudi && (
          <Field label="Short Address Code" optional>
            <input style={inputStyle} value={data.shortAddressCode} onChange={e => set("shortAddressCode", e.target.value)}
              placeholder="e.g. RNAD2323"
              onFocus={e => (e.target.style.borderColor = P)} onBlur={e => (e.target.style.borderColor = "#d1d5db")} />
          </Field>
        )}
      </>
    );

    // Step 3 — Address
    if (step === 3 || (step === 2 && !isBusiness)) return (
      <>
        <Field label="Province / State" optional>
          {isSaudi ? (
            <div style={{ position: "relative" }}>
              <select style={selectStyle} value={data.province} onChange={e => set("province", e.target.value)}>
                <option value="">— Select province —</option>
                {SAUDI_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                <path d="M2 3.5L5 6.5L8 3.5" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          ) : (
            <input style={inputStyle} value={data.province} onChange={e => set("province", e.target.value)}
              placeholder="State or province"
              onFocus={e => (e.target.style.borderColor = P)} onBlur={e => (e.target.style.borderColor = "#d1d5db")} />
          )}
        </Field>
        <Field label="Address Line 1">
          <input style={inputStyle} value={data.addressLine1} onChange={e => set("addressLine1", e.target.value)}
            placeholder="Street address" autoFocus
            onFocus={e => (e.target.style.borderColor = P)} onBlur={e => (e.target.style.borderColor = "#d1d5db")} />
        </Field>
        <Field label="Street Name" optional>
          <input style={inputStyle} value={data.addressLine2} onChange={e => set("addressLine2", e.target.value)}
            placeholder="Street name"
            onFocus={e => (e.target.style.borderColor = P)} onBlur={e => (e.target.style.borderColor = "#d1d5db")} />
        </Field>
        {isSaudi && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Building Number" optional>
              <input style={inputStyle} value={data.buildingNumber} onChange={e => set("buildingNumber", e.target.value)}
                placeholder="e.g. 1234"
                onFocus={e => (e.target.style.borderColor = P)} onBlur={e => (e.target.style.borderColor = "#d1d5db")} />
            </Field>
            <Field label="Secondary Number" optional>
              <input style={inputStyle} value={data.secondaryNumber} onChange={e => set("secondaryNumber", e.target.value)}
                placeholder="e.g. 5678"
                onFocus={e => (e.target.style.borderColor = P)} onBlur={e => (e.target.style.borderColor = "#d1d5db")} />
            </Field>
          </div>
        )}
        {isSaudi && (
          <Field label="District" optional>
            <input style={inputStyle} value={data.district} onChange={e => set("district", e.target.value)}
              placeholder="District name"
              onFocus={e => (e.target.style.borderColor = P)} onBlur={e => (e.target.style.borderColor = "#d1d5db")} />
          </Field>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="City">
            <input style={inputStyle} value={data.city} onChange={e => set("city", e.target.value)}
              placeholder="City"
              onFocus={e => (e.target.style.borderColor = P)} onBlur={e => (e.target.style.borderColor = "#d1d5db")} />
          </Field>
          <Field label="Postal Code / ZIP" optional>
            <input style={inputStyle} value={data.postalCode} onChange={e => set("postalCode", e.target.value)}
              placeholder={isSaudi ? "e.g. 12345" : "e.g. 10001"}
              onFocus={e => (e.target.style.borderColor = P)} onBlur={e => (e.target.style.borderColor = "#d1d5db")} />
          </Field>
        </div>
      </>
    );

    // Step 4 — T&C
    if (step === 4 || (step === 3 && !isBusiness)) return (
      <>
        <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.7, marginBottom: 20 }}>
          Before you continue, please read and accept the following agreements.
        </p>

        {/* Terms box */}
        <div style={{ border: "1px solid #e5e7eb", marginBottom: 16, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Terms of Service</span>
          </div>
          <div style={{ height: 120, overflowY: "auto", padding: "12px 14px", fontSize: 12, color: "#6b7280", lineHeight: 1.7 }}>
            By using Cybrosoft Console, you agree to our terms of service. You are responsible for all activity that
            occurs under your account. You must not use the services for any unlawful purpose. Cybrosoft reserves the
            right to modify, suspend, or terminate your account at any time. Service availability is subject to our SLA.
            Payment terms apply as agreed at time of subscription. All prices are exclusive of applicable taxes.
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid #f3f4f6" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "#374151", fontWeight: 500 }}>
              <input type="checkbox" checked={data.tcAccepted} onChange={e => set("tcAccepted", e.target.checked)}
                style={{ width: 16, height: 16, accentColor: P, cursor: "pointer" }} />
              I have read and accept the Terms of Service
            </label>
          </div>
        </div>

        {/* Privacy box */}
        <div style={{ border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Privacy Policy</span>
          </div>
          <div style={{ height: 120, overflowY: "auto", padding: "12px 14px", fontSize: 12, color: "#6b7280", lineHeight: 1.7 }}>
            Cybrosoft collects and processes personal data in accordance with applicable data protection laws.
            We collect information you provide when creating an account, information about your use of our services,
            and technical data. We use this data to provide services, improve your experience, and for billing purposes.
            We do not sell your personal data to third parties. You may request deletion of your data at any time.
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid #f3f4f6" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13, color: "#374151", fontWeight: 500 }}>
              <input type="checkbox" checked={data.privacyAccepted} onChange={e => set("privacyAccepted", e.target.checked)}
                style={{ width: 16, height: 16, accentColor: P, cursor: "pointer" }} />
              I have read and accept the Privacy Policy
            </label>
          </div>
        </div>
      </>
    );
  }

  const displayStep = getActualStep(step);

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
      <div style={{
        minHeight: "100vh", background: "#f9fafb",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "flex-start", padding: "40px 16px 60px",
        fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>

        {/* Logo */}
        <div style={{ marginBottom: 32, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, background: P, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8L6 4L10 8L14 4" stroke="white" strokeWidth="2" strokeLinecap="square"/>
              <path d="M2 12L6 8L10 12L14 8" stroke="white" strokeWidth="2" strokeLinecap="square" opacity="0.5"/>
            </svg>
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Cybrosoft</span>
          <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 2 }}>Console</span>
        </div>

        {/* Card */}
        <div style={{
          width: "100%", maxWidth: 540,
          background: "#fff", border: "1px solid #e5e7eb",
          padding: "32px 36px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          {/* Header */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
              Complete your profile
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
              Step {displayStep} of {totalSteps} — Let's set up your account before you get started.
            </p>
          </div>

          {/* Step indicator */}
          <StepIndicator current={step} total={totalSteps} isBusiness={isBusiness} />

          {/* Error */}
          {error && (
            <div style={{ marginBottom: 16, padding: "9px 12px", background: "#fee2e2", border: "1px solid #fca5a5", fontSize: 13, color: "#991b1b" }}>
              {error}
            </div>
          )}

          {/* Step content */}
          {renderStep()}

          {/* Navigation buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            {step > 1 && (
              <button onClick={back} style={{
                flex: 1, height: 40, background: "#fff", border: "1px solid #e5e7eb",
                fontSize: 13, fontWeight: 500, color: "#374151", cursor: "pointer", fontFamily: "inherit",
              }}>
                ← Back
              </button>
            )}
            <button
              onClick={isLastStep ? submit : next}
              disabled={saving}
              style={{
                flex: 1, height: 40, background: saving ? "#86c4ba" : P, border: "none",
                fontSize: 13, fontWeight: 600, color: "#fff",
                cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
              }}
            >
              {saving ? "Saving…" : isLastStep ? "Complete Setup →" : "Continue →"}
            </button>
          </div>
        </div>

        {/* Pending notice */}
        <div style={{ marginTop: 20, maxWidth: 540, width: "100%", padding: "12px 16px", background: "#fff8e6", border: "1px solid #fde68a", fontSize: 12.5, color: "#92400e", lineHeight: 1.6 }}>
          <strong>Account pending review</strong> — After completing your profile, your account will be reviewed by our team.
          You'll receive an email once approved. You can still explore the portal in the meantime.
        </div>

      </div>
    </>
  );
}
