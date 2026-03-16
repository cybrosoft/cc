// app/admin/system/settings/tabs/settings-ui.tsx
// Shared primitives for settings tabs — inputs, section cards, save button.
"use client";
import React from "react";
import { CLR } from "@/components/ui/admin-ui";

export const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", fontSize: 13,
  border: "1px solid #d1d5db", fontFamily: "inherit",
  outline: "none", background: "#fff", boxSizing: "border-box" as const,
};

export const label: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: CLR.muted,
  letterSpacing: "0.04em", marginBottom: 4,
  display: "block", textTransform: "uppercase" as const,
};

export const card: React.CSSProperties = {
  background: "#fff", border: "1px solid #e5e7eb", padding: "20px 22px", marginBottom: 16,
};

export const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: CLR.text,
  marginBottom: 16, paddingBottom: 10,
  borderBottom: "1px solid #f3f4f6",
};

export function Field({ label: lbl, hint, children, half }: {
  label: string; hint?: string; children: React.ReactNode; half?: boolean;
}) {
  return (
    <div style={{ marginBottom: 14, width: half ? "calc(50% - 8px)" : "100%" }}>
      <label style={label}>{lbl}</label>
      {children}
      {hint && <p style={{ fontSize: 11, color: CLR.faint, marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

export function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {children}
    </div>
  );
}

export function SaveBar({ saving, saved, error, onSave, label: lbl = "Save Changes" }: {
  saving: boolean; saved: boolean; error: string; onSave: () => void; label?: string;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 0", marginTop: 8,
    }}>
      <button
        onClick={onSave}
        disabled={saving}
        style={{
          padding: "9px 22px", fontSize: 13, fontWeight: 600,
          background: saving ? "#9ca3af" : CLR.primary,
          color: "#fff", border: "none",
          cursor: saving ? "not-allowed" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {saving ? "Saving…" : lbl}
      </button>
      {saved && !error && (
        <span style={{ fontSize: 12, color: "#15803d", fontWeight: 600 }}>✓ Saved</span>
      )}
      {error && (
        <span style={{ fontSize: 12, color: "#dc2626" }}>{error}</span>
      )}
    </div>
  );
}

export function TabHeader({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: CLR.text, marginBottom: 4 }}>{title}</h2>
      <p style={{ fontSize: 13, color: CLR.muted }}>{description}</p>
    </div>
  );
}
