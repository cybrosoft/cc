"use client";
// app/dashboard/sales/[id]/SalesDocClient.tsx

import { useState } from "react";
import Link from "next/link";
import { colors } from "@/lib/ui/tokens";

interface Line {
  id: string; description: string; descriptionAr: string | null;
  billingPeriod: string | null; quantity: number; unitPrice: number;
  discount: number; lineTotal: number;
  product: { id: string; name: string; key: string } | null;
}
interface Payment {
  id: string; method: string; amountCents: number;
  currency: string; reference: string | null; paidAt: string;
}
interface DocRef { id: string; docNum: string; type: string; status: string; }
interface Doc {
  id: string; docNum: string; type: string; status: string;
  currency: string; subtotal: number; vatPercent: number;
  vatAmount: number; total: number; amountPaid: number; balance: number;
  subject: string | null; notes: string | null;
  termsAndConditions: string | null; referenceNumber: string | null;
  rfqTitle: string | null; pdfKey: string | null; language: string;
  issueDate: string; dueDate: string | null; validUntil: string | null;
  paidAt: string | null; createdAt: string;
  market: {
    name: string; key: string; currency: string;
    vatPercent: number; legalInfo: Record<string, string> | null;
  };
  customer: {
    fullName: string | null; companyName: string | null;
    accountType: string; email: string;
    addressLine1: string | null; addressLine2: string | null;
    district: string | null; city: string | null;
    province: string | null; country: string | null;
    vatTaxId: string | null; crn: string | null;
  };
  lines: Line[]; payments: Payment[];
  originDoc: DocRef | null; derivedDocs: DocRef[];
}

function fmt(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: 2 }).format(cents / 100);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function joinParts(...parts: (string | null | undefined)[]): string | null {
  const r = parts.filter(Boolean).join(", ");
  return r || null;
}

const TYPE_LABELS: Record<string, string> = {
  INVOICE: "Invoice", QUOTATION: "Quotation", PROFORMA: "Proforma Invoice",
  DELIVERY_NOTE: "Delivery Note", CREDIT_NOTE: "Credit Note",
  PO: "Purchase Order", RFQ: "Request for Quotation",
};

const STATUS_TEXT: Record<string, string> = {
  ISSUED: "#185FA5", SENT: "#185FA5", REVISED: "#854F0B",
  ACCEPTED: "#0F6E56", PAID: "#0F6E56", PARTIALLY_PAID: "#0F6E56",
  OVERDUE: "#991b1b", CONVERTED: "#6d28d9", DELIVERED: "#0F6E56",
  PENDING: "#854F0B", REJECTED: "#991b1b", EXPIRED: "#6b7280",
  VOID: "#6b7280", APPLIED: "#0F6E56", CANCELLED: "#991b1b",
};

function StatusText({ status }: { status: string }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_TEXT[status] ?? "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function backLink(type: string) {
  switch (type) {
    case "QUOTATION":     return { href: "/dashboard/quotations",     label: "Quotations"        };
    case "INVOICE":       return { href: "/dashboard/invoices",       label: "Invoices"          };
    case "CREDIT_NOTE":   return { href: "/dashboard/invoices",       label: "Invoices"          };
    case "PROFORMA":      return { href: "/dashboard/proforma",       label: "Proforma Invoices" };
    case "DELIVERY_NOTE": return { href: "/dashboard/delivery-notes", label: "Delivery Notes"    };
    default:              return { href: "/dashboard",                label: "Dashboard"         };
  }
}

// ── Address block ─────────────────────────────────────────────────────────────
function AddrLine({ v }: { v: string | null | undefined }) {
  if (!v) return null;
  return <div style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.6 }}>{v}</div>;
}

function FromAddress({ li, marketName }: { li: Record<string, string> | null; marketName: string }) {
  if (!li) return <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{marketName}</div>;

  const taxLabel  = li.taxLabel ?? "VAT";
  // Address Line 1, Address Line 2, District on one line
  const addrLine1 = joinParts(li.address1, li.address2, li.district);
  // City, State / Province / Region, Postal / ZIP Code on one line
  const addrLine2 = joinParts(li.city, li.state, li.postalCode);

  return (
    <>
      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
        {li.companyName ?? marketName}
      </div>
      <AddrLine v={addrLine1} />
      <AddrLine v={addrLine2} />
      <AddrLine v={li.country} />
      <AddrLine v={li.email} />
      {li.taxNumber && (
        <div style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.6 }}>{taxLabel}: {li.taxNumber}</div>
      )}
    </>
  );
}

