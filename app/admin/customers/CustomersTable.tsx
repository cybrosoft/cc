"use client";
// app/admin/customers/CustomersTable.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PageShell, Card, Table, TR, TD, TypeBadge, TagPill,
  Btn, Input, Select, FiltersBar, Alert, Empty, CLR,
} from "@/components/ui/admin-ui";

type Tag    = { id: string; key: string; name: string };
type Market = { id: string; key: string; name: string };
type CustomerRow = {
  id: string; customerNumber: number; email: string; fullName: string | null;
  mobile: string | null; companyName: string | null; accountType: string | null;
  role: string; status: string; createdAt: string;
  market: { id: string; name: string; key: string };
  customerGroup: { id: string; name: string } | null;
  tags: Tag[];
  _count: { subscriptions: number; servers: number };
};

const STATUS_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  ACTIVE:        { bg: "#e8f5f0", color: "#166534",  border: "#a7d9d1" },
  PENDING:       { bg: "#fff8e6", color: "#92400e",  border: "#fcd34d" },
  INFO_REQUIRED: { bg: "#fdf0ef", color: "#991b1b",  border: "#fca5a5" },
  SUSPENDED:     { bg: "#f3f4f6", color: "#374151",  border: "#d1d5db" },
  REJECTED:      { bg: "#fdf0ef", color: "#7f1d1d",  border: "#fca5a5" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] ?? { bg: "#f3f4f6", color: "#6b7280", border: "#e5e7eb" };
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: "0.05em",
      textTransform: "uppercase", padding: "2px 8px",
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: "nowrap",
    }}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function CustomersTable() {
  const router = useRouter();
  const [rows, setRows]       = useState<CustomerRow[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const [fSearch,  setFSearch]  = useState("");
  const [fMarket,  setFMarket]  = useState("");
  const [fRole,    setFRole]    = useState("");
  const [fAccount, setFAccount] = useState("");
  const [fStatus,  setFStatus]  = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [cr, mr] = await Promise.all([
        fetch("/api/admin/users?pageSize=9999").then(r => r.json()).catch(() => null),
        fetch("/api/admin/markets").then(r => r.json()).catch(() => null),
      ]);
      if (cr?.ok) setRows(cr.data ?? []);
      else setError(cr?.error ?? "Failed to load customers");
      if (mr?.ok) setMarkets(mr.data ?? []);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    return rows.filter(c => {
      if (fSearch) {
        const q = fSearch.toLowerCase();
        const match =
          c.email.toLowerCase().includes(q) ||
          c.fullName?.toLowerCase().includes(q) ||
          c.companyName?.toLowerCase().includes(q) ||
          String(c.customerNumber).includes(q);
        if (!match) return false;
      }
      if (fMarket  && c.market.id   !== fMarket)   return false;
      if (fRole    && c.role        !== fRole)      return false;
      if (fAccount && c.accountType !== fAccount)   return false;
      if (fStatus  && c.status      !== fStatus)    return false;
      return true;
    });
  }, [rows, fSearch, fMarket, fRole, fAccount, fStatus]);

  const hasFilters = fSearch || fMarket || fRole || fAccount || fStatus;

  function clearFilters() {
    setFSearch(""); setFMarket(""); setFRole(""); setFAccount(""); setFStatus("");
  }

  return (
    <PageShell
      breadcrumb="ADMIN / CUSTOMERS"
      title="Customers"
      ctaLabel="New Customer"
      ctaOnClick={() => router.push("/admin/customers/new")}
    >
      {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

      <Card>
        <FiltersBar>
          <Input
            value={fSearch} onChange={setFSearch}
            placeholder="Search name, email, #…"
            style={{ width: 220, maxWidth: "100%" }}
          />
          <Select value={fMarket} onChange={setFMarket} style={{ width: 140, maxWidth: "100%" }}>
            <option value="">All Markets</option>
            {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select value={fStatus} onChange={setFStatus} style={{ width: 160, maxWidth: "100%" }}>
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="INFO_REQUIRED">Info Required</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="REJECTED">Rejected</option>
          </Select>
          <Select value={fRole} onChange={setFRole} style={{ width: 130, maxWidth: "100%" }}>
            <option value="">All Roles</option>
            <option value="CUSTOMER">Customer</option>
            <option value="ADMIN">Admin</option>
            <option value="STAFF">Staff</option>
          </Select>
          <Select value={fAccount} onChange={setFAccount} style={{ width: 150, maxWidth: "100%" }}>
            <option value="">All Account Types</option>
            <option value="BUSINESS">Business</option>
            <option value="PERSONAL">Personal</option>
          </Select>
          {hasFilters && <Btn variant="ghost" onClick={clearFilters}>Clear</Btn>}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>
            {filtered.length} of {rows.length} customer{rows.length !== 1 ? "s" : ""}
          </span>
        </FiltersBar>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <Empty message="No customers yet." />
        ) : filtered.length === 0 ? (
          <Empty message="No customers match the filters." />
        ) : (
          <Table cols={["#", "Customer", "Status", "Market", "Group", "Account", "Tags", "Subs", "Servers", "Joined"]}>
            <tbody>
              {filtered.map(c => (
                <TR
                  key={c.id}
                  onClick={() => router.push(`/admin/customers/${encodeURIComponent(c.id)}/edit`)}
                  style={{ cursor: "pointer" }}
                >
                  <TD mono muted>{c.customerNumber}</TD>
                  <TD>
                    <div style={{ fontWeight: 500 }}>{c.fullName ?? <span style={{ color: "#9ca3af" }}>No name</span>}</div>
                    <div style={{ fontSize: 11.5, color: "#6b7280" }}>{c.email}</div>
                    {c.companyName && <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.companyName}</div>}
                  </TD>
                  <TD><StatusBadge status={c.status} /></TD>
                  <TD muted>{c.market.name}</TD>
                  <TD muted>{c.customerGroup?.name ?? <span style={{ color: "#d1d5db" }}>—</span>}</TD>
                  <TD>
                    {c.accountType
                      ? <TypeBadge value={c.accountType} />
                      : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>}
                  </TD>
                  <TD>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {c.tags.map(t => <TagPill key={t.id} label={t.name} color="gray" />)}
                    </div>
                  </TD>
                  <TD>
                    {c._count.subscriptions > 0
                      ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", background: CLR.primaryBg, color: CLR.primary, border: "1px solid #a7d9d1" }}>{c._count.subscriptions}</span>
                      : <span style={{ color: "#d1d5db", fontSize: 12 }}>0</span>}
                  </TD>
                  <TD>
                    {c._count.servers > 0
                      ? <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe" }}>{c._count.servers}</span>
                      : <span style={{ color: "#d1d5db", fontSize: 12 }}>0</span>}
                  </TD>
                  <TD muted style={{ whiteSpace: "nowrap" }}>
                    {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </PageShell>
  );
}
