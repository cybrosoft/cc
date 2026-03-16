// app/admin/system/settings/tabs/CompanyProfilesTab.tsx
"use client";
import React, { useEffect, useState } from "react";
import { CLR } from "@/components/ui/admin-ui";
import { inp, card, sectionTitle, Field, Row, SaveBar, TabHeader } from "./settings-ui";

interface LegalInfo {
  companyName?:         string;
  companyNameAr?:       string;
  registrationLabel?:   string;   // "CR No." / "EIN" / "Company No." etc.
  registrationNumber?:  string;
  taxLabel?:            string;   // "VAT No." / "Tax ID" / "GST No." etc.
  taxNumber?:           string;
  address1?:            string;
  address1Ar?:          string;
  address2?:            string;
  district?:            string;
  districtAr?:          string;
  city?:                string;
  cityAr?:              string;
  state?:               string;   // US state, UK county, Indian state etc.
  postalCode?:          string;
  country?:             string;
  countryAr?:           string;
  countryCode?:         string;   // ISO 3166-1 alpha-2 e.g. SA, US, GB, AE
  phone?:               string;
  fax?:                 string;
  email?:               string;
  website?:             string;
  bankDetails?: {
    bankName?:        string;
    bankNameAr?:      string;
    accountName?:     string;
    accountNameAr?:   string;
    accountNumber?:   string;
    iban?:            string;
    swift?:           string;
    currency?:        string;
    branch?:          string;
    branchAr?:        string;
    routingNumber?:   string;   // US ACH routing
    sortCode?:        string;   // UK sort code
  };
}

interface CompanyProfile {
  logoUrl?:      string;
  primaryColor?: string;
}

interface Market {
  id: string; key: string; name: string; defaultCurrency: string;
  vatPercent: string | number | null;
  legalInfo:      LegalInfo | null;
  companyProfile: CompanyProfile | null;
  paymentMethods: string[];
}

const PAYMENT_OPTIONS = ["BANK_TRANSFER", "STRIPE", "CASH", "OTHER"];

// Per-market default labels so the form pre-fills sensibly
const MARKET_DEFAULTS: Record<string, Partial<LegalInfo>> = {
  SA: { registrationLabel: "CR No.",  taxLabel: "VAT No.",  countryCode: "SA", country: "Saudi Arabia", countryAr: "المملكة العربية السعودية" },
  GL: { registrationLabel: "EIN",     taxLabel: "Tax ID",   countryCode: "US", country: "United States" },
  AE: { registrationLabel: "TRN",     taxLabel: "TRN",      countryCode: "AE", country: "United Arab Emirates" },
  GB: { registrationLabel: "Co. No.", taxLabel: "VAT No.",  countryCode: "GB", country: "United Kingdom" },
};

function getDefaults(marketKey: string): Partial<LegalInfo> {
  return MARKET_DEFAULTS[marketKey] ?? {};
}

