"use client";
// app/login/page.tsx

import React, { useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function normalizeEmail(e: string) { return e.trim().toLowerCase(); }
function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null; }
function readString(o: Record<string, unknown>, k: string): string | null { const v = o[k]; return typeof v === "string" ? v : null; }
function readBoolean(o: Record<string, unknown>, k: string): boolean | null { const v = o[k]; return typeof v === "boolean" ? v : null; }

const P = "#318774";

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
          Manage your cloud infrastructure in one place
        </div>
        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, margin: 0 }}>
          Servers, billing, subscriptions, and support — all unified under a single console.
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

export default function LoginPage() {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const isSaudi      = pathname.startsWith("/sa");

  const reason     = searchParams.get("reason");
  const errorParam = searchParams.get("error");

  const [step,    setStep]    = useState<"email" | "otp" | "totp">("email");
  const [email,   setEmail]   = useState("");
  const [code,    setCode]    = useState("");
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (reason === "rejected")  setMsg({ text: "Your application was not approved. Please contact support.", ok: false });
    if (reason === "suspended") setMsg({ text: "Your account has been suspended. Please contact support.", ok: false });
    if (errorParam)             setMsg({ text: decodeURIComponent(errorParam), ok: false });
  }, [reason, errorParam]);

  const emailFromQuery = useMemo(() => {
    const q = searchParams.get("email");
    return q ? normalizeEmail(q) : "";
  }, [searchParams]);

  useEffect(() => {
    if (emailFromQuery) {
      setEmail(emailFromQuery);
      setStep("otp");
      setMsg({ text: "Enter the OTP code sent to your email.", ok: true });
    }
  }, [emailFromQuery]);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      await fetch("/api/auth/otp/request", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizeEmail(email) }),
      });
      setStep("otp");
      setMsg({ text: "If an account exists, you will receive a code on your email.", ok: true });
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
        const errCode = isRecord(raw) ? readString(raw, "error") : null;
        let errMsg = "Invalid or expired code. Please try again.";
        if (errCode === "ACCOUNT_REJECTED")  errMsg = "Your application was not approved. Please contact support.";
        if (errCode === "ACCOUNT_SUSPENDED") errMsg = "Your account has been suspended. Please contact support.";
        if (errCode === "SIGNUP_EXPIRED")    errMsg = "Your signup session expired. Please sign up again.";
        setMsg({ text: errMsg, ok: false });
        return;
      }
      // TOTP required — switch to TOTP step
      if (isRecord(raw) && raw.requiresTotp === true) {
        setStep("totp"); setCode(""); setMsg(null);
        return;
      }
      window.location.href = readString(raw, "redirectTo") ?? (isSaudi ? "/sa/dashboard" : "/dashboard");
    } finally { setLoading(false); }
  }

  async function verifyTotp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const res = await fetch("/api/auth/totp/challenge", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const raw = await res.json().catch(() => null);
      if (!res.ok || !isRecord(raw) || readBoolean(raw, "ok") !== true) {
        setMsg({ text: isRecord(raw) ? (readString(raw, "error") ?? "Invalid code.") : "Invalid code.", ok: false });
        return;
      }
      window.location.href = readString(raw, "redirectTo") ?? (isSaudi ? "/sa/dashboard" : "/dashboard");
    } finally { setLoading(false); }
  }

  // Market-aware links
  const signupHref = isSaudi ? "/sa/signup" : "/signup";
  const market     = isSaudi ? "saudi" : "global";

  async function handleSso(provider: "google" | "microsoft", mkt: string) {
    setLoading(true); setMsg(null);
    try {
      const res = await fetch(`/api/auth/${provider}?market=${mkt}`, { redirect: "manual" });
      // 503 = not configured, 3xx = redirect to provider (follow it)
      if (res.status === 503 || res.type === "opaqueredirect") {
        if (res.status === 503) {
          setMsg({ text: `${provider === "microsoft" ? "Microsoft" : "Google"} SSO is not configured yet. Please use email to sign in.`, ok: false });
          return;
        }
      }
      // Follow the redirect manually
      const location = res.headers.get("location") || res.url;
      if (location && location !== window.location.href) {
        window.location.href = location;
      } else {
        setMsg({ text: "SSO is not available yet. Please use email to sign in.", ok: false });
      }
    } catch {
      setMsg({ text: "SSO is not available yet. Please use email to sign in.", ok: false });
    } finally { setLoading(false); }
  }

  const rightContent = (
    <div style={{ width: "100%", maxWidth: 380 }}>

      {/* Mobile logo */}
      <div className="mobile-logo" style={{ marginBottom: 32 }}>
        <Logo />
      </div>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          {step === "email" ? "Sign in to your account" : step === "otp" ? "Check your email" : "Two-factor authentication"}
        </h1>
        <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
          {step === "email"
            ? "Welcome back — sign in to continue"
            : step === "otp"
            ? <>Code sent to <strong style={{ color: "#374151" }}>{email}</strong></>
            : "Enter the 6-digit code from your authenticator app."}
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

      {step === "email" ? (
        <>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
            <button style={ssoLinkStyle} onClick={() => handleSso("microsoft", market)}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
              <MicrosoftIcon /> Continue with Microsoft
            </button>
            <button style={ssoLinkStyle} onClick={() => handleSso("google", market)}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
              <GoogleIcon /> Continue with Google
            </button>
          </div>
          {divider}
          <form onSubmit={requestOtp} style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
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
              {loading ? "Sending…" : "Continue with Email"}
            </button>
          </form>
        </>
      ) : step === "otp" ? (
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
            {loading ? "Verifying…" : "Verify & Sign In"}
          </button>
          <button type="button" style={ghostBtn}
            onClick={() => { setStep("email"); setCode(""); setMsg(null); }}>
            ← Back to email
          </button>
        </form>
      ) : (
        <form onSubmit={verifyTotp} style={{ display: "flex", flexDirection: "column" as const, gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
              Authenticator code
            </label>
            <input type="text" inputMode="numeric" required value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" maxLength={6} autoFocus
              style={{ ...inputStyle, fontSize: 22, letterSpacing: "0.3em", textAlign: "center" as const, fontFamily: "monospace" }}
              onFocus={e => (e.target.style.borderColor = P)}
              onBlur={e  => (e.target.style.borderColor = "#e5e7eb")} />
            <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#9ca3af" }}>
              Open your authenticator app (Google Authenticator, Microsoft Authenticator, etc.) and enter the current 6-digit code.
            </p>
          </div>
          <button type="submit" disabled={loading || code.length !== 6} style={primaryBtn(loading)}>
            {loading ? "Verifying…" : "Confirm & Sign In"}
          </button>
          <button type="button" style={ghostBtn}
            onClick={() => { setStep("email"); setCode(""); setMsg(null); }}>
            ← Start over
          </button>
        </form>
      )}

      <p style={{ marginTop: 24, fontSize: 12, color: "#9ca3af", textAlign: "center" as const, lineHeight: 1.6 }}>
        By proceeding, you agree to our{" "}
        <a href="/terms" style={{ color: "#6b7280", textDecoration: "underline" }}>Terms of Service</a>
        {" "}and{" "}
        <a href="/privacy" style={{ color: "#6b7280", textDecoration: "underline" }}>Privacy Policy</a>
      </p>

      {/* Market-aware sign up link */}
      <p style={{ marginTop: 20, fontSize: 13, color: "#6b7280", textAlign: "center" as const }}>
        Don&apos;t have an account?{" "}
        <a href={signupHref} style={{ color: P, fontWeight: 500, textDecoration: "none" }}>Create one</a>
      </p>
    </div>
  );

  return (
    <>
      <style>{`
        .mobile-logo { display: none; }
        @media (max-width: 768px) {
          .auth-left { display: none !important; }
          .auth-right { width: 100% !important; min-height: 100vh; padding: 32px 24px !important; }
          .mobile-logo { display: block; }
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
