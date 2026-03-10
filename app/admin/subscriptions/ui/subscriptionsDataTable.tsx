"use client";
// app/admin/subscriptions/ui/subscriptionsDataTable.tsx
// Step 6 restyled — identical props and logic, new flat UI

import type { SubRow } from "../subscriptionsTableTypes";
import { Table, TR, TD, CLR } from "@/components/ui/admin-ui";
import { daysUntil, fmtDate } from "./subscriptionsUtils";

// ── Helpers ───────────────────────────────────────────────────────────────────
function ExpiryCell({ endIso, status }: { endIso: string | null; status: string }) {
  if (status !== "ACTIVE" || !endIso) return <TD muted>—</TD>;
  const d = daysUntil(endIso);
  const dt = fmtDate(endIso);
  if (d === null) return <TD muted>{dt}</TD>;
  const color = d <= 7 ? "#dc2626" : d <= 30 ? "#d97706" : "#374151";
  const icon  = d <= 7 ? " 🔴" : d <= 30 ? " 🟡" : "";
  return (
    <TD style={{ color, fontWeight: d <= 30 ? 600 : 400 }}>
      {dt}{icon}
    </TD>
  );
}

function StatusBadgeInline({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    ACTIVE:           { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
    PENDING_PAYMENT:  { bg: "#fef9c3", color: "#854d0e", border: "#fde047" },
    PENDING_EXTERNAL: { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
    CANCELED:         { bg: "#f3f4f6", color: "#6b7280", border: CLR.border },
  };
  const s = map[status] ?? map.CANCELED;
  return (
    <span style={{ display:"inline-flex", fontSize:11, fontWeight:600, padding:"2px 8px", background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>
      {status.replace("_"," ")}
    </span>
  );
}

function PayBadge({ status, activatedAt }: { status: string; activatedAt: string | null }) {
  const paid = !!activatedAt;
  return (
    <span style={{ display:"inline-flex", fontSize:11, fontWeight:600, padding:"2px 8px",
      background: paid ? "#dcfce7" : "#fef9c3",
      color: paid ? "#15803d" : "#854d0e",
      border: `1px solid ${paid ? "#86efac" : "#fde047"}` }}>
      {paid ? "PAID" : "PENDING"}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function SubscriptionsDataTable({
  rows, page, totalPages, loading,
  onPrev, onNext, onOpenVps, onOpenBilling,
}: {
  rows: SubRow[]; page: number; totalPages: number; loading: boolean;
  onPrev: () => void; onNext: () => void;
  onOpenVps: (s: SubRow) => void; onOpenBilling: (s: SubRow) => void;
}) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${CLR.border}` }}>
      <div style={{ overflowX: "auto" }}>
        <Table cols={["Customer", "Market", "Category", "Product ID", "Product", "Status", "Payment", "Expiry", "Server", "Billing"]}>
          <tbody>
          {rows.length === 0 && !loading && (
            <tr>
              <td colSpan={10} style={{ padding: "40px 20px", textAlign: "center", color: "#9ca3af", fontSize: 13.5 }}>
                No subscriptions found.
              </td>
            </tr>
          )}
          {rows.map(s => {
            const hasServer = s.servers.some(x => x.hetznerServerId) || s.servers.some(x => (x as any).oracleInstanceId);
            const catName   = s.product.category?.name ?? "—";
            return (
              <TR key={s.id}>
                <TD>
                  <div style={{ fontSize: 13 }}>{s.user.email}</div>
                </TD>
                <TD muted>{s.market.name}</TD>
                <TD muted>{catName}</TD>
                <TD mono muted>{s.product.key}</TD>
                <TD style={{ fontWeight: 500 }}>{s.product.name}</TD>
                <TD><StatusBadgeInline status={s.status} /></TD>
                <TD><PayBadge status={s.paymentStatus} activatedAt={s.activatedAt} /></TD>
                <ExpiryCell endIso={s.currentPeriodEnd} status={s.status} />
                <TD>
                  <button
                    onClick={() => onOpenVps(s)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 9px", cursor: "pointer",
                      fontFamily: "inherit",
                      background: hasServer ? CLR.primaryBg : "#fff",
                      color: hasServer ? CLR.primary : "#9ca3af",
                      border: `1px solid ${hasServer ? "#a7d9d1" : CLR.border}`,
                    }}
                  >
                    {hasServer ? "VPS ✓" : "Set VPS"}
                  </button>
                </TD>
                <TD>
                  <button
                    onClick={() => onOpenBilling(s)}
                    style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 9px", cursor: "pointer",
                      fontFamily: "inherit",
                      background: "#fff", color: "#374151", border: `1px solid ${CLR.border}`,
                    }}
                  >
                    Billing
                  </button>
                </TD>
              </TR>
            );
          })}
          </tbody>
        </Table>
      </div>

      {/* Pagination */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", borderTop: `1px solid ${CLR.border}`,
      }}>
        <button
          onClick={onPrev}
          disabled={loading || page <= 1}
          style={{
            padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: page <= 1 || loading ? "not-allowed" : "pointer",
            background: "#fff", color: "#374151", border: `1px solid ${CLR.border}`,
            fontFamily: "inherit", opacity: page <= 1 || loading ? 0.4 : 1,
          }}
        >← Prev</button>
        <span style={{ fontSize: 12, color: "#6b7280" }}>Page {page} of {totalPages}</span>
        <button
          onClick={onNext}
          disabled={loading || page >= totalPages}
          style={{
            padding: "5px 12px", fontSize: 12, fontWeight: 500, cursor: page >= totalPages || loading ? "not-allowed" : "pointer",
            background: "#fff", color: "#374151", border: `1px solid ${CLR.border}`,
            fontFamily: "inherit", opacity: page >= totalPages || loading ? 0.4 : 1,
          }}
        >Next →</button>
      </div>
    </div>
  );
}
