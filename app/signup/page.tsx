"use client";
// app/signup/page.tsx

import React, { useState } from "react";
import { usePathname } from "next/navigation";

function normalizeEmail(e: string) { return e.trim().toLowerCase(); }
function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null; }
function readString(o: Record<string, unknown>, k: string): string | null { const v = o[k]; return typeof v === "string" ? v : null; }
function readBoolean(o: Record<string, unknown>, k: string): boolean | null { const v = o[k]; return typeof v === "boolean" ? v : null; }

const P = "#318774";

// ── Country list with ISO codes for flag images ───────────────────────────────
type CountryOption = { label: string; iso: string; route: "sa" | "global"; dividerAfter?: boolean };

const COUNTRIES: CountryOption[] = [
  // Priority top 7
  { label: "Saudi Arabia",   iso: "SA", route: "sa"     },
  { label: "UAE",            iso: "AE", route: "global" },
  { label: "Kuwait",         iso: "KW", route: "global" },
  { label: "Bahrain",        iso: "BH", route: "global" },
  { label: "Qatar",          iso: "QA", route: "global" },
  { label: "Oman",           iso: "OM", route: "global" },
  { label: "United States",  iso: "US", route: "global", dividerAfter: true },
  // Alphabetical
  { label: "Australia",      iso: "AU", route: "global" },
  { label: "Belgium",        iso: "BE", route: "global" },
  { label: "Brazil",         iso: "BR", route: "global" },
  { label: "Canada",         iso: "CA", route: "global" },
  { label: "Denmark",        iso: "DK", route: "global" },
  { label: "Egypt",          iso: "EG", route: "global" },
  { label: "Finland",        iso: "FI", route: "global" },
  { label: "France",         iso: "FR", route: "global" },
  { label: "Germany",        iso: "DE", route: "global" },
  { label: "India",          iso: "IN", route: "global" },
  { label: "Indonesia",      iso: "ID", route: "global" },
  { label: "Italy",          iso: "IT", route: "global" },
  { label: "Japan",          iso: "JP", route: "global" },
  { label: "Kenya",          iso: "KE", route: "global" },
  { label: "Malaysia",       iso: "MY", route: "global" },
  { label: "Mexico",         iso: "MX", route: "global" },
  { label: "Netherlands",    iso: "NL", route: "global" },
  { label: "New Zealand",    iso: "NZ", route: "global" },
  { label: "Nigeria",        iso: "NG", route: "global" },
  { label: "Norway",         iso: "NO", route: "global" },
  { label: "Singapore",      iso: "SG", route: "global" },
  { label: "South Africa",   iso: "ZA", route: "global" },
  { label: "South Korea",    iso: "KR", route: "global" },
  { label: "Spain",          iso: "ES", route: "global" },
  { label: "Sweden",         iso: "SE", route: "global" },
  { label: "Switzerland",    iso: "CH", route: "global" },
  { label: "United Kingdom", iso: "GB", route: "global" },
  // Last — no ISO, uses globe icon
  { label: "Other Countries", iso: "", route: "global" },
];

// ── Flag image — flagcdn.com, falls back to ISO text badge if image fails ────
function FlagImg({ iso }: { iso: string }) {
  const [failed, setFailed] = useState(false);
  if (!iso) return null;

  if (failed) {
    return (
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 20, height: 14, background: "#e5e7eb", borderRadius: 2,
        fontSize: 8, fontWeight: 700, color: "#6b7280", letterSpacing: "0.02em",
        flexShrink: 0,
      }}>
        {iso}
      </span>
    );
  }

  return (
    <img
      src={`https://flagcdn.com/w40/${iso.toLowerCase()}.png`}
      width={20}
      height={14}
      alt={iso}
      onError={() => setFailed(true)}
      style={{ display: "inline-block", flexShrink: 0, borderRadius: 2, objectFit: "cover", boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}
    />
  );
}

