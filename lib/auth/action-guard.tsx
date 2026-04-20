"use client";
// lib/auth/action-guard.tsx
// Wraps any action (button, link click) and shows a message for restricted users.
// ACTIVE users — action proceeds normally.
// PENDING / INFO_REQUIRED — click is intercepted, message shown instead.
// Security is enforced at API level — this is UX only.

import { useState, useCallback } from "react";

type UserStatus = "PENDING" | "INFO_REQUIRED" | "ACTIVE" | "REJECTED" | "SUSPENDED" | string;

const STATUS_MESSAGES: Record<string, string> = {
  PENDING:       "Your account is pending approval. This action will be available once our team approves your account.",
  INFO_REQUIRED: "Additional information is required before you can perform this action. Please check your email for details.",
};

// ── Toast message component ───────────────────────────────────────────────────
function GuardToast({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, maxWidth: 420, width: "calc(100% - 32px)",
      background: "#1e293b", color: "#f8fafc",
      padding: "12px 16px", borderRadius: 8,
      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      display: "flex", alignItems: "flex-start", gap: 10,
      animation: "guard-slide-up 0.2s ease",
    }}>
      <style>{`
        @keyframes guard-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
      <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
      <span style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>{message}</span>
      <button onClick={onClose} style={{
        background: "none", border: "none", color: "#94a3b8",
        cursor: "pointer", fontSize: 16, padding: 0, flexShrink: 0, lineHeight: 1,
      }}>×</button>
    </div>
  );
}

// ── Hook — use in components that need guard logic ────────────────────────────
export function useActionGuard(userStatus: UserStatus) {
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isRestricted = userStatus === "PENDING" || userStatus === "INFO_REQUIRED";

  const guard = useCallback((action: () => void) => {
    if (!isRestricted) { action(); return; }
    setToastMsg(STATUS_MESSAGES[userStatus] ?? STATUS_MESSAGES.PENDING);
    setTimeout(() => setToastMsg(null), 5000);
  }, [isRestricted, userStatus]);

  // Wrap href navigation
  const guardHref = useCallback((e: React.MouseEvent, href: string) => {
    if (!isRestricted) return; // allow normal navigation
    e.preventDefault();
    setToastMsg(STATUS_MESSAGES[userStatus] ?? STATUS_MESSAGES.PENDING);
    setTimeout(() => setToastMsg(null), 5000);
  }, [isRestricted, userStatus]);

  const toast = toastMsg ? (
    <GuardToast message={toastMsg} onClose={() => setToastMsg(null)} />
  ) : null;

  return { guard, guardHref, isRestricted, toast };
}

// ── ActionGuard component — wraps children ────────────────────────────────────
interface ActionGuardProps {
  userStatus: UserStatus;
  children: React.ReactNode;
  // Optional: override the default message
  message?: string;
}

export function ActionGuard({ userStatus, children, message }: ActionGuardProps) {
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const isRestricted = userStatus === "PENDING" || userStatus === "INFO_REQUIRED";

  function handleClick(e: React.MouseEvent) {
    if (!isRestricted) return;
    e.preventDefault();
    e.stopPropagation();
    const msg = message ?? STATUS_MESSAGES[userStatus] ?? STATUS_MESSAGES.PENDING;
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 5000);
  }

  return (
    <>
      <div onClick={handleClick} style={{ display: "contents" }}>
        {children}
      </div>
      {toastMsg && <GuardToast message={toastMsg} onClose={() => setToastMsg(null)} />}
    </>
  );
}
