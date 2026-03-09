// lib/ui/tokens.ts
// Central design tokens for Cybrosoft Console UI
// Use these in all components for consistency

export const colors = {
  primary:       "#318774",
  primaryLight:  "#eaf4f2",
  primaryDark:   "#254b46",
  headerBg:      "#222222",
  headerBorder:  "#2a2a2a",
  searchBg:      "#2c2c2c",
  searchBorder:  "#383838",
  border:        "#e5e7eb",
  borderLight:   "#f3f4f6",
  pageBg:        "#f5f5f5",
  cardBg:        "#ffffff",
  textPrimary:   "#111827",
  textSecondary: "#374151",
  textMuted:     "#6b7280",
  textFaint:     "#9ca3af",

  // Status colours
  statusActive:   { text: "#15803d", bg: "#dcfce7", border: "#86efac" },
  statusPending:  { text: "#92400e", bg: "#fef3c7", border: "#fcd34d" },
  statusExpired:  { text: "#374151", bg: "#f3f4f6", border: "#d1d5db" },
  statusCanceled: { text: "#374151", bg: "#f3f4f6", border: "#d1d5db" },
  statusPaid:     { text: "#15803d", bg: "#dcfce7", border: "#86efac" },
  statusUnpaid:   { text: "#991b1b", bg: "#fee2e2", border: "#fca5a5" },
  statusExpiring: { text: "#92400e", bg: "#fef3c7", border: "#fcd34d" },
  statusDraft:    { text: "#374151", bg: "#f9fafb", border: "#e5e7eb" },
} as const;

export const font = {
  sans: "'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as const;
