// app/admin/subscriptions/ui/badge.tsx
"use client";

export function Badge({ value }: { value: string }) {
  const cls =
    value === "ACTIVE"
      ? "bg-green-50 text-green-700 border-green-200"
      : value === "CANCELED"
      ? "bg-red-50 text-red-700 border-red-200"
      : "bg-yellow-50 text-yellow-800 border-yellow-200";

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${cls}`}>
      {value}
    </span>
  );
}