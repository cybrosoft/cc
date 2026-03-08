// FILE: app/admin/customers/ui/CustomersTable.tsx
"use client";

import Link      from "next/link";
import { useState, useMemo } from "react";

type Tag           = { id: string; key: string; name: string };
type MarketOption  = { id: string; name: string; key: string };
type GroupOption   = { id: string; name: string; key: string };
type AccountType   = "BUSINESS" | "PERSONAL";

type Customer = {
  id:             string;
  customerNumber: number;
  email:          string;
  fullName:       string | null;
  accountType:    AccountType | null;
  country:        string | null;
  city:           string | null;
  createdAt:      string;
  market:         { name: string; key: string };
  customerGroup:  { name: string; key: string } | null;
  tags:           Tag[];
  subscriptions:  { id: string }[];
  servers:        { id: string }[];
};

const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  BUSINESS: "border-blue-200 bg-blue-50 text-blue-700",
  PERSONAL: "border-gray-200 bg-gray-50 text-gray-600",
};

export default function CustomersTable({
  customers, markets, groups, tags,
}: {
  customers: Customer[];
  markets:   MarketOption[];
  groups:    GroupOption[];
  tags:      Tag[];
}) {
  const [fSearch,  setFSearch]  = useState("");
  const [fMarket,  setFMarket]  = useState("");
  const [fGroup,   setFGroup]   = useState("");
  const [fTag,     setFTag]     = useState("");
  const [fType,    setFType]    = useState("");
  const [fCountry, setFCountry] = useState("");

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (fSearch) {
        const q = fSearch.toLowerCase();
        const match =
          c.email.toLowerCase().includes(q) ||
          c.fullName?.toLowerCase().includes(q) ||
          String(c.customerNumber).includes(q) ||
          c.city?.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (fMarket  && c.market.key       !== fMarket)  return false;
      if (fGroup   && c.customerGroup?.key !== fGroup)  return false;
      if (fType    && c.accountType       !== fType)    return false;
      if (fCountry && c.country           !== fCountry) return false;
      if (fTag     && !c.tags.some((t) => t.key === fTag)) return false;
      return true;
    });
  }, [customers, fSearch, fMarket, fGroup, fTag, fType, fCountry]);

  const countries = useMemo(() =>
    [...new Set(customers.map((c) => c.country).filter(Boolean))] as string[],
  [customers]);

  const hasFilters = fSearch || fMarket || fGroup || fTag || fType || fCountry;

  function clearFilters() {
    setFSearch(""); setFMarket(""); setFGroup("");
    setFTag(""); setFType(""); setFCountry("");
  }

  return (
    <div className="space-y-4">

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white px-4 py-3 shadow-sm">
        <input
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300"
          style={{ width: 220 }}
          placeholder="Search email, name, #, city…"
          value={fSearch} onChange={(e) => setFSearch(e.target.value)}
        />

        <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300"
          value={fMarket} onChange={(e) => setFMarket(e.target.value)}>
          <option value="">All Markets</option>
          {markets.map((m) => <option key={m.id} value={m.key}>{m.name}</option>)}
        </select>

        <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300"
          value={fGroup} onChange={(e) => setFGroup(e.target.value)}>
          <option value="">All Groups</option>
          {groups.map((g) => <option key={g.id} value={g.key}>{g.name}</option>)}
        </select>

        <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300"
          value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="">All Types</option>
          <option value="BUSINESS">Business</option>
          <option value="PERSONAL">Personal</option>
        </select>

        <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300"
          value={fTag} onChange={(e) => setFTag(e.target.value)}>
          <option value="">All Tags</option>
          {tags.map((t) => <option key={t.id} value={t.key}>{t.name}</option>)}
        </select>

        <select className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-gray-300"
          value={fCountry} onChange={(e) => setFCountry(e.target.value)}>
          <option value="">All Countries</option>
          {countries.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        {hasFilters && (
          <button onClick={clearFilters} className="text-xs text-gray-400 underline hover:text-gray-600">
            Clear
          </button>
        )}

        <span className="ml-auto text-xs text-gray-400">
          {filtered.length} of {customers.length}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Market</th>
                <th className="px-4 py-3">Group</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3">Country</th>
                <th className="px-4 py-3 text-center">Subs</th>
                <th className="px-4 py-3 text-center">Servers</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm text-gray-400">
                    {hasFilters ? "No customers match the filters." : "No customers yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b last:border-b-0 hover:bg-gray-50/60 transition-colors">

                    {/* # */}
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {c.customerNumber}
                    </td>

                    {/* Customer — email + full name */}
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900 text-sm">{c.email}</div>
                      {c.fullName && (
                        <div className="text-[11px] text-gray-400">{c.fullName}</div>
                      )}
                    </td>

                    {/* Account type */}
                    <td className="px-4 py-3">
                      {c.accountType ? (
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ACCOUNT_TYPE_COLORS[c.accountType]}`}>
                          {c.accountType === "BUSINESS" ? "🏢" : "👤"} {c.accountType.charAt(0) + c.accountType.slice(1).toLowerCase()}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Market */}
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {c.market.name}
                      <span className="ml-1 text-[10px] text-gray-400">({c.market.key})</span>
                    </td>

                    {/* Group */}
                    <td className="px-4 py-3">
                      {c.customerGroup ? (
                        <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                          {c.customerGroup.name}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Tags */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.tags.length === 0
                          ? <span className="text-gray-300 text-xs">—</span>
                          : c.tags.map((t) => (
                            <span key={t.id}
                              className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                              {t.name}
                            </span>
                          ))
                        }
                      </div>
                    </td>

                    {/* Country / City */}
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {c.country ?? <span className="text-gray-300">—</span>}
                      {c.city && <div className="text-[11px] text-gray-400">{c.city}</div>}
                    </td>

                    {/* Subscriptions */}
                    <td className="px-4 py-3 text-center">
                      {c.subscriptions.length > 0
                        ? <span className="inline-flex items-center justify-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-[11px] font-semibold text-green-700">{c.subscriptions.length}</span>
                        : <span className="text-gray-300 text-xs">0</span>
                      }
                    </td>

                    {/* Servers */}
                    <td className="px-4 py-3 text-center">
                      {c.servers.length > 0
                        ? <span className="inline-flex items-center justify-center rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-700">{c.servers.length}</span>
                        : <span className="text-gray-300 text-xs">0</span>
                      }
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString("en-GB", {
                        day: "2-digit", month: "short", year: "numeric",
                      })}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/customers/${encodeURIComponent(c.id)}/edit`}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}