function ToAddress({ c, taxLabel }: { c: Doc["customer"]; taxLabel: string }) {
  const isPersonal = c.accountType === "PERSONAL";
  // Address Line 1, Address Line 2 on one line
  const addrLine1  = joinParts(c.addressLine1, c.addressLine2);
  // District, City, Province / Region on one line
  const addrLine2  = joinParts(c.district, c.city, c.province);

  return (
    <>
      {/* Company Name */}
      {c.companyName && (
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{c.companyName}</div>
      )}
      {/* Personal Full Name — only for PERSONAL accounts */}
      {isPersonal && c.fullName && (
        <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{c.fullName}</div>
      )}
      <AddrLine v={addrLine1} />
      <AddrLine v={addrLine2} />
      <AddrLine v={c.country} />
      <AddrLine v={c.email} />
      {c.vatTaxId && (
        <div style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.6 }}>{taxLabel}: {c.vatTaxId}</div>
      )}
    </>
  );
}

function dateItems(doc: Doc) {
  const items: { label: string; value: string }[] = [
    { label: "Issue Date", value: fmtDate(doc.issueDate) },
  ];
  if (doc.dueDate)         items.push({ label: "Due Date",    value: fmtDate(doc.dueDate)    });
  if (doc.validUntil)      items.push({ label: "Valid Until", value: fmtDate(doc.validUntil) });
  if (doc.referenceNumber) items.push({ label: "Reference",   value: doc.referenceNumber     });
  if (doc.paidAt)          items.push({ label: "Paid On",     value: fmtDate(doc.paidAt)     });
  return items;
}

