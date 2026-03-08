// FILE: app/admin/subscriptions/ui/subscriptionsDataTable.tsx
"use client";

import type { SubRow } from "../subscriptionsTableTypes";
import { Badge } from "./badge";
import { daysUntil, fmtDate } from "./subscriptionsUtils";

function expiryBadgeClass(endIso: string | null, statusValue: string): string {
  if (statusValue !== "ACTIVE") return "text-gray-500";
  const d = daysUntil(endIso);
  if (d === null) return "text-gray-500";
  if (d <= 7) return "text-red-700 font-medium";
  if (d <= 30) return "text-yellow-800 font-medium";
  return "text-gray-900";
}

function expiryHint(endIso: string | null, statusValue: string): string {
  if (statusValue !== "ACTIVE") return "";
  const d = daysUntil(endIso);
  if (d === null) return "";
  if (d <= 7) return "🔴";
  if (d <= 30) return "🟡";
  return "";
}

export function SubscriptionsDataTable({
  rows,
  page,
  totalPages,
  loading,
  onPrev,
  onNext,
  onOpenVps,
  onOpenBilling,
}: {
  rows: SubRow[];
  page: number;
  totalPages: number;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onOpenVps: (sub: SubRow) => void;
  onOpenBilling: (sub: SubRow) => void;
}) {
  return (
    <div className="rounded-lg border bg-white">
      <div className="overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2">User</th>
              <th className="px-4 py-2">Market</th>
              <th className="px-4 py-2">Category</th>
              <th className="px-4 py-2">Product ID</th>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Payment Status</th>
              <th className="px-4 py-2">Expiry Date</th>
              <th className="px-4 py-2">Server</th>
              <th className="px-4 py-2">Billing</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((s) => {
              const hasServer =
                s.servers.some((x) => x.hetznerServerId) ||
                // oracle is also a server
                s.servers.some((x) => (x as unknown as { oracleInstanceId?: string | null }).oracleInstanceId);

              // ✅ PAID only if payment date exists
              const payLabel = s.activatedAt ? "PAID" : "PENDING";

              const categoryName = s.product.category?.name ?? "—";

              return (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-2">
                    <div className="font-medium">{s.user.email}</div>
                    <div className="text-xs text-gray-500">{s.id}</div>
                  </td>

                  <td className="px-4 py-2">{s.market.name}</td>

                  <td className="px-4 py-2">{categoryName}</td>

                  <td className="px-4 py-2">{s.product.key}</td>

                  <td className="px-4 py-2">{s.product.name}</td>

                  <td className="px-4 py-2">
                    <Badge value={s.status} />
                  </td>

                  <td className="px-4 py-2">
                    <span className={payLabel === "PAID" ? "text-green-700" : "text-yellow-800"}>
                      {payLabel}
                    </span>
                  </td>

                  <td className="px-4 py-2">
                    <span className={expiryBadgeClass(s.currentPeriodEnd, s.status)}>
                      {s.status === "ACTIVE" ? fmtDate(s.currentPeriodEnd) : "—"}{" "}
                      {expiryHint(s.currentPeriodEnd, s.status)}
                    </span>
                  </td>

                  <td className="px-4 py-2">
                    {!hasServer ? (
                      <button
                        className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100"
                        onClick={() => onOpenVps(s)}
                      >
                        Assaign VPS
                      </button>
                    ) : (
                      <a
                        className="inline-flex rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100"
                        href={`/admin/servers?email=${encodeURIComponent(s.user.email)}`}
                      >
                        View VPS
                      </a>
                    )}
                  </td>

                  <td className="px-4 py-2">
                    <button
                      className="rounded-md border px-3 py-1.5 text-xs hover:bg-gray-100"
                      onClick={() => onOpenBilling(s)}
                    >
                      Billing
                    </button>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-gray-500" colSpan={10}>
                  No subscriptions found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
        <button
          className="rounded-md border px-3 py-1.5 hover:bg-gray-100 disabled:opacity-50"
          disabled={loading || page <= 1}
          onClick={onPrev}
        >
          Prev
        </button>

        <div className="text-gray-600">
          Page {page} / {totalPages}
        </div>

        <button
          className="rounded-md border px-3 py-1.5 hover:bg-gray-100 disabled:opacity-50"
          disabled={loading || page >= totalPages}
          onClick={onNext}
        >
          Next
        </button>
      </div>
    </div>
  );
}