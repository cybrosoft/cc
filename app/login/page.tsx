//app/login/page.tsx

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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

type VerifyOk = { ok: true; redirectTo?: string };
type VerifyErr = { ok: false; error: string };
type VerifyResp = VerifyOk | VerifyErr;

function parseError(raw: unknown, fallback: string): string {
  if (!raw || !isRecord(raw)) return fallback;
  const msg = readString(raw, "error");
  return msg ?? fallback;
}

function parseVerify(raw: unknown): VerifyResp | null {
  if (!raw || !isRecord(raw)) return null;
  const ok = readBoolean(raw, "ok");
  if (ok === true) {
    const redirectTo = readString(raw, "redirectTo") ?? undefined;
    return { ok: true, redirectTo };
  }
  if (ok === false) {
    const error = readString(raw, "error") ?? "Invalid code.";
    return { ok: false, error };
  }
  const legacyError = readString(raw, "error");
  if (legacyError) return { ok: false, error: legacyError };
  return null;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const emailFromQuery = useMemo(() => {
    const q = searchParams.get("email");
    return q ? normalizeEmail(q) : "";
  }, [searchParams]);

  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState<string>("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // If coming from signup (or any deep link), prefill email and go to code step.
  useEffect(() => {
    if (emailFromQuery) {
      setEmail(emailFromQuery);
      setStep("code");
      setMsg("Enter the OTP code sent to your email.");
    }
    // we intentionally only react to emailFromQuery
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

      const raw = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        setMsg(parseError(raw, "Failed to send code."));
        return;
      }

      setEmail(normalized);
      setStep("code");
      setMsg("If the email is allowed, an OTP was sent.");
    } finally {
      setLoading(false);
    }
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

      const raw = (await res.json().catch(() => null)) as unknown;

      if (!res.ok) {
        setMsg(parseError(raw, "Invalid code."));
        return;
      }

      const parsed = parseVerify(raw);
      if (!parsed || !parsed.ok) {
        setMsg(parsed?.ok === false ? parsed.error : "Invalid code.");
        return;
      }

      const target = parsed.redirectTo ?? "/dashboard";
      router.replace(target);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "40px auto", padding: 16 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>Login</h1>

      {msg && (
        <div style={{ marginBottom: 12, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}>
          {msg}
        </div>
      )}

      {step === "email" ? (
        <form onSubmit={requestOtp}>
          <label style={{ display: "block", marginBottom: 6 }}>Email</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            placeholder="admin@cybrosoft.com"
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />
          <button disabled={loading} style={{ marginTop: 12, width: "100%", padding: 10, borderRadius: 8 }}>
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </form>
      ) : (
        <form onSubmit={verifyOtp}>
          <div style={{ marginBottom: 10, fontSize: 14 }}>
            Code sent to <b>{normalizeEmail(email)}</b>
          </div>

          <label style={{ display: "block", marginBottom: 6 }}>OTP Code</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            required
            placeholder="123456"
            style={{ width: "100%", padding: 10, border: "1px solid #ccc", borderRadius: 8 }}
          />

          <button disabled={loading} style={{ marginTop: 12, width: "100%", padding: 10, borderRadius: 8 }}>
            {loading ? "Verifying..." : "Verify & Login"}
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setStep("email");
              setCode("");
              setMsg(null);
            }}
            style={{ marginTop: 10, width: "100%", padding: 10, borderRadius: 8 }}
          >
            Back
          </button>
        </form>
      )}
    </main>
  );
}