export function SalesDocClient({ doc }: { doc: Doc }) {
  const [accepting,  setAccepting]  = useState(false);
  const [acceptDone, setAcceptDone] = useState(doc.status === "ACCEPTED");
  const [acceptErr,  setAcceptErr]  = useState<string | null>(null);

  const canAccept    = doc.type === "QUOTATION" && ["ISSUED","SENT","REVISED"].includes(doc.status) && !acceptDone;
  const back         = backLink(doc.type);
  const showBalance  = doc.type === "INVOICE" || doc.type === "CREDIT_NOTE";
  const showPayments = showBalance && doc.payments.length > 0;

  async function handleAccept() {
    if (!confirm(`Accept ${doc.docNum}?`)) return;
    setAccepting(true); setAcceptErr(null);
    try {
      const res  = await fetch(`/api/customer/sales/${doc.id}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setAcceptErr(data.error ?? "Failed"); return; }
      setAcceptDone(true);
    } catch { setAcceptErr("Network error."); }
    finally  { setAccepting(false); }
  }

  return (
    <>
      <style>{`
        .cy-back:hover { color: ${colors.primary} !important; }
        .cy-doc-table th, .cy-doc-table td { padding: 10px 14px; }
        .cy-doc-table th { background:#f9fafb; font-size:11px; font-weight:600; color:#6b7280; text-transform:uppercase; letter-spacing:0.05em; border-bottom:1px solid #e5e7eb; text-align:left; }
        .cy-doc-table td { font-size:13px; color:#374151; border-bottom:1px solid #f3f4f6; vertical-align:top; text-align:left; }
        .cy-doc-table tr:last-child td { border-bottom:none; }
        .cy-doc-table .r { text-align:right; }
        .cy-chain-link:hover { text-decoration:underline !important; }
      `}</style>

      <div className="cy-page-content">
        <div className="cy-dash-wrap" style={{ maxWidth: 920 }}>

          <Link href={back.href} className="cy-back"
            style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:13, color:"#6b7280", textDecoration:"none", marginBottom:16, transition:"color 0.12s" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {back.label}
          </Link>

          <div style={{ background:"#fff", border:"1px solid #e5e7eb", overflow:"hidden" }}>

            {/* Header */}
            <div style={{ padding:"20px 24px", borderBottom:"1px solid #e5e7eb", display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:6 }}>
                  {TYPE_LABELS[doc.type] ?? doc.type}
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:12, flexWrap:"wrap" }}>
                  <h1 style={{ margin:0, fontSize:20, fontWeight:700, color:"#111827", fontFamily:"monospace", letterSpacing:"-0.01em" }}>{doc.docNum}</h1>
                  <StatusText status={acceptDone ? "ACCEPTED" : doc.status} />
                </div>
                {(doc.subject || doc.rfqTitle) && (
                  <div style={{ fontSize:13.5, color:"#374151", marginTop:6, fontWeight:500 }}>{doc.subject ?? doc.rfqTitle}</div>
                )}
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                {canAccept && (
                  <button onClick={handleAccept} disabled={accepting}
                    style={{ display:"flex", alignItems:"center", gap:6, height:36, padding:"0 16px", background:colors.primary, color:"#fff", border:"none", fontSize:13, fontWeight:600, cursor:accepting?"not-allowed":"pointer", opacity:accepting?0.7:1 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    {accepting ? "Accepting…" : "Accept Quotation"}
                  </button>
                )}
                {acceptDone && doc.type === "QUOTATION" && (
                  <div style={{ display:"flex", alignItems:"center", gap:6, height:36, padding:"0 14px", background:"#e8f5f0", color:"#0F6E56", fontSize:13, fontWeight:600 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Accepted
                  </div>
                )}
                <a href={`/api/customer/sales/${doc.id}/pdf`} target="_blank" rel="noreferrer"
                  style={{ display:"flex", alignItems:"center", gap:6, height:36, padding:"0 14px", background:"#fff", border:"1px solid #e5e7eb", fontSize:13, color:"#374151", textDecoration:"none" }}>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v8M4 6l3 3 3-3M1 11v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  Download PDF
                </a>
              </div>
            </div>

            {acceptErr && (
              <div style={{ padding:"10px 24px", background:"#fdf0ef", borderBottom:"1px solid #fca5a5", fontSize:13, color:"#991b1b" }}>{acceptErr}</div>
            )}

            {/* Date strip */}
            <div style={{ display:"flex", borderBottom:"1px solid #e5e7eb", flexWrap:"wrap" }}>
              {dateItems(doc).map((item, i) => (
                <div key={i} style={{ padding:"12px 24px", borderRight:"1px solid #f3f4f6", flex:1, minWidth:110 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:4 }}>{item.label}</div>
                  <div style={{ fontSize:13, color:"#111827", fontWeight:500 }}>{item.value}</div>
                </div>
              ))}
            </div>

            {/* From / Bill To */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", borderBottom:"1px solid #e5e7eb" }}>
              <div style={{ padding:"18px 24px", borderRight:"1px solid #f3f4f6" }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>From</div>
                <FromAddress li={doc.market.legalInfo} marketName={doc.market.name} />
              </div>
              <div style={{ padding:"18px 24px" }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:10 }}>Bill To</div>
                <ToAddress c={doc.customer} taxLabel={(doc.market.legalInfo as Record<string,string> | null)?.taxLabel ?? "VAT"} />
              </div>
            </div>

            {/* Line items */}
            {doc.lines.length > 0 && (
              <div style={{ borderBottom:"1px solid #e5e7eb", overflowX:"auto" }}>
                <table className="cy-doc-table" style={{ width:"100%", borderCollapse:"collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ width:"42%" }}>Description</th>
                      <th>Period</th>
                      <th className="r">Qty</th>
                      <th className="r">Unit Price</th>
                      <th className="r">Discount</th>
                      <th className="r">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.lines.map(line => (
                      <tr key={line.id}>
                        <td>
                          <div style={{ fontWeight:500, color:"#111827" }}>{line.description}</div>
                          {line.product && <div style={{ fontSize:11.5, color:"#9ca3af", marginTop:2, fontFamily:"monospace" }}>{line.product.key}</div>}
                        </td>
                        <td style={{ color:"#6b7280", fontSize:12.5 }}>{line.billingPeriod ?? "—"}</td>
                        <td className="r" style={{ fontSize:12.5 }}>{line.quantity}</td>
                        <td className="r" style={{ fontSize:12.5 }}>{fmt(line.unitPrice, doc.currency)}</td>
                        <td className="r" style={{ fontSize:12.5, color:line.discount>0?"#0F6E56":"#9ca3af" }}>
                          {line.discount > 0 ? `${line.discount}%` : "—"}
                        </td>
                        <td className="r" style={{ fontWeight:600, color:"#111827" }}>{fmt(line.lineTotal, doc.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals */}
            <div style={{ display:"flex", justifyContent:"flex-end", borderBottom:"1px solid #e5e7eb", padding:"16px 24px" }}>
              <div style={{ width:300 }}>
                <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:13, color:"#6b7280" }}>
                  <span>Subtotal</span><span>{fmt(doc.subtotal, doc.currency)}</span>
                </div>
                {doc.vatPercent > 0 && (
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", fontSize:13, color:"#6b7280" }}>
                    <span>VAT ({doc.vatPercent}%)</span><span>{fmt(doc.vatAmount, doc.currency)}</span>
                  </div>
                )}
                <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0 0", borderTop:"2px solid #e5e7eb", marginTop:8, fontSize:15, fontWeight:700, color:"#111827" }}>
                  <span>Total</span><span>{fmt(doc.total, doc.currency)}</span>
                </div>
                {showBalance && doc.amountPaid > 0 && (
                  <>
                    <div style={{ display:"flex", justifyContent:"space-between", padding:"6px 0 0", fontSize:13, color:"#0F6E56" }}>
                      <span>Amount paid</span><span>−{fmt(doc.amountPaid, doc.currency)}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0 0", borderTop:"1px solid #f3f4f6", marginTop:4, fontSize:14, fontWeight:700, color:doc.balance>0?"#b45309":"#0F6E56" }}>
                      <span>Balance Due</span><span>{fmt(doc.balance, doc.currency)}</span>
                    </div>
                  </>
                )}
                {showBalance && doc.amountPaid === 0 && doc.total > 0 && (
                  <div style={{ display:"flex", justifyContent:"space-between", padding:"8px 0 0", borderTop:"1px solid #f3f4f6", marginTop:4, fontSize:14, fontWeight:700, color:"#b45309" }}>
                    <span>Balance Due</span><span>{fmt(doc.total, doc.currency)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Payments */}
            {showPayments && (
              <div style={{ borderBottom:"1px solid #e5e7eb" }}>
                <div style={{ padding:"12px 24px 0", fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em" }}>Payments Received</div>
                {doc.payments.map((p, idx) => (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 24px", borderTop:idx===0?"1px solid #f3f4f6":"none", marginTop:idx===0?8:0 }}>
                    <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                      <span style={{ fontSize:13, color:"#6b7280" }}>{fmtDate(p.paidAt)}</span>
                      <span style={{ fontSize:13, color:"#374151", textTransform:"capitalize" }}>{p.method.replace(/_/g," ").toLowerCase()}</span>
                      {p.reference && <span style={{ fontSize:12, color:"#9ca3af", fontFamily:"monospace" }}>{p.reference}</span>}
                    </div>
                    <span style={{ fontSize:13, fontWeight:600, color:"#0F6E56" }}>{fmt(p.amountCents, p.currency)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Notes — separate section */}
            {doc.notes && (
              <div style={{ padding:"18px 24px", borderBottom:"1px solid #e5e7eb" }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>Notes</div>
                <div style={{ fontSize:13, color:"#374151", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{doc.notes}</div>
              </div>
            )}

            {/* Terms & Conditions — separate section after notes */}
            {doc.termsAndConditions && (
              <div style={{ padding:"18px 24px", borderBottom:"1px solid #e5e7eb" }}>
                <div style={{ fontSize:11, fontWeight:600, color:"#9ca3af", textTransform:"uppercase", letterSpacing:"0.05em", marginBottom:8 }}>Terms & Conditions</div>
                <div style={{ fontSize:13, color:"#374151", lineHeight:1.7, whiteSpace:"pre-wrap" }}>{doc.termsAndConditions}</div>
              </div>
            )}

            {/* Document chain */}
            {(doc.originDoc || doc.derivedDocs.length > 0) && (
              <div style={{ padding:"12px 24px", background:"#f9fafb", display:"flex", gap:24, flexWrap:"wrap", alignItems:"center" }}>
                {doc.originDoc && (
                  <div style={{ fontSize:12.5, color:"#6b7280" }}>
                    Origin:{" "}
                    <Link href={`/dashboard/sales/${doc.originDoc.id}`} className="cy-chain-link"
                      style={{ color:colors.primary, fontFamily:"monospace", fontWeight:600, textDecoration:"none" }}>
                      {doc.originDoc.docNum}
                    </Link>
                    {" "}({TYPE_LABELS[doc.originDoc.type] ?? doc.originDoc.type})
                  </div>
                )}
                {doc.derivedDocs.length > 0 && (
                  <div style={{ fontSize:12.5, color:"#6b7280" }}>
                    Related:{" "}
                    {doc.derivedDocs.map((d, i) => (
                      <span key={d.id}>
                        {i > 0 && <span style={{ marginRight:4 }}>,</span>}
                        <Link href={`/dashboard/sales/${d.id}`} className="cy-chain-link"
                          style={{ color:colors.primary, fontFamily:"monospace", fontWeight:600, textDecoration:"none" }}>
                          {d.docNum}
                        </Link>
                        {" "}({TYPE_LABELS[d.type] ?? d.type})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
