"use client";
// app/login/page.tsx

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function readString(obj: Record<string, unknown>, key: string): string | null {
  const v = obj[key];
  return typeof v === "string" ? v : null;
}

function readBoolean(obj: Record<string, unknown>, key: string): boolean | null {
  const v = obj[key];
  return typeof v === "boolean" ? v : null;
}

type VerifyOk  = { ok: true;  redirectTo?: string };
type VerifyErr = { ok: false; error: string };
type VerifyResp = VerifyOk | VerifyErr;

function parseError(raw: unknown, fallback: string): string {
  if (!raw || !isRecord(raw)) return fallback;
  return readString(raw, "error") ?? fallback;
}

function parseVerify(raw: unknown): VerifyResp | null {
  if (!raw || !isRecord(raw)) return null;
  const ok = readBoolean(raw, "ok");
  if (ok === true)  return { ok: true,  redirectTo: readString(raw, "redirectTo") ?? undefined };
  if (ok === false) return { ok: false, error: readString(raw, "error") ?? "Invalid code." };
  const legacyError = readString(raw, "error");
  if (legacyError) return { ok: false, error: legacyError };
  return null;
}

const P = "#318774";

export default function LoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const emailFromQuery = useMemo(() => {
    const q = searchParams.get("email");
    return q ? normalizeEmail(q) : "";
  }, [searchParams]);

  const [step,    setStep]    = useState<"email" | "code">("email");
  const [email,   setEmail]   = useState("");
  const [code,    setCode]    = useState("");
  const [loading, setLoading] = useState(false);
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (emailFromQuery) {
      setEmail(emailFromQuery);
      setStep("code");
      setMsg({ text: "Enter the OTP code sent to your email.", ok: true });
    }
  }, [emailFromQuery]);

  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const normalized = normalizeEmail(email);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const raw = await res.json().catch(() => null);
      if (!res.ok) { setMsg({ text: parseError(raw, "Failed to send code."), ok: false }); return; }
      setEmail(normalized);
      setStep("code");
      setMsg({ text: "OTP code sent — check your inbox.", ok: true });
    } finally { setLoading(false); }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    const normalized = normalizeEmail(email);
    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized, code }),
      });
      const raw = await res.json().catch(() => null);
      if (!res.ok) { setMsg({ text: parseError(raw, "Invalid code."), ok: false }); return; }
      const parsed = parseVerify(raw);
      if (!parsed || !parsed.ok) { setMsg({ text: (parsed as VerifyErr)?.error ?? "Invalid code.", ok: false }); return; }
      router.replace(parsed.redirectTo ?? "/dashboard");
      router.refresh();
    } finally { setLoading(false); }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f5f5f5",
      fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      padding: "24px 16px",
    }}>
      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        width: "100%",
        maxWidth: 400,
        padding: "40px 40px 36px",
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 32, textAlign: "center" }}>
          <div style={{ marginBottom: 6 }}>
            <span style={{
              fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em",
              background: "linear-gradient(to right, #254b46, #318774)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}>Cybrosoft</span>
            <span style={{ fontSize: 14, color: "#9ca3af", marginLeft: 6 }}>Console</span>
          </div>
          <p style={{ fontSize: 13, color: "#9ca3af" }}>Cloud Services Management</p>
        </div>

        {/* Step heading */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "#111827", marginBottom: 4 }}>
            {step === "email" ? "Sign in to your account" : "Enter verification code"}
          </h1>
          {step === "code" && (
            <p style={{ fontSize: 13, color: "#6b7280" }}>
              Sent to <strong style={{ color: "#374151" }}>{email}</strong>
            </p>
          )}
        </div>

        {/* Message */}
        {msg && (
          <div style={{
            marginBottom: 16,
            padding: "10px 14px",
            background: msg.ok ? "#eaf4f2" : "#fee2e2",
            border: `1px solid ${msg.ok ? "#86efac" : "#fca5a5"}`,
            fontSize: 13,
            color: msg.ok ? "#15803d" : "#991b1b",
          }}>{msg.text}</div>
        )}

        {/* Email step */}
        {step === "email" ? (
          <form onSubmit={requestOtp}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                Email address
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <span style={{ position: "absolute", left: 12, display: "flex" }}>
                  <Icon name="user" size={15} color="#9ca3af" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="admin@cybrosoft.com"
                  style={{
                    width: "100%",
                    padding: "10px 12px 10px 38px",
                    fontSize: 13.5,
                    color: "#111827",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    outline: "none",
                    fontFamily: "inherit",
                    transition: "border-color 0.12s",
                  }}
                  onFocus={e => (e.target.style.borderColor = P)}
                  onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px",
                background: loading ? "#86c4ba" : P,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                transition: "background 0.12s",
              }}
            >
              {loading ? "Sending…" : "Send OTP Code"}
            </button>
          </form>
        ) : (
          /* Code step */
          <form onSubmit={verifyOtp}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                6-digit OTP code
              </label>
              <input
                type="text"
                inputMode="numeric"
                required
                value={code}
                onChange={e => setCode(e.target.value)}
                placeholder="123456"
                maxLength={6}
                autoFocus
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: 22,
                  letterSpacing: "0.3em",
                  textAlign: "center",
                  color: "#111827",
                  background: "#fff",
                  border: "1px solid #e5e7eb",
                  outline: "none",
                  fontFamily: "monospace",
                  transition: "border-color 0.12s",
                }}
                onFocus={e => (e.target.style.borderColor = P)}
                onBlur={e => (e.target.style.borderColor = "#e5e7eb")}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "11px",
                background: loading ? "#86c4ba" : P,
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                border: "none",
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit",
                marginBottom: 10,
              }}
            >{loading ? "Verifying…" : "Verify & Login"}</button>

            <button
              type="button"
              disabled={loading}
              onClick={() => { setStep("email"); setCode(""); setMsg(null); }}
              style={{
                width: "100%",
                padding: "10px",
                background: "none",
                color: "#6b7280",
                fontSize: 13,
                border: "1px solid #e5e7eb",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >← Back</button>
          </form>
        )}

        <p style={{ marginTop: 28, fontSize: 12, color: "#9ca3af", textAlign: "center" }}>
          © {new Date().getFullYear()} Cybrosoft · All rights reserved
        </p>
      </div>
    </div>
  );
}