// ── Globe SVG icon — used for "Other Countries" and "Select your country" ─────
function GlobeIcon({ size = 14, color = "#6b7280" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
      <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
      <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function Logo() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 32, height: 32, background: P, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 8L6 4L10 8L14 4" stroke="white" strokeWidth="2" strokeLinecap="square"/>
          <path d="M2 12L6 8L10 12L14 8" stroke="white" strokeWidth="2" strokeLinecap="square" opacity="0.5"/>
        </svg>
      </div>
      <div>
        <span style={{ fontSize: 18, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>Cybrosoft</span>
        <span style={{ fontSize: 12, color: "#9ca3af", marginLeft: 6 }}>Console</span>
      </div>
    </div>
  );
}

function LeftPanel() {
  return (
    <div style={{
      width: "45%", minHeight: "100vh",
      background: "linear-gradient(160deg, #1a3330 0%, #0d1f1c 100%)",
      display: "flex", flexDirection: "column" as const,
      justifyContent: "space-between", padding: "48px 44px",
      position: "relative" as const, overflow: "hidden",
    }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.04, backgroundImage: "radial-gradient(circle at 20% 50%, #318774 0%, transparent 50%), radial-gradient(circle at 80% 20%, #318774 0%, transparent 40%)" }} />
      <div style={{ position: "relative" as const }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ width: 32, height: 32, background: P, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8L6 4L10 8L14 4" stroke="white" strokeWidth="2" strokeLinecap="square"/>
              <path d="M2 12L6 8L10 12L14 8" stroke="white" strokeWidth="2" strokeLinecap="square" opacity="0.5"/>
            </svg>
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>Cybrosoft</span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginLeft: 2 }}>Console</span>
        </div>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", margin: 0 }}>Cloud Services Management Platform</p>
      </div>
      <div style={{ position: "relative" as const }}>
        <div style={{ fontSize: 28, fontWeight: 600, color: "#fff", lineHeight: 1.3, marginBottom: 16, letterSpacing: "-0.02em" }}>
          Get started with Cybrosoft Console
        </div>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: 0 }}>
          Create your account to manage cloud servers, billing, and subscriptions in one place.
        </p>
      </div>
      <p style={{ position: "relative" as const, fontSize: 12, color: "rgba(255,255,255,0.25)", margin: 0 }}>
        © {new Date().getFullYear()} Cybrosoft · All rights reserved
      </p>
    </div>
  );
}

const ssoLinkStyle: React.CSSProperties = {
  width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
  gap: 10, padding: "10px 16px", fontSize: 14, fontWeight: 500,
  background: "#fff", border: "1px solid #e5e7eb", cursor: "pointer",
  fontFamily: "inherit", color: "#111827", textDecoration: "none",
  boxSizing: "border-box" as const,
};

const primaryBtn = (loading: boolean): React.CSSProperties => ({
  width: "100%", padding: "11px", fontSize: 14, fontWeight: 600,
  background: loading ? "#86c4ba" : P, color: "#fff", border: "none",
  cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit",
});

const ghostBtn: React.CSSProperties = {
  width: "100%", padding: "10px", background: "none", color: "#6b7280",
  fontSize: 13, border: "1px solid #e5e7eb", cursor: "pointer", fontFamily: "inherit",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", fontSize: 14, color: "#111827",
  background: "#fff", border: "1px solid #e5e7eb", outline: "none",
  fontFamily: "inherit", boxSizing: "border-box" as const,
};

const divider = (
  <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
    <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
    <span style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap" as const }}>or continue with email</span>
    <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
  </div>
);

