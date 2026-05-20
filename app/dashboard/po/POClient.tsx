"use client";
// app/dashboard/po/POClient.tsx

import { useEffect, useState } from "react";
import { colors } from "@/lib/ui/tokens";

interface PORow {
  id:         string;
  docNum:     string;
  type:       string;
  status:     string;
  currency:   string;
  total:      number;
  subject:    string | null;
  createdAt:  string;
  rfqFileUrl: string | null;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function Sk({ w = "100%", h = 13 }: { w?: string | number; h?: number }) {
  return <span className="cy-shimmer" style={{ width: w, height: h, display: "inline-block" }} />;
}

function docTypeLabel(row: PORow): string {
  if (row.type === "PO")        return "PO Issued";
  if (row.rfqFileUrl)           return "Quote Accepted & PO Issued";
  return "Quote Accepted";
}

function PODownloadBtn({ docId }: { docId: string }) {
  const [loading, setLoading] = useState(false);

  async function download(e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation();
    setLoading(true);
    try {
      const res  = await fetch(`/api/customer/sales/${docId}/po-file`);
      const data = await res.json();
      if (data.url) window.open(data.url, "_blank");
    } catch { /**/ }
    setLoading(false);
  }

  return (
    <button onClick={download} disabled={loading}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, padding: "5px 10px", background: "#fff", color: "#374151", border: "1px solid #d1d5db", cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1, whiteSpace: "nowrap" }}>
      <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M1 11v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
      {loading ? "…" : "Download"}
    </button>
  );
}

export function POClient() {
  const [rows,    setRows]    = useState<PORow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/customer/sales?type=PO&limit=100").then(r => r.json()),
      fetch("/api/customer/sales?type=QUOTATION&limit=100").then(r => r.json()),
    ]).then(([poData, quotData]) => {
      const pos: PORow[] = (poData.documents ?? []).map((d: any) => ({
        id: d.id, docNum: d.docNum, type: d.type, status: d.status,
        currency: d.currency, total: d.total, subject: d.subject ?? null,
        createdAt: d.createdAt, rfqFileUrl: d.rfqFileUrl ?? null,
      }));

      const accepted: PORow[] = (quotData.documents ?? [])
        .filter((d: any) => d.status === "ACCEPTED")
        .map((d: any) => ({
          id: d.id, docNum: d.docNum, type: d.type, status: d.status,
          currency: d.currency, total: d.total, subject: d.subject ?? null,
          createdAt: d.createdAt, rfqFileUrl: d.rfqFileUrl ?? null,
        }));

      const combined = [...pos, ...accepted];
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRows(combined);
    }).finally(() => setLoading(false));
  }, []);

  const col = "120px 1fr 1fr auto";

  return (
    <>
      <style>{`
        @keyframes cy-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .cy-shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%);background-size:800px 100%;animation:cy-shimmer 1.4s ease-in-out infinite;border-radius:4px;}
        .cy-po-row:hover{background:#f5faf8!important;}
      `}</style>
      <div className="cy-page-content"><div className="cy-dash-wrap">
        <div style={{ marginBottom: 20 }}>
          <h1 className="cy-page-title" style={{ margin: "0 0 3px" }}>Issued PO</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
            {loading ? "Loading…" : `${rows.length} purchase order${rows.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div style={{ background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: col, gap: 12, padding: "9px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            {["Date", "Doc Number", "Doc Type", "Actions"].map((h, i) => (
              <span key={h} style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: "0.05em", textAlign: i === 3 ? "right" as const : "left" as const }}>
                {h}
              </span>
            ))}
          </div>

          {/* Skeletons */}
          {loading && [1,2,3].map(i => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: col, gap: 12, padding: "13px 16px", borderBottom: "1px solid #f3f4f6", alignItems: "center" }}>
              <Sk w="80px" h={12} /><Sk w="110px" h={12} /><Sk w="130px" h={12} /><Sk w="60px" h={28} />
            </div>
          ))}

          {/* Empty */}
          {!loading && rows.length === 0 && (
            <div style={{ padding: "40px 16px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
              No purchase orders yet.
            </div>
          )}

          {/* Rows */}
          {!loading && rows.map((row, idx) => {
            const isPO            = row.type === "PO";
            const isAcceptedQuote = row.type === "QUOTATION";
            const hasPOFile       = !!row.rfqFileUrl;
            // PO (admin issued) → download attached doc; Quotation → view quote page
            const viewHref        = `/dashboard/sales/${row.id}?from=${isAcceptedQuote ? "quotations" : "po"}`;
            const isLast          = idx === rows.length - 1;

            return (
              <div key={row.id} className="cy-po-row"
                style={{ display: "grid", gridTemplateColumns: col, gap: 12, padding: "12px 16px", borderBottom: isLast ? "none" : "1px solid #f3f4f6", alignItems: "center", transition: "background 0.1s" }}>

                {/* Date */}
                <span style={{ fontSize: 12.5, color: "#6b7280", whiteSpace: "nowrap" }}>
                  {fmtDate(row.createdAt)}
                </span>

                {/* Doc Number */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", fontFamily: "monospace" }}>{row.docNum}</div>
                  {row.subject && <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2 }}>{row.subject}</div>}
                </div>

                {/* Doc Type */}
                <span style={{ fontSize: 12.5, color: "#374151" }}>
                  {docTypeLabel(row)}
                </span>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
                  {/* Accepted quotes → View button only */}
                  {isAcceptedQuote && (
                    <a href={viewHref}
                      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, padding: "5px 10px", background: "#fff", color: colors.primary, border: `1px solid ${colors.primary}44`, textDecoration: "none", whiteSpace: "nowrap" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      View
                    </a>
                  )}
                  {/* Admin PO → Download button (if file attached) */}
                  {isPO && hasPOFile && <PODownloadBtn docId={row.id} />}
                  {/* Admin PO with no file → nothing */}
                </div>
              </div>
            );
          })}
        </div>
      </div></div>
    </>
  );
}
