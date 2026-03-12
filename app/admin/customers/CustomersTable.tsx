"use client";
// app/admin/customers/CustomersTable.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  PageShell, Card, Table, TR, TD, TypeBadge, TagPill,
  Btn, Input, Select, FiltersBar, Alert, Empty, CLR,
} from "@/components/ui/admin-ui";

type Tag    = { id: string; key: string; name: string };
type Market = { id: string; key: string; name: string };
type CustomerRow = {
  id: string; customerNumber: number; email: string; fullName: string | null;
  mobile: string | null; companyName: string | null; accountType: string | null;
  role: string; createdAt: string;
  market: { id: string; name: string; key: string };
  customerGroup: { id: string; name: string } | null;
  tags: Tag[];
  _count: { subscriptions: number; servers: number };
};

export default function CustomersTable() {
  const [rows, setRows]       = useState<CustomerRow[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  // Instant client-side filters
  const [fSearch,  setFSearch]  = useState("");
  const [fMarket,  setFMarket]  = useState("");
  const [fRole,    setFRole]    = useState("");
  const [fAccount, setFAccount] = useState("");

  // Load ALL customers once
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

  // Client-side filtering
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
      return true;
    });
  }, [rows, fSearch, fMarket, fRole, fAccount]);

  const hasFilters = fSearch || fMarket || fRole || fAccount;

  function clearFilters() {
    setFSearch(""); setFMarket(""); setFRole(""); setFAccount("");
  }

  return (
    <PageShell
      breadcrumb="ADMIN / CUSTOMERS"
      title="Customers"
      ctaLabel="New Customer"
      ctaOnClick={() => window.location.href = "/admin/customers/new"}
    >
      {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

      <Card>
        {/* ── Filter bar ── */}
        <FiltersBar>
          <Input
            value={fSearch} onChange={setFSearch}
            placeholder="Search name, email, #…"
            style={{ width: 240, maxWidth: "100%" }}
          />
          <Select value={fMarket} onChange={setFMarket} style={{ width: 140, maxWidth: "100%" }}>
            <option value="">All Markets</option>
            {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Select value={fRole} onChange={setFRole} style={{ width: 140, maxWidth: "100%" }}>
            <option value="">All Roles</option>
            <option value="CUSTOMER">Customer</option>
            <option value="ADMIN">Admin</option>
            <option value="STAFF">Staff</option>
          </Select>
          <Select value={fAccount} onChange={setFAccount} style={{ width: 160, maxWidth: "100%" }}>
            <option value="">All Account Types</option>
            <option value="BUSINESS">Business</option>
            <option value="PERSONAL">Personal</option>
          </Select>
          {hasFilters && (
            <Btn variant="ghost" onClick={clearFilters}>Clear</Btn>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>
            {filtered.length} of {rows.length} customer{rows.length !== 1 ? "s" : ""}
          </span>
        </FiltersBar>

        {/* ── Table ── */}
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading…</div>
        ) : rows.length === 0 ? (
          <Empty message="No customers yet." />
        ) : filtered.length === 0 ? (
          <Empty message="No customers match the filters." />
        ) : (
          <Table cols={["#", "Customer", "Market", "Group", "Account", "Tags", "Subs", "Servers", "Joined", ""]}>
            <tbody>
              {filtered.map(c => (
                <TR key={c.id}>
                  <TD mono muted>{c.customerNumber}</TD>
                  <TD>
                    <div style={{ fontWeight: 500 }}>{c.fullName ?? <span style={{ color: "#9ca3af" }}>No name</span>}</div>
                    <div style={{ fontSize: 11.5, color: "#6b7280" }}>{c.email}</div>
                    {c.companyName && <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.companyName}</div>}
                  </TD>
                  <TD muted>{c.market.name}</TD>
                  <TD muted>{c.customerGroup?.name ?? <span style={{ color: "#d1d5db" }}>—</span>}</TD>
                  <TD>
                    {c.accountType
                      ? <TypeBadge value={c.accountType} />
                      : <span style={{ color: "#d1d5db", fontSize: 12 }}>—</span>
                    }
                  </TD>
                  <TD>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                      {c.tags.map(t => <TagPill key={t.id} label={t.name} color="gray" />)}
                    </div>
                  </TD>
                  <TD>
                    {c._count.subscriptions > 0 ? (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", background: CLR.primaryBg, color: CLR.primary, border: "1px solid #a7d9d1" }}>
                        {c._count.subscriptions}
                      </span>
                    ) : (
                      <span style={{ color: "#d1d5db", fontSize: 12 }}>0</span>
                    )}
                  </TD>
                  <TD>
                    {c._count.servers > 0 ? (
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 7px", background: "#f5f3ff", color: "#7c3aed", border: "1px solid #ddd6fe" }}>
                        {c._count.servers}
                      </span>
                    ) : (
                      <span style={{ color: "#d1d5db", fontSize: 12 }}>0</span>
                    )}
                  </TD>
                  <TD muted style={{ whiteSpace: "nowrap" }}>
                    {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                  </TD>
                  <TD right>
                    <Link href={`/admin/customers/${encodeURIComponent(c.id)}/edit`}>
                      <Btn variant="outline">Edit</Btn>
                    </Link>
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