// ── Market switcher — custom dropdown with flags, search, and divider ────────
function MarketSwitcher({ value, onChange }: {
  value: string;
  onChange: (label: string, route: "sa" | "global") => void;
}) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const selectedCountry = COUNTRIES.find(c => c.label === value);

  const filtered = search.trim()
    ? COUNTRIES.filter(c => c.label.toLowerCase().includes(search.trim().toLowerCase()))
    : COUNTRIES;

  function select(country: typeof COUNTRIES[0]) {
    setOpen(false);
    setSearch("");
    sessionStorage.setItem("mkt_selected", country.label);
    if (country.route === "sa") {
      window.location.href = "/sa/signup";
      return;
    }
    if (window.location.pathname.startsWith("/sa")) {
      window.location.href = "/signup";
      return;
    }
    onChange(country.label, country.route);
  }

  function handleOpen() {
    setOpen(o => !o);
    setSearch("");
  }

  React.useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      const el = document.getElementById("mkt-sw");
      if (el && !el.contains(e.target as Node)) { setOpen(false); setSearch(""); }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const triggerStyle: React.CSSProperties = {
    width: "100%", display: "flex", alignItems: "center", gap: 8,
    padding: "6px 28px 6px 10px", fontSize: 12, fontWeight: 500,
    border: "1px solid #e5e7eb", background: "#fff", color: "#374151",
    cursor: "pointer", fontFamily: "inherit", textAlign: "left",
    position: "relative",
  };

  const rowStyle = (selected: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 8,
    padding: "7px 12px", fontSize: 12, cursor: "pointer",
    background: selected ? "#f0faf7" : "#fff",
    color: selected ? "#318774" : "#374151",
    fontWeight: selected ? 600 : 400,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 11, color: "#9ca3af" }}>Select the market country/region</span>
      <div id="mkt-sw" style={{ position: "relative", width: 240 }}>

        {/* Trigger */}
        <button type="button" onClick={handleOpen} style={triggerStyle}>
          {selectedCountry?.iso
            ? <FlagImg iso={selectedCountry.iso} />
            : <GlobeIcon size={13} color="#9ca3af" />
          }
          <span style={{ flex: 1 }}>{selectedCountry?.label || "— Select country —"}</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)" }}>
            <path d={open ? "M2 6.5L5 3.5L8 6.5" : "M2 3.5L5 6.5L8 3.5"} stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        {/* Dropdown */}
        {open && (
          <div style={{
            position: "absolute", bottom: "calc(100% + 4px)", left: 0,
            width: 240, background: "#fff", border: "1px solid #e5e7eb",
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)", zIndex: 50,
          }}>
            {/* Search input — sticky at top */}
            <div style={{ padding: "8px", borderBottom: "1px solid #f3f4f6", background: "#fff" }}>
              <div style={{ position: "relative" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search country..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: "100%", padding: "5px 8px 5px 26px", fontSize: 12,
                    border: "1px solid #e5e7eb", outline: "none",
                    fontFamily: "inherit", boxSizing: "border-box", color: "#374151",
                  }}
                />
              </div>
            </div>

            {/* List */}
            <div style={{ maxHeight: 200, overflowY: "auto" }}>
              {filtered.length === 0 && (
                <div style={{ padding: "10px 12px", fontSize: 12, color: "#9ca3af" }}>No results found</div>
              )}
              {filtered.map(c => (
                <React.Fragment key={c.label}>
                  <div
                    onClick={() => select(c)}
                    style={rowStyle(value === c.label)}
                    onMouseEnter={e => { if (value !== c.label) e.currentTarget.style.background = "#f9fafb"; }}
                    onMouseLeave={e => { if (value !== c.label) e.currentTarget.style.background = value === c.label ? "#f0faf7" : "#fff"; }}
                  >
                    {c.iso ? <FlagImg iso={c.iso} /> : <GlobeIcon size={13} color="#9ca3af" />}
                    <span>{c.label}</span>
                  </div>
                  {/* Divider after United States — only when not searching */}
                  {c.dividerAfter && !search.trim() && (
                    <div style={{ height: 1, background: "#f3f4f6", margin: "2px 0" }} />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ── ISO code → label map for IP detection ────────────────────────────────────
const ISO_TO_LABEL: Record<string, string> = {
  SA: "Saudi Arabia", AE: "UAE", KW: "Kuwait", BH: "Bahrain",
  QA: "Qatar", OM: "Oman", US: "United States", AU: "Australia",
  BE: "Belgium", BR: "Brazil", CA: "Canada", DK: "Denmark",
  EG: "Egypt", FI: "Finland", FR: "France", DE: "Germany",
  IN: "India", ID: "Indonesia", IT: "Italy", JP: "Japan",
  KE: "Kenya", MY: "Malaysia", MX: "Mexico", NL: "Netherlands",
  NZ: "New Zealand", NG: "Nigeria", NO: "Norway", SG: "Singapore",
  ZA: "South Africa", KR: "South Korea", ES: "Spain", SE: "Sweden",
  CH: "Switzerland", GB: "United Kingdom",
};

async function detectCountryCode(): Promise<string | null> {
  // ip-api.com supports CORS on free plan — works from browser fetch()
  try {
    const r = await fetch("https://ip-api.com/json/?fields=countryCode", { cache: "no-store" });
    const d = await r.json();
    if (typeof d?.countryCode === "string") return d.countryCode.toUpperCase();
  } catch { /* ignore */ }
  return null;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function SignupPage() {
  const pathname = usePathname();
  const isSaudi  = pathname.startsWith("/sa");

  const [step,           setStep]          = useState<"email" | "otp" | "exists">("email");
  const [email,          setEmail]         = useState("");
  const [code,           setCode]          = useState("");
  const [loading,        setLoading]       = useState(false);
  const [msg,            setMsg]           = useState<{ text: string; ok: boolean } | null>(null);
  // selectedMarket drives marketKey for all API calls
  const [selectedMarket, setSelectedMarket] = useState<string>(isSaudi ? "Saudi Arabia" : "");

  // On mount (client only): restore manual selection from sessionStorage
  // Must be in useEffect — sessionStorage not available during SSR
  React.useEffect(() => {

    if (isSaudi) return;
    try {
      const saved = sessionStorage.getItem("mkt_selected");
      if (saved) setSelectedMarket(saved);
    } catch (err) { console.log("[signup] sessionStorage error:", err); }
  }, []);

  // Derived: is the currently selected market Saudi?
  const selectedIsSaudi = COUNTRIES.find(c => c.label === selectedMarket)?.route === "sa";



  async function handleSso(provider: "google" | "microsoft") {
    const mkt = selectedIsSaudi ? "saudi" : "global";
    setLoading(true); setMsg(null);
    try {
      const res = await fetch(`/api/auth/${provider}?market=${mkt}`, { redirect: "manual" });
      if (res.status === 503) {
        setMsg({ text: `${provider === "microsoft" ? "Microsoft" : "Google"} SSO is not configured yet. Please use email to sign up.`, ok: false });
        return;
      }
      const location = res.headers.get("location") || res.url;
      if (location && location !== window.location.href) {
        window.location.href = location;
      } else {
        setMsg({ text: "SSO is not available yet. Please use email to sign up.", ok: false });
      }
    } catch {
      setMsg({ text: "SSO is not available yet. Please use email to sign up.", ok: false });
    } finally { setLoading(false); }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    const normalized = normalizeEmail(email);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, marketKey: selectedIsSaudi ? "saudi" : "global" }),
      });
      const raw = await res.json().catch(() => null);
      if (!isRecord(raw)) { setMsg({ text: "Server error. Please try again.", ok: false }); return; }
      if (readBoolean(raw, "userExists") === true) { setStep("exists"); return; }
      if (readBoolean(raw, "ok") === false) {
        setMsg({ text: readString(raw, "error") ?? "Something went wrong.", ok: false });
        return;
      }
      setStep("otp");
      setMsg({ text: "If this email is new, you will receive a verification code shortly.", ok: true });
    } finally { setLoading(false); }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(email), code }),
      });
      const raw = await res.json().catch(() => null);
      if (!res.ok || !isRecord(raw) || readBoolean(raw, "ok") !== true) {
        setMsg({ text: "Invalid or expired code. Please try again.", ok: false });
        return;
      }
      window.location.href = readString(raw, "redirectTo") ?? (selectedIsSaudi ? "/sa/dashboard" : "/dashboard");
    } finally { setLoading(false); }
  }

  // Market-aware links — /sa prefix when on Saudi path
  const loginHref  = selectedIsSaudi ? "/sa/login" : "/login";

  const rightContent = (
    <div style={{ width: "100%", maxWidth: 380 }}>

      {/* Mobile logo */}
      <div className="mobile-logo" style={{ marginBottom: 32 }}>
        <Logo />
      </div>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          {step === "email"  ? "Create your account"   :
           step === "otp"    ? "Check your email"       :
                               "Account already exists"}
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          {step === "email"  ? "Sign up to get started with Cybrosoft Console" :
           step === "otp"    ? <><strong style={{ color: "#374151" }}>{email}</strong> — enter the code we sent</> :
                               <>We found an existing account for <strong style={{ color: "#374151" }}>{email}</strong></>}
        </p>
      </div>

      {msg && (
        <div style={{
          marginBottom: 20, padding: "10px 14px",
          background: msg.ok ? "#eaf4f2" : "#fee2e2",
          border: `1px solid ${msg.ok ? "#86efac" : "#fca5a5"}`,
          fontSize: 13, color: msg.ok ? "#15803d" : "#991b1b",
        }}>{msg.text}</div>
      )}

      {step === "email" && (
        <>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
            <button style={ssoLinkStyle} onClick={() => handleSso("microsoft")}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
              <MicrosoftIcon /> Sign up with Microsoft
            </button>
            <button style={ssoLinkStyle} onClick={() => handleSso("google")}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
              <GoogleIcon /> Sign up with Google
            </button>
          </div>
          {divider}
          <form onSubmit={submitEmail} style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                Email address
              </label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com" style={inputStyle}
                onFocus={e => (e.target.style.borderColor = P)}
                onBlur={e  => (e.target.style.borderColor = "#e5e7eb")} />
            </div>
            <button type="submit" disabled={loading} style={primaryBtn(loading)}>
              {loading ? "Checking…" : "Continue"}
            </button>
          </form>
        </>
      )}

      {step === "otp" && (
        <form onSubmit={verifyOtp} style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
              6-digit verification code
            </label>
            <input type="text" inputMode="numeric" required value={code}
              onChange={e => setCode(e.target.value)} placeholder="123456" maxLength={6} autoFocus
              style={{ ...inputStyle, fontSize: 22, letterSpacing: "0.3em", textAlign: "center" as const, fontFamily: "monospace" }}
              onFocus={e => (e.target.style.borderColor = P)}
              onBlur={e  => (e.target.style.borderColor = "#e5e7eb")} />
          </div>
          <button type="submit" disabled={loading} style={primaryBtn(loading)}>
            {loading ? "Verifying…" : "Verify & Create Account"}
          </button>
          <button type="button" style={ghostBtn}
            onClick={() => { setStep("email"); setCode(""); setMsg(null); }}>
            ← Back
          </button>
        </form>
      )}

      {step === "exists" && (
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
          <div style={{ padding: "14px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
            An account with this email already exists. Please sign in instead.
          </div>
          <a href={`${loginHref}?email=${encodeURIComponent(normalizeEmail(email))}`}
            style={{ display: "block", textAlign: "center" as const, padding: "11px", background: P, color: "#fff", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
            Sign In →
          </a>
          <button type="button" style={ghostBtn}
            onClick={() => { setStep("email"); setEmail(""); setMsg(null); }}>
            ← Use a different email
          </button>
        </div>
      )}

      <p style={{ marginTop: 24, fontSize: 12, color: "#9ca3af", textAlign: "center" as const, lineHeight: 1.6 }}>
        By proceeding, you agree to our{" "}
        <a href="/terms" style={{ color: "#6b7280", textDecoration: "underline" }}>Terms of Service</a>
        {" "}and{" "}
        <a href="/privacy" style={{ color: "#6b7280", textDecoration: "underline" }}>Privacy Policy</a>
      </p>

      {/* Market-aware sign in link */}
      <p style={{ marginTop: 16, fontSize: 13, color: "#6b7280", textAlign: "center" as const }}>
        Already have an account?{" "}
        <a href={loginHref} style={{ color: P, fontWeight: 500, textDecoration: "none" }}>Sign in</a>
      </p>

      {/* Market switcher */}
      <div className="market-switcher-wrap" style={{ marginTop: 24 }}>
        <MarketSwitcher value={selectedMarket} onChange={(label) => setSelectedMarket(label)} />
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        .mobile-logo { display: none; }
        @media (max-width: 768px) {
          .auth-left { display: none !important; }
          .auth-right { width: 100% !important; padding: 32px 24px !important; }
          .mobile-logo { display: block; }
          .market-switcher-wrap { display: flex; justify-content: center; }
        }
        @media (min-width: 769px) {
          .market-switcher-wrap { display: flex; justify-content: flex-end; }
        }
      `}</style>
      <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div className="auth-left" style={{ width: "45%", flexShrink: 0 }}>
          <LeftPanel />
        </div>
        <div className="auth-right" style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          padding: "48px 32px", background: "#fff",
        }}>
          {rightContent}
        </div>
      </div>
    </>
  );
}
