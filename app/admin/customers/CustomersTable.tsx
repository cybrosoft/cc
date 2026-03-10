"use client";
// app/admin/customers/CustomersTable.tsx
// Step 6 restyled — same API, same data, new flat UI

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  PageShell, Card, Table, TR, TD, StatusBadge, TypeBadge, TagPill,
  Btn, Input, Select, FiltersBar, Alert, Empty, Pagination, CLR,
} from "@/components/ui/admin-ui";

type Tag   = { id: string; key: string; name: string };
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

type Resp = { ok: true; data: CustomerRow[]; total: number; page: number; pageSize: number } | { ok: false; error: string };

export default function CustomersTable() {
  const [resp, setResp]       = useState<Resp | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [page, setPage]       = useState(1);

  // Filters
  const [fSearch, setFSearch]   = useState("");
  const [fMarket, setFMarket]   = useState("");
  const [fRole, setFRole]       = useState("");
  const [fAccount, setFAccount] = useState("");

  const total     = (resp as any)?.total ?? 0;
  const pageSize  = (resp as any)?.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const load = useCallback(async (p = page) => {
    setLoading(true); setError(null);
    try {
      const qs = new URLSearchParams({ page: String(p) });
      if (fSearch)  qs.set("search",   fSearch.trim());
      if (fMarket)  qs.set("marketId", fMarket);
      if (fRole)    qs.set("role",     fRole);
      if (fAccount) qs.set("accountType", fAccount);
      const [cr, mr] = await Promise.all([
        fetch(`/api/admin/users?${qs}`).then(r => r.json()).catch(() => null),
        fetch("/api/admin/markets").then(r => r.json()).catch(() => null),
      ]);
      if (cr?.ok) setResp(cr); else setError(cr?.error ?? "Failed to load");
      if (mr?.ok) setMarkets(mr.data ?? []);
    } catch { setError("Network error"); }
    finally { setLoading(false); }
  }, [page, fSearch, fMarket, fRole, fAccount]);

  useEffect(() => { void load(); }, [page]);

  function applyFilters() { setPage(1); void load(1); }

  const rows: CustomerRow[] = (resp as any)?.data ?? [];

  return (
    <PageShell
      breadcrumb="ADMIN / CUSTOMERS"
      title="Customers"
      ctaLabel="New Customer"
      ctaOnClick={() => window.location.href = "/admin/customers/new"}
    >
      
        {error && <div style={{ marginBottom: 16 }}><Alert type="error">{error}</Alert></div>}

        <Card>
          {/* Filters */}
          <FiltersBar>
            <Input value={fSearch} onChange={setFSearch} placeholder="Search name, email, company…" style={{ width: 260 }} />
            <Select value={fMarket} onChange={setFMarket} style={{ minWidth: 140 }}>
              <option value="">All Markets</option>
              {markets.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </Select>
            <Select value={fRole} onChange={setFRole} style={{ minWidth: 130 }}>
              <option value="">All Roles</option>
              <option value="CUSTOMER">Customer</option>
              <option value="ADMIN">Admin</option>
              <option value="STAFF">Staff</option>
            </Select>
            <Select value={fAccount} onChange={setFAccount} style={{ minWidth: 140 }}>
              <option value="">All Account Types</option>
              <option value="BUSINESS">Business</option>
              <option value="PERSONAL">Personal</option>
            </Select>
            <Btn variant="outline" onClick={applyFilters}>Search</Btn>
            {(fSearch || fMarket || fRole || fAccount) && (
              <Btn variant="ghost" onClick={() => { setFSearch(""); setFMarket(""); setFRole(""); setFAccount(""); setPage(1); void load(1); }}>Clear</Btn>
            )}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>
              {total} customer{total !== 1 ? "s" : ""}
            </span>
          </FiltersBar>

          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading…</div>
          ) : rows.length === 0 ? (
            <Empty message="No customers found." />
          ) : (
            <Table cols={["#", "Customer", "Market", "Group", "Account", "Tags", "Subs", "Servers", "Joined", ""]}>
              <tbody>
              {rows.map(c => (
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

          <Pagination page={page} total={totalPages} onPrev={() => setPage(p => Math.max(1, p-1))} onNext={() => setPage(p => Math.min(totalPages, p+1))} />
        </Card>
    </PageShell>
  );
}
