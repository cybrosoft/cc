"use client";
// app/dashboard/delivery-notes/DeliveryNotesClient.tsx

import { useEffect, useState } from "react";
import Link from "next/link";

interface DN {
  id: string; docNum: string; status: string; currency: string;
  total: number; subject: string | null; issueDate: string; createdAt: string;
}

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const SC: Record<string, string> = {
  ISSUED: "#185FA5", SENT: "#185FA5", DELIVERED: "#0F6E56",
  CONVERTED: "#6d28d9", CANCELLED: "#991b1b", VOID: "#6b7280",
};
function Badge({ status }: { status: string }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: SC[status] ?? "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
function Sk({ w = "100%", h = 13 }: { w?: string | number; h?: number }) {
  return <span className="cy-shimmer" style={{ width: w, height: h, display: "inline-block" }} />;
}

export function DeliveryNotesClient() {
  const [docs, setDocs] = useState<DN[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/customer/sales?type=DELIVERY_NOTE&limit=100")
      .then(r => r.json())
      .then(d => {
        const list: DN[] = d.documents ?? [];
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setDocs(list);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <style>{`
        @keyframes cy-shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
        .cy-shimmer{background:linear-gradient(90deg,#f0f0f0 25%,#e4e4e4 50%,#f0f0f0 75%);background-size:800px 100%;animation:cy-shimmer 1.4s ease-in-out infinite;border-radius:4px;}
        .cy-lrow:hover{background:#f5faf8!important;}
      `}</style>
      <div className="cy-page-content"><div className="cy-dash-wrap">
        <div style={{ marginBottom: 20 }}>
          <h1 className="cy-page-title" style={{ margin: "0 0 3px" }}>Delivery Notes</h1>
          <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
            {loading ? "Loading…" : `${docs.length} delivery note${docs.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", overflow: "hidden" }}>
          <div style={{ display: "flex", padding: "9px 16px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
            <span style={{ flex: 3,   fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Document</span>
            <span style={{ flex: 1.2, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em" }}>Date</span>
            <span style={{ flex: 1.2, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" as const }}>Amount</span>
            <span style={{ flex: 1.2, fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "right" as const }}>Status</span>
          </div>
          {loading
            ? [1,2,3,4].map(i => (
                <div key={i} style={{ display: "flex", padding: "12px 16px", borderBottom: "1px solid #f3f4f6", gap: 8 }}>
                  <div style={{ flex: 3 }}><Sk w="50%" h={12} /></div>
                  <div style={{ flex: 1.2 }}><Sk w="80%" h={12} /></div>
                  <div style={{ flex: 1.2, textAlign: "right" as const }}><Sk w="60%" h={12} /></div>
                  <div style={{ flex: 1.2, textAlign: "right" as const }}><Sk w="70%" h={12} /></div>
                </div>
              ))
            : docs.length === 0
              ? (
                <div style={{ padding: "40px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 4 }}>No delivery notes yet</div>
                  <div style={{ fontSize: 12.5, color: "#9ca3af" }}>Delivery notes will appear here once issued by our team.</div>
                </div>
              )
              : docs.map((doc, idx) => (
                  <Link key={doc.id} href={`/dashboard/sales/${doc.id}`} className="cy-lrow"
                    style={{ display: "flex", alignItems: "center", padding: "11px 16px", borderBottom: idx < docs.length - 1 ? "1px solid #f3f4f6" : "none", textDecoration: "none", transition: "background 0.1s" }}>
                    <div style={{ flex: 3, minWidth: 0, paddingRight: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", fontFamily: "monospace" }}>{doc.docNum}</div>
                      {doc.subject && <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.subject}</div>}
                    </div>
                    <span style={{ flex: 1.2, fontSize: 12.5, color: "#6b7280" }}>{fmtDate(doc.issueDate)}</span>
                    <span style={{ flex: 1.2, fontSize: 12.5, fontWeight: 500, color: "#111827", textAlign: "right" as const, paddingRight: 16 }}>
                      {doc.total > 0 ? fmt(doc.total, doc.currency) : "—"}
                    </span>
                    <div style={{ flex: 1.2, display: "flex", justifyContent: "flex-end" }}>
                      <Badge status={doc.status} />
                    </div>
                  </Link>
                ))
          }
        </div>
      </div></div>
    </>
  );
}