export default function CompanyProfilesTab() {
  const [markets, setMarkets]   = useState<Market[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [draft, setDraft]       = useState<Market | null>(null);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/admin/settings/markets")
      .then(r => r.json())
      .then(d => {
        if (d.ok && d.markets.length > 0) {
          setMarkets(d.markets);
          setActiveId(d.markets[0].id);
          setDraft(normMarket(d.markets[0]));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function normMarket(m: Market): Market {
    const defaults = getDefaults(m.key);
    return {
      ...m,
      vatPercent:     m.vatPercent ?? 0,
      legalInfo:      { ...defaults, ...(m.legalInfo ?? {}), bankDetails: (m.legalInfo as any)?.bankDetails ?? {} },
      companyProfile: m.companyProfile ?? {},
      paymentMethods: m.paymentMethods ?? [],
    };
  }

  function selectMarket(id: string) {
    const m = markets.find(m => m.id === id);
    if (m) { setActiveId(id); setDraft(normMarket(m)); setSaved(false); setError(""); }
  }

  const li  = (k: keyof LegalInfo) => (draft?.legalInfo as any)?.[k] ?? "";
  const bd  = (k: string) => (draft?.legalInfo as any)?.bankDetails?.[k] ?? "";
  const cp  = (k: keyof CompanyProfile) => (draft?.companyProfile as any)?.[k] ?? "";

  function setLI(k: keyof LegalInfo, v: string) {
    setDraft(d => d ? { ...d, legalInfo: { ...d.legalInfo, [k]: v } } : d);
  }
  function setBD(k: string, v: string) {
    setDraft(d => d ? { ...d, legalInfo: { ...d.legalInfo, bankDetails: { ...(d.legalInfo as any)?.bankDetails, [k]: v } } } : d);
  }
  function setCP(k: keyof CompanyProfile, v: string) {
    setDraft(d => d ? { ...d, companyProfile: { ...d.companyProfile, [k]: v } } : d);
  }
  function togglePayment(method: string) {
    setDraft(d => {
      if (!d) return d;
      const has = d.paymentMethods.includes(method);
      return { ...d, paymentMethods: has ? d.paymentMethods.filter(m => m !== method) : [...d.paymentMethods, method] };
    });
  }

  async function save() {
    if (!draft) return;
    setSaving(true); setError(""); setSaved(false);
    try {
      const res = await fetch(`/api/admin/settings/markets/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vatPercent:     draft.vatPercent,
          legalInfo:      draft.legalInfo,
          companyProfile: draft.companyProfile,
          paymentMethods: draft.paymentMethods,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMarkets(prev => prev.map(m => m.id === draft.id ? { ...m, ...data.market } : m));
      setSaved(true);
    } catch (e: any) { setError(e.message); }
    setSaving(false);
  }

  if (loading) return <div style={{ padding: 40, color: CLR.faint, fontSize: 13 }}>Loading…</div>;
  if (!draft)  return <div style={{ padding: 40, color: CLR.faint, fontSize: 13 }}>No markets found.</div>;

  const isArabic = ["SA", "AE"].includes(draft.key);

  return (
    <div>
      <TabHeader
        title="Company Profiles"
        description="Legal information, address, bank details and payment settings per market. All fields are stored in the database and used on generated documents."
      />

      {/* Market selector tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, border: "1px solid #e5e7eb", background: "#fff", flexWrap: "wrap" }}>
        {markets.map(m => (
          <button key={m.id} onClick={() => selectMarket(m.id)} style={{
            padding: "10px 20px", fontSize: 13,
            fontWeight: activeId === m.id ? 700 : 400,
            background: activeId === m.id ? CLR.primaryBg : "none",
            color: activeId === m.id ? CLR.primary : CLR.muted,
            borderRight: "1px solid #e5e7eb",
            border: "none",
            borderBottom: activeId === m.id ? `2px solid ${CLR.primary}` : "2px solid transparent",
            cursor: "pointer", fontFamily: "inherit",
          }}>
            {m.name}
            <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 6 }}>({m.defaultCurrency})</span>
          </button>
        ))}
      </div>

      {/* ── Company Identity ──────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>🏢 Company Identity</p>
        <Row>
          <Field label="Company Name (English)" half>
            <input style={inp} value={li("companyName")} onChange={e => setLI("companyName", e.target.value)} placeholder="Cybrosoft Technology LLC" />
          </Field>
          {isArabic && (
            <Field label="Company Name (Arabic)" half>
              <input style={{ ...inp, direction: "rtl" }} dir="rtl" value={li("companyNameAr")} onChange={e => setLI("companyNameAr", e.target.value)} placeholder="سايبروسوفت تكنولوجي" />
            </Field>
          )}
        </Row>
        <Row>
          <Field label="Registration Label" half hint={`e.g. "CR No." for KSA, "EIN" for USA, "Co. No." for UK`}>
            <input style={inp} value={li("registrationLabel")} onChange={e => setLI("registrationLabel", e.target.value)} placeholder="CR No." />
          </Field>
          <Field label="Registration Number" half>
            <input style={inp} value={li("registrationNumber")} onChange={e => setLI("registrationNumber", e.target.value)} placeholder="1234567890" />
          </Field>
        </Row>
        <Row>
          <Field label="Tax Label" half hint={`e.g. "VAT No." for KSA/EU, "Tax ID" for USA, "GST No." for India`}>
            <input style={inp} value={li("taxLabel")} onChange={e => setLI("taxLabel", e.target.value)} placeholder="VAT No." />
          </Field>
          <Field label="Tax / VAT Number" half>
            <input style={inp} value={li("taxNumber")} onChange={e => setLI("taxNumber", e.target.value)} placeholder="300000000000003" />
          </Field>
        </Row>
      </div>

      {/* ── Address ───────────────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>📍 Address</p>
        <Row>
          <Field label="Address Line 1" half>
            <input style={inp} value={li("address1")} onChange={e => setLI("address1", e.target.value)} placeholder="123 Business District" />
          </Field>
          {isArabic && (
            <Field label="Address Line 1 (Arabic)" half>
              <input style={{ ...inp, direction: "rtl" }} dir="rtl" value={li("address1Ar")} onChange={e => setLI("address1Ar", e.target.value)} placeholder="١٢٣ حي الأعمال" />
            </Field>
          )}
        </Row>
        <Field label="Address Line 2 (optional)" hint="Suite, floor, building name etc.">
          <input style={inp} value={li("address2")} onChange={e => setLI("address2", e.target.value)} placeholder="Suite 500 / Floor 3" />
        </Field>
        <Row>
          <Field label="District / Neighbourhood" half>
            <input style={inp} value={li("district")} onChange={e => setLI("district", e.target.value)} placeholder="Al Olaya" />
          </Field>
          {isArabic && (
            <Field label="District (Arabic)" half>
              <input style={{ ...inp, direction: "rtl" }} dir="rtl" value={li("districtAr")} onChange={e => setLI("districtAr", e.target.value)} placeholder="العليا" />
            </Field>
          )}
        </Row>
        <Row>
          <Field label="City" half>
            <input style={inp} value={li("city")} onChange={e => setLI("city", e.target.value)} placeholder="Riyadh / Delaware / London" />
          </Field>
          {isArabic && (
            <Field label="City (Arabic)" half>
              <input style={{ ...inp, direction: "rtl" }} dir="rtl" value={li("cityAr")} onChange={e => setLI("cityAr", e.target.value)} placeholder="الرياض" />
            </Field>
          )}
        </Row>
        <Row>
          <Field label="State / Province / Region" half hint="US state, UK county, Indian state, KSA region etc.">
            <input style={inp} value={li("state")} onChange={e => setLI("state", e.target.value)} placeholder="Riyadh Region / Delaware / Greater London" />
          </Field>
          <Field label="Postal / ZIP Code" half>
            <input style={inp} value={li("postalCode")} onChange={e => setLI("postalCode", e.target.value)} placeholder="12345" />
          </Field>
        </Row>
        <Row>
          <Field label="Country" half>
            <input style={inp} value={li("country")} onChange={e => setLI("country", e.target.value)} placeholder="Saudi Arabia / United States" />
          </Field>
          {isArabic && (
            <Field label="Country (Arabic)" half>
              <input style={{ ...inp, direction: "rtl" }} dir="rtl" value={li("countryAr")} onChange={e => setLI("countryAr", e.target.value)} placeholder="المملكة العربية السعودية" />
            </Field>
          )}
        </Row>
        <Row>
          <Field label="Country Code" half hint="ISO 3166-1 alpha-2 e.g. SA, US, GB, AE, IN">
            <input style={{ ...inp, fontFamily: "monospace", textTransform: "uppercase" as const }}
              value={li("countryCode")} onChange={e => setLI("countryCode", e.target.value.toUpperCase())}
              placeholder="SA" maxLength={2} />
          </Field>
        </Row>
      </div>

      {/* ── Contact ───────────────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>📞 Contact Information</p>
        <Row>
          <Field label="Phone" half>
            <input style={inp} value={li("phone")} onChange={e => setLI("phone", e.target.value)} placeholder="+966 11 000 0000" />
          </Field>
          <Field label="Fax (optional)" half>
            <input style={inp} value={li("fax")} onChange={e => setLI("fax", e.target.value)} placeholder="+966 11 000 0001" />
          </Field>
        </Row>
        <Row>
          <Field label="Email" half>
            <input style={inp} type="email" value={li("email")} onChange={e => setLI("email", e.target.value)} placeholder="accounts@company.com" />
          </Field>
          <Field label="Website" half>
            <input style={inp} value={li("website")} onChange={e => setLI("website", e.target.value)} placeholder="https://www.company.com" />
          </Field>
        </Row>
      </div>

      {/* ── VAT / Tax Rate ────────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>💰 Tax Rate</p>
        <Row>
          <Field label="Tax / VAT Percentage (%)" half
            hint={draft.key === "SA" ? "Saudi Arabia: 15% standard rate" : draft.key === "AE" ? "UAE: 5% VAT" : "Set to 0 for tax-exempt markets"}>
            <input type="number" min={0} max={100} step={0.01} style={inp}
              value={String(draft.vatPercent ?? "")}
              onChange={e => setDraft(d => d ? { ...d, vatPercent: e.target.value } : d)} />
          </Field>
          <Field label="Tax Label on Documents" half hint="Shown next to the tax line on invoices">
            <input style={inp} value={li("taxLabel")} onChange={e => setLI("taxLabel", e.target.value)} placeholder="VAT / GST / Tax" />
          </Field>
        </Row>
      </div>

      {/* ── Bank Details ──────────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>🏦 Bank Details</p>
        <p style={{ fontSize: 12, color: CLR.muted, marginBottom: 14 }}>
          Printed on invoices and quotations for bank transfer payments. Fill only what applies to this market.
        </p>
        <Row>
          <Field label="Bank Name" half>
            <input style={inp} value={bd("bankName")} onChange={e => setBD("bankName", e.target.value)} placeholder="Al Rajhi Bank / Chase / Barclays" />
          </Field>
          {isArabic && (
            <Field label="Bank Name (Arabic)" half>
              <input style={{ ...inp, direction: "rtl" }} dir="rtl" value={bd("bankNameAr")} onChange={e => setBD("bankNameAr", e.target.value)} placeholder="مصرف الراجحي" />
            </Field>
          )}
        </Row>
        <Row>
          <Field label="Account Name" half>
            <input style={inp} value={bd("accountName")} onChange={e => setBD("accountName", e.target.value)} placeholder="Cybrosoft Technology LLC" />
          </Field>
          {isArabic && (
            <Field label="Account Name (Arabic)" half>
              <input style={{ ...inp, direction: "rtl" }} dir="rtl" value={bd("accountNameAr")} onChange={e => setBD("accountNameAr", e.target.value)} placeholder="سايبروسوفت تكنولوجي" />
            </Field>
          )}
        </Row>
        <Row>
          <Field label="Account Number" half>
            <input style={{ ...inp, fontFamily: "monospace" }} value={bd("accountNumber")} onChange={e => setBD("accountNumber", e.target.value)} placeholder="1234567890" />
          </Field>
          <Field label="IBAN" half>
            <input style={{ ...inp, fontFamily: "monospace", textTransform: "uppercase" as const }} value={bd("iban")} onChange={e => setBD("iban", e.target.value.toUpperCase())} placeholder="SA00 0000 0000 0000 0000 0000" />
          </Field>
        </Row>
        <Row>
          <Field label="SWIFT / BIC" half>
            <input style={{ ...inp, fontFamily: "monospace", textTransform: "uppercase" as const }} value={bd("swift")} onChange={e => setBD("swift", e.target.value.toUpperCase())} placeholder="RJHISARIXXX" />
          </Field>
          <Field label="Currency" half>
            <input style={{ ...inp, fontFamily: "monospace", textTransform: "uppercase" as const }} value={bd("currency") || draft.defaultCurrency} onChange={e => setBD("currency", e.target.value.toUpperCase())} placeholder="SAR / USD / GBP" />
          </Field>
        </Row>
        <Row>
          <Field label="Branch" half>
            <input style={inp} value={bd("branch")} onChange={e => setBD("branch", e.target.value)} placeholder="Riyadh Main Branch" />
          </Field>
          {isArabic && (
            <Field label="Branch (Arabic)" half>
              <input style={{ ...inp, direction: "rtl" }} dir="rtl" value={bd("branchAr")} onChange={e => setBD("branchAr", e.target.value)} placeholder="فرع الرياض الرئيسي" />
            </Field>
          )}
        </Row>
        {/* US / UK specific */}
        {!isArabic && (
          <Row>
            <Field label="Routing Number (US ACH)" half hint="9-digit ABA routing number for US bank transfers">
              <input style={{ ...inp, fontFamily: "monospace" }} value={bd("routingNumber")} onChange={e => setBD("routingNumber", e.target.value)} placeholder="021000021" />
            </Field>
            <Field label="Sort Code (UK)" half hint="6-digit sort code for UK bank transfers">
              <input style={{ ...inp, fontFamily: "monospace" }} value={bd("sortCode")} onChange={e => setBD("sortCode", e.target.value)} placeholder="20-00-00" />
            </Field>
          </Row>
        )}
      </div>

      {/* ── Payment Methods ───────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>💳 Accepted Payment Methods</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {PAYMENT_OPTIONS.map(method => {
            const isActive = draft.paymentMethods.includes(method);
            return (
              <label key={method} style={{
                display: "flex", alignItems: "center", gap: 8, cursor: "pointer",
                padding: "8px 16px",
                border: `1px solid ${isActive ? CLR.primary : "#d1d5db"}`,
                background: isActive ? CLR.primaryBg : "#fff",
                fontSize: 13,
              }}>
                <input type="checkbox" checked={isActive} onChange={() => togglePayment(method)}
                  style={{ accentColor: CLR.primary }} />
                {method.replace(/_/g, " ")}
              </label>
            );
          })}
        </div>
        {draft.defaultCurrency === "USD" && (
          <p style={{ fontSize: 11, color: CLR.faint, marginTop: 8 }}>
            Stripe requires API keys configured in environment variables.
          </p>
        )}
      </div>

      {/* ── Branding ──────────────────────────────────────────────────────── */}
      <div style={card}>
        <p style={sectionTitle}>🖼️ Document Branding</p>
        <Row>
          <Field label="Logo URL" half hint="Used on document headers. Recommended: 300×80px PNG with transparent background.">
            <input style={inp} value={cp("logoUrl")} onChange={e => setCP("logoUrl", e.target.value)} placeholder="https://cdn.yourcompany.com/logo.png" />
          </Field>
          <Field label="Primary Color" half hint="Hex color for document headings. Default: #318774">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input style={{ ...inp, flex: 1, fontFamily: "monospace" }}
                value={cp("primaryColor") || "#318774"}
                onChange={e => setCP("primaryColor", e.target.value)}
                placeholder="#318774" />
              <input type="color"
                value={cp("primaryColor") || "#318774"}
                onChange={e => setCP("primaryColor", e.target.value)}
                style={{ width: 36, height: 36, border: "1px solid #d1d5db", cursor: "pointer", padding: 2 }} />
            </div>
          </Field>
        </Row>
        {cp("logoUrl") && (
          <div>
            <p style={{ fontSize: 11, color: CLR.faint, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: "0.04em", fontWeight: 600 }}>Logo Preview</p>
            <div style={{ padding: "12px 16px", background: "#222222", display: "inline-block" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cp("logoUrl")} alt="Logo preview" style={{ maxHeight: 40, maxWidth: 220 }} />
            </div>
          </div>
        )}
      </div>

      <SaveBar saving={saving} saved={saved} error={error} onSave={save} />
    </div>
  );